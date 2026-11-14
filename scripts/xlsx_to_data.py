#!/usr/bin/env python3
import argparse
import datetime
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

HEADER_MAP = {
    "forfatter": "forfatter",
    "serie": "serie",
    "nummer": "nummer",
    "nr": "nummer",
    "titel": "titel",
    "kommentarer": "kommentar",
    "kommentar": "kommentar",
    "år": "aar",
    "aar": "aar",
    "forlag": "forlag",
}

FALLBACK = {"forfatter": 0, "serie": 1, "nummer": 2, "titel": 4, "kommentar": 7, "aar": 9, "forlag": 10}

FIELDS = ["titel", "forfatter", "serie", "nummer", "aar", "forlag", "kommentar", "note", "mangler", "placeholder"]

YELLOW = "FFFFFF00"
HUL_MIN_OWNED = 3
HUL_MIN_COVERAGE = 0.6

SERIE_ALIAS = {
    "agent 328": "Agent 327",
    "agent 329": "Agent 327",
    "agent 330": "Agent 327",
    "agent 331": "Agent 327",
    "agent 332": "Agent 327",
    "agent 333": "Agent 327",
}


def normaliser_serie(s):
    return SERIE_ALIAS.get(s.strip().lower(), s)


def cell(row, j):
    return row[j] if j < len(row) else None


def norm(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.date().isoformat() if isinstance(v, datetime.datetime) else v.isoformat()
    return str(v).strip()


def is_yellow(c):
    try:
        return c.fill is not None and c.fill.fill_type == "solid" and str(c.fill.fgColor.rgb or "").upper() == YELLOW
    except Exception:
        return False


def is_header_row(r):
    vals = {norm(cell(r, j)).lower() for j in range(len(r))}
    return sum(1 for v in vals if v in HEADER_MAP) >= 3


def sheet_records(ws):
    cells = list(ws.iter_rows())
    values = [[c.value for c in row] for row in cells]
    yellow = {i for i, row in enumerate(cells) if any(is_yellow(c) for c in row)}
    keep = [(i, r) for i, r in enumerate(values) if any(v is not None and str(v).strip() != "" for v in r)]
    hdr = None
    for pos in range(min(10, len(keep))):
        if is_header_row(keep[pos][1]):
            hdr = pos
            break
    max_col = max((len(r) for _, r in keep), default=0)
    colmap = {}
    note_cols = set()
    if hdr is not None:
        for j in range(len(keep[hdr][1])):
            h = norm(cell(keep[hdr][1], j)).lower()
            if h in HEADER_MAP:
                colmap[HEADER_MAP[h]] = j
        for f, j in FALLBACK.items():
            if f not in colmap:
                colmap[f] = j
        used = set(colmap.values())
        note_cols = {j for j in range(max_col) if j not in used and any(norm(cell(r, j)) for _, r in keep[hdr + 1 :])}
    else:
        colmap = dict(FALLBACK)
        note_cols = {j for j in range(max_col) if j not in colmap.values() and any(norm(cell(r, j)) for _, r in keep)}
    data = keep[hdr + 1 :] if hdr is not None else keep
    recs = []
    for i, r in data:
        if is_header_row(r):
            continue
        rec = {f: "" for f in FIELDS}
        for f, j in colmap.items():
            rec[f] = norm(cell(r, j))
        notes = [norm(cell(r, j)) for j in sorted(note_cols) if norm(cell(r, j))]
        if not rec["forfatter"] and colmap.get("forfatter") != 3 and norm(cell(r, 3)):
            rec["forfatter"] = norm(cell(r, 3))
            notes = [n for n in notes if n != rec["forfatter"]]
        rec["note"] = " | ".join(dict.fromkeys(notes))
        rec["serie"] = normaliser_serie(rec["serie"])
        rec["mangler"] = i in yellow
        rec["placeholder"] = False
        if not any(rec[f] for f in ("titel", "forfatter", "serie", "nummer")):
            continue
        recs.append(rec)
    return recs


def flyt_samlebind(all_recs):
    serier = {r["serie"] for r in all_recs if r["serie"]}
    samlede_base = {}
    for s in serier:
        if "samlede" in s.lower():
            for b in serier:
                if b != s and len(b) < len(s) and s.lower().startswith(b.lower()):
                    samlede_base.setdefault(b.lower(), s)
    flyttet = 0
    for r in all_recs:
        if r["serie"] and r["titel"] and re.match(r"^den store\b", r["titel"], re.I):
            target = samlede_base.get(r["serie"].lower())
            if target and target != r["serie"]:
                r["serie"] = target
                flyttet += 1
    return flyttet


def merge(all_recs):
    merged = {}
    order = []
    for rec in all_recs:
        key = tuple(rec[f].lower() for f in ("forfatter", "serie", "nummer", "titel"))
        if key not in merged:
            merged[key] = dict(rec)
            order.append(key)
        else:
            for f in FIELDS:
                if not merged[key][f] and rec[f]:
                    merged[key][f] = rec[f]
    return [merged[k] for k in order]


def add_gaps(recs):
    by_serie = defaultdict(list)
    forfatter_by_serie = defaultdict(Counter)
    for r in recs:
        if r["serie"] and r["nummer"].isdigit():
            by_serie[r["serie"]].append(int(r["nummer"]))
            if r["forfatter"]:
                forfatter_by_serie[r["serie"]][r["forfatter"]] += 1
    out = list(recs)
    gaps_added = 0
    for serie, nums in by_serie.items():
        u = sorted(set(nums))
        if len(u) < HUL_MIN_OWNED:
            continue
        lo, hi = u[0], u[-1]
        if len(u) / (hi - lo + 1) < HUL_MIN_COVERAGE:
            continue
        owned = set(u)
        fa = forfatter_by_serie[serie].most_common(1)
        for n in range(lo, hi + 1):
            if n not in owned:
                out.append(
                    {
                        "titel": "(mangler)",
                        "forfatter": fa[0][0] if fa else "",
                        "serie": serie,
                        "nummer": str(n),
                        "aar": "",
                        "forlag": "",
                        "kommentar": "Mangler i serien",
                        "note": "",
                        "mangler": True,
                        "placeholder": True,
                    }
                )
                gaps_added += 1
    return out, gaps_added


def num_key(v):
    digits = "".join(ch for ch in v if ch.isdigit())
    return (int(digits) if digits else float("inf"), v.lower())


def sort_recs(recs):
    return sorted(
        recs,
        key=lambda r: (
            r["forfatter"].lower(),
            r["serie"].lower(),
            num_key(r["nummer"]),
            r["titel"].lower(),
        ),
    )


def main():
    ap = argparse.ArgumentParser(description="Konverter tegneserie-Excel til comics-data.js")
    ap.add_argument("input", nargs="?", default=None, help="Sti til .xlsx (default: første .xlsx i repo-root)")
    ap.add_argument("-o", "--output", default=None, help="Output-sti (default: comics-data.js i repo-root)")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    if args.input:
        xlsx = Path(args.input)
    else:
        candidates = sorted(root.glob("*.xlsx"))
        if not candidates:
            sys.exit("Ingen .xlsx fundet i repo-root — angiv sti som argument.")
        xlsx = candidates[0]
    out = Path(args.output) if args.output else root / "comics-data.js"

    wb = openpyxl.load_workbook(xlsx, data_only=True)
    all_recs = []
    per_sheet = {}
    for name in wb.sheetnames:
        recs = sheet_records(wb[name])
        per_sheet[name] = len(recs)
        all_recs.extend(recs)

    flyttet = flyt_samlebind(all_recs)
    recs = merge(all_recs)
    recs, gaps_added = add_gaps(recs)
    recs = sort_recs(recs)
    for i, r in enumerate(recs, 1):
        r["id"] = i
        try:
            r["aar"] = int(float(r["aar"])) if r["aar"] else ""
        except ValueError:
            pass

    out.write_text("window.TEGNESERIER = " + json.dumps(recs, ensure_ascii=False) + ";\n", encoding="utf-8")
    yellow_count = sum(1 for r in recs if r["mangler"] and not r["placeholder"])
    print(f"Input: {xlsx}")
    for name, n in per_sheet.items():
        print(f"  ark '{name}': {n} rækker")
    print(f"Samlebind (\"Den Store …\") flyttet til -samlede-serie: {flyttet}")
    print(f"Unikke album efter merge: {len(recs) - gaps_added}")
    print(f"Gul-markeringer (mangler): {yellow_count}")
    print(f"Huller i serier (tilføjede pladsholdere): {gaps_added}")
    print(f"Samlet rækker i data: {len(recs)}")
    print(f"Skrevet: {out}")


if __name__ == "__main__":
    main()
