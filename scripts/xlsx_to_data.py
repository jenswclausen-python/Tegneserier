#!/usr/bin/env python3
import argparse
import datetime
import json
import sys
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

FIELDS = ["titel", "forfatter", "serie", "nummer", "aar", "forlag", "kommentar", "note"]


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


def is_header_row(r):
    vals = {norm(cell(r, j)).lower() for j in range(len(r))}
    return sum(1 for v in vals if v in HEADER_MAP) >= 3


def find_header(rows):
    for i, r in enumerate(rows[:10]):
        if is_header_row(r):
            return i
    return None


def sheet_records(ws):
    rows = list(ws.iter_rows(values_only=True))
    rows = [r for r in rows if any(v is not None and str(v).strip() != "" for v in r)]
    hdr = find_header(rows)
    colmap = {}
    note_cols = set()
    max_col = max((len(r) for r in rows), default=0)
    if hdr is not None:
        for j in range(len(rows[hdr])):
            h = norm(cell(rows[hdr], j)).lower()
            if h in HEADER_MAP:
                colmap[HEADER_MAP[h]] = j
        for f, j in FALLBACK.items():
            if f not in colmap:
                colmap[f] = j
        used = set(colmap.values())
        note_cols = {j for j in range(max_col) if j not in used and any(norm(cell(r, j)) for r in rows[hdr + 1 :])}
    else:
        colmap = dict(FALLBACK)
        note_cols = {j for j in range(max_col) if j not in colmap.values() and any(norm(cell(r, j)) for r in rows)}
    data_start = (hdr + 1) if hdr is not None else 0
    recs = []
    for r in rows[data_start:]:
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
        if not any(rec[f] for f in ("titel", "forfatter", "serie", "nummer")):
            continue
        recs.append(rec)
    return recs


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

    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    all_recs = []
    per_sheet = {}
    for name in wb.sheetnames:
        recs = sheet_records(wb[name])
        per_sheet[name] = len(recs)
        all_recs.extend(recs)

    recs = sort_recs(merge(all_recs))
    for i, r in enumerate(recs, 1):
        r["id"] = i
        try:
            r["aar"] = int(float(r["aar"])) if r["aar"] else ""
        except ValueError:
            pass

    out.write_text("window.TEGNESERIER = " + json.dumps(recs, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Input: {xlsx}")
    for name, n in per_sheet.items():
        print(f"  ark '{name}': {n} rækker")
    print(f"Unikke album efter merge: {len(recs)}")
    print(f"Skrevet: {out}")


if __name__ == "__main__":
    main()
