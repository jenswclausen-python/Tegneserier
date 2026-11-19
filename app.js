(function (global) {
  "use strict";

  function txt(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  function soegeTekst(r) {
    return [r.titel, r.forfatter, r.serie, r.nummer, r.aar, r.forlag, r.kommentar, r.note]
      .map(txt)
      .join(" ")
      .toLowerCase();
  }

  function filtrer(rows, state) {
    var q = txt(state.q).trim().toLowerCase();
    return rows.filter(function (r) {
      if (q && soegeTekst(r).indexOf(q) === -1) return false;
      if (state.serie && r.serie !== state.serie) return false;
      if (state.forfatter && r.forfatter !== state.forfatter) return false;
      if (state.forlag && r.forlag !== state.forlag) return false;
      var aar = txt(r.aar) === "" ? null : Number(r.aar);
      if (aar !== null && Number.isNaN(aar)) aar = null;
      if (state.aarFra !== "" && state.aarFra !== null && (aar === null || aar < Number(state.aarFra))) return false;
      if (state.aarTil !== "" && state.aarTil !== null && (aar === null || aar > Number(state.aarTil))) return false;
      if (state.kunUlaest && txt(r.kommentar + " " + r.note).toLowerCase().indexOf("ikke læst") === -1) return false;
      if (state.kunManglende && !r.mangler) return false;
      return true;
    });
  }

  function talNoegle(v) {
    var m = txt(v).match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  }

  function sorter(rows, key, dir) {
    var mul = dir === "desc" ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var va = txt(a[key]);
      var vb = txt(b[key]);
      var aTom = va === "";
      var bTom = vb === "";
      if (aTom && bTom) return 0;
      if (aTom) return 1;
      if (bTom) return -1;
      var cmp;
      if (key === "nummer" || key === "aar") {
        cmp = talNoegle(va) - talNoegle(vb) || va.localeCompare(vb, "da");
      } else {
        cmp = va.localeCompare(vb, "da");
      }
      return cmp * mul;
    });
  }

  function unikke(rows, felt) {
    var seen = {};
    rows.forEach(function (r) {
      var v = txt(r[felt]).trim();
      if (v) seen[v] = true;
    });
    return Object.keys(seen).sort(function (a, b) {
      return a.localeCompare(b, "da");
    });
  }

  function statistik(rows) {
    var aar = rows.map(function (r) { return txt(r.aar) === "" ? null : Number(r.aar); }).filter(function (n) { return n !== null && !Number.isNaN(n); });
    var rigtige = rows.filter(function (r) { return !r.placeholder; });
    return {
      album: rigtige.length,
      serier: unikke(rigtige, "serie").length,
      forfattere: unikke(rigtige, "forfatter").length,
      aarMin: aar.length ? Math.min.apply(null, aar) : null,
      aarMax: aar.length ? Math.max.apply(null, aar) : null,
      ikkeLaest: rows.filter(function (r) {
        return txt(r.kommentar + " " + r.note).toLowerCase().indexOf("ikke læst") !== -1;
      }).length,
      mangler: rows.filter(function (r) { return r.mangler; }).length,
    };
  }

  function harAktivSoegning(state) {
    var aarFra = state.aarFra !== "" && state.aarFra !== null && state.aarFra !== undefined;
    var aarTil = state.aarTil !== "" && state.aarTil !== null && state.aarTil !== undefined;
    return !!(txt(state.q).trim() || state.serie || state.forfatter || state.forlag || aarFra || aarTil || state.kunUlaest || state.kunManglende);
  }

  var OVERLAY_KEY = "tegneserier-overlay-v1";

  function tomtOverlay() {
    return { tilfoejelser: [], aendringer: {}, slettede: [] };
  }

  function laesOverlay() {
    try {
      if (typeof localStorage === "undefined") return tomtOverlay();
      var raw = localStorage.getItem(OVERLAY_KEY);
      if (!raw) return tomtOverlay();
      var o = JSON.parse(raw);
      return {
        tilfoejelser: Array.isArray(o.tilfoejelser) ? o.tilfoejelser : [],
        aendringer: o.aendringer || {},
        slettede: Array.isArray(o.slettede) ? o.slettede : [],
      };
    } catch (e) {
      return tomtOverlay();
    }
  }

  function gemOverlay(o) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function anvendOverlay(basis, overlay) {
    var slettet = {};
    overlay.slettede.forEach(function (id) { slettet[id] = true; });
    var ud = [];
    basis.forEach(function (r) {
      if (slettet[r.id]) return;
      var a = overlay.aendringer[r.id];
      ud.push(a ? Object.assign({}, r, a) : r);
    });
    overlay.tilfoejelser.forEach(function (r) { ud.push(r); });
    return ud;
  }

  function tilCsv(rows) {
    var head = ["id", "titel", "forfatter", "serie", "nummer", "aar", "forlag", "kommentar", "note", "mangler", "placeholder"];
    function esc(v) {
      v = txt(v);
      return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    return head.join(";") + "\n" + rows.map(function (r) { return head.map(function (h) { return esc(r[h]); }).join(";"); }).join("\n");
  }

  function parseCsv(text) {
    text = txt(text).replace(/^﻿/, "");
    var firstLine = text.split(/\r?\n/, 1)[0] || "";
    var sep = firstLine.indexOf(";") !== -1 ? ";" : ",";
    var rows = [];
    var cur = [];
    var field = "";
    var inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
        } else { field += ch; }
      } else if (ch === '"') { inQ = true; }
      else if (ch === sep) { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.length > 1 || cur[0] !== "") rows.push(cur);
        cur = [];
      } else { field += ch; }
    }
    if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
    if (!rows.length) return [];
    var alias = { "år": "aar", "aar": "aar", "nr": "nummer", "kommentarer": "kommentar" };
    var head = rows[0].map(function (h) { return (alias[h.trim().toLowerCase()] || h.trim().toLowerCase()); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || "").trim(); });
      return o;
    });
  }

  var api = { filtrer: filtrer, sorter: sorter, unikke: unikke, statistik: statistik, soegeTekst: soegeTekst, txt: txt, harAktivSoegning: harAktivSoegning, tomtOverlay: tomtOverlay, laesOverlay: laesOverlay, gemOverlay: gemOverlay, anvendOverlay: anvendOverlay, tilCsv: tilCsv, parseCsv: parseCsv, overlayTom: function (o) { return !o.tilfoejelser.length && !Object.keys(o.aendringer).length && !o.slettede.length; }, OVERLAY_KEY: OVERLAY_KEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.Dashboard = api;

  if (typeof document === "undefined") return;

  var BASE = global.TEGNESERIER || [];
  var overlay = laesOverlay();
  var DATA = anvendOverlay(BASE, overlay);
  var serverMode = false;
  var TOKEN_KEY = "tegneserier-api-token";
  var LAST_KEY = "tegneserier-last-saved";
  var COLS = [
    { key: "nummer", label: "Nr." },
    { key: "titel", label: "Titel" },
    { key: "forfatter", label: "Forfatter" },
    { key: "serie", label: "Serie" },
    { key: "aar", label: "År" },
    { key: "forlag", label: "Forlag" },
    { key: "kommentar", label: "Kommentar" },
  ];
  var state = { q: "", serie: "", forfatter: "", forlag: "", aarFra: "", aarTil: "", kunUlaest: false, kunManglende: false, sortKey: "forfatter", sortDir: "asc" };

  function $(id) {
    return document.getElementById(id);
  }

  function genberegn() {
    DATA = anvendOverlay(BASE, overlay);
  }

  function token() {
    try { return typeof localStorage !== "undefined" ? (localStorage.getItem(TOKEN_KEY) || "") : ""; } catch (e) { return ""; }
  }

  function overlayTom() {
    return !overlay.tilfoejelser.length && !Object.keys(overlay.aendringer).length && !overlay.slettede.length;
  }

  function antalPending() {
    return overlay.tilfoejelser.length + Object.keys(overlay.aendringer).length + overlay.slettede.length;
  }

  function lastSaved() {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(LAST_KEY) : null; } catch (e) { return null; }
  }

  function opdaterLagring() {
    var el = $("lagring");
    if (!el) return;
    if (serverMode) {
      el.textContent = overlayTom()
        ? "Lagring: server (api.php → data.json) — synkroniseret ✓" + (lastSaved() ? " kl. " + lastSaved() : "") + " — samme data i alle browsere"
        : "Lagring: server (api.php → data.json) — afventer synkronisering ⏳ (" + antalPending() + " ændringer ligger lokalt)";
    } else {
      el.textContent = "Lagring: lokal browser (localStorage) — brug CSV-eksport/import til at flytte data mellem enheder";
    }
  }

  function loadServerData() {
    if (typeof fetch === "undefined") return Promise.resolve(false);
    return fetch("api.php", { headers: { "Authorization": "Bearer " + token() }, cache: "no-store" })
      .then(function (resp) {
        if (!resp.ok) return false;
        return resp.json().then(function (arr) {
          if (Array.isArray(arr) && arr.length) { BASE = arr; serverMode = true; genberegn(); return true; }
          return false;
        });
      })
      .catch(function () { return false; });
  }

  function saveAll() {
    if (!serverMode || typeof fetch === "undefined") return Promise.resolve(false);
    return fetch("api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token() },
      body: JSON.stringify(DATA),
    })
      .then(function (resp) { return resp.ok ? resp.json().then(function (j) { return !!j.ok; }) : false; })
      .catch(function () { return false; });
  }

  function syncPending() {
    if (!serverMode || overlayTom() || typeof fetch === "undefined") return Promise.resolve(false);
    genberegn();
    return saveAll().then(function (ok) {
      if (ok) {
        BASE = DATA;
        overlay = tomtOverlay();
        gemOverlay(overlay);
        try { if (typeof localStorage !== "undefined") localStorage.setItem(LAST_KEY, new Date().toLocaleTimeString("da-DK")); } catch (e) {}
      }
      genberegn(); opdaterLagring(); renderAlt();
      return ok;
    });
  }

  function gem() {
    if (serverMode) {
      syncPending();
    } else {
      gemOverlay(overlay); genberegn(); opdaterLagring(); renderAlt();
    }
  }

  function importerCsv(fil) {
    var reader = new FileReader();
    reader.onload = function () {
      parseCsv(reader.result).forEach(function (r, i) {
        var id = r.id && String(r.id).trim();
        var rec = {
          id: id && String(id).indexOf("ny-") === 0 ? id : "ny-imp-" + Date.now() + "-" + i,
          titel: r.titel || "", forfatter: r.forfatter || "", serie: r.serie || "",
          nummer: r.nummer || "", aar: r.aar || "", forlag: r.forlag || "",
          kommentar: r.kommentar || "", note: r.note || "",
          mangler: /^(true|1|ja)$/i.test(r.mangler || ""), placeholder: /^(true|1|ja)$/i.test(r.placeholder || ""),
        };
        var find = id ? DATA.find(function (x) { return String(x.id) === String(id); }) : null;
        if (find) overlay.aendringer[id] = rec; else overlay.tilfoejelser.push(rec);
      });
      gem();
    };
    reader.readAsText(fil, "UTF-8");
  }

  function fyldSelect(el, values, alleLabel) {
    el.innerHTML = "";
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = alleLabel;
    el.appendChild(opt);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
  }

  function laesState() {
    state.q = $("q").value;
    state.serie = $("f-serie").value;
    state.forfatter = $("f-forfatter").value;
    state.forlag = $("f-forlag").value;
    state.aarFra = $("aar-fra").value;
    state.aarTil = $("aar-til").value;
    state.kunUlaest = $("kun-ulaest").checked;
    state.kunManglende = $("kun-manglende").checked;
  }

  function opdaterSorteringsPile() {
    document.querySelectorAll("#tabel thead th[data-key]").forEach(function (th) {
      var key = th.getAttribute("data-key");
      var pil = th.querySelector(".pil");
      if (pil) pil.textContent = key === state.sortKey ? (state.sortDir === "desc" ? "▼" : "▲") : "";
    });
  }

  function renderStats() {
    var s = statistik(DATA);
    $("stat-album").textContent = s.album;
    $("stat-serier").textContent = s.serier;
    $("stat-forfattere").textContent = s.forfattere;
    $("stat-aar").textContent = s.aarMin === null ? "—" : s.aarMin + "–" + s.aarMax;
    $("stat-ulaest").textContent = s.ikkeLaest;
    $("stat-mangler").textContent = s.mangler;
  }

  function renderResultater(fundne) {
    var tom = !harAktivSoegning(state);
    var s = statistik(fundne);
    $("res-album").textContent = tom ? "" : String(fundne.length);
    $("res-serier").textContent = tom ? "" : String(s.serier);
    $("res-forfattere").textContent = tom ? "" : String(s.forfattere);
    $("res-aar").textContent = tom ? "" : s.aarMin === null ? "—" : s.aarMin + "–" + s.aarMax;
    $("res-ulaest").textContent = tom ? "" : String(s.ikkeLaest);
    $("res-mangler").textContent = tom ? "" : String(s.mangler);
  }

  function renderTabel() {
    var fundne = sorter(filtrer(DATA, state), state.sortKey, state.sortDir);
    var tbody = $("tbody");
    tbody.innerHTML = "";
    var frag = document.createDocumentFragment();
    fundne.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.mangler) tr.className = "mangler-row";
      COLS.forEach(function (c) {
        var td = document.createElement("td");
        var v = txt(r[c.key]);
        if (c.key === "kommentar" && r.note) v = v ? v + "  ·  " + r.note : r.note;
        td.textContent = v || "—";
        if (c.key === "aar" || c.key === "nummer") td.className = "tal";
        tr.appendChild(td);
      });
      var tdAct = document.createElement("td");
      tdAct.className = "handlinger";
      var rediger = document.createElement("button");
      rediger.type = "button";
      rediger.className = "rad-knap";
      rediger.textContent = "✎";
      rediger.title = "Rediger";
      rediger.setAttribute("data-act", "rediger");
      rediger.setAttribute("data-id", r.id);
      var slet = document.createElement("button");
      slet.type = "button";
      slet.className = "rad-knap";
      slet.textContent = "✕";
      slet.title = "Slet";
      slet.setAttribute("data-act", "slet");
      slet.setAttribute("data-id", r.id);
      tdAct.appendChild(rediger);
      tdAct.appendChild(slet);
      tr.appendChild(tdAct);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    $("antal").textContent = "Viser " + fundne.length + " af " + DATA.length + " album";
    renderResultater(fundne);
  }

  function render() {
    laesState();
    opdaterSorteringsPile();
    renderTabel();
  }

  function renderAlt() {
    fyldSelect($("f-serie"), unikke(DATA, "serie"), "Alle serier");
    fyldSelect($("f-forfatter"), unikke(DATA, "forfatter"), "Alle forfattere");
    fyldSelect($("f-forlag"), unikke(DATA, "forlag"), "Alle forlag");
    renderStats();
    render();
  }

  function aabenModal(record) {
    $("modal-titel").textContent = record ? "Rediger album" : "Tilføj album";
    $("edit-id").value = record ? String(record.id) : "";
    $("f-titel").value = record ? txt(record.titel) : "";
    $("f-forfatter").value = record ? txt(record.forfatter) : "";
    $("f-serie").value = record ? txt(record.serie) : "";
    $("f-nummer").value = record ? txt(record.nummer) : "";
    $("f-aar").value = record ? txt(record.aar) : "";
    $("f-forlag").value = record ? txt(record.forlag) : "";
    $("f-kommentar").value = record ? txt(record.kommentar) : "";
    $("f-mangler").checked = !!(record && record.mangler);
    $("modal").hidden = false;
    $("f-titel").focus();
  }

  function lukModal() {
    $("modal").hidden = true;
  }

  function gemFraFormular(e) {
    e.preventDefault();
    var titel = $("f-titel").value.trim();
    if (!titel) {
      $("f-titel").focus();
      return;
    }
    var felter = {
      titel: titel,
      forfatter: $("f-forfatter").value.trim(),
      serie: $("f-serie").value.trim(),
      nummer: $("f-nummer").value.trim(),
      aar: $("f-aar").value.trim(),
      forlag: $("f-forlag").value.trim(),
      kommentar: $("f-kommentar").value.trim(),
      mangler: $("f-mangler").checked,
    };
    var id = $("edit-id").value;
    if (!id) {
      overlay.tilfoejelser.push(Object.assign({ id: "ny-" + Date.now(), note: "", placeholder: false }, felter));
    } else if (id.indexOf("ny-") === 0) {
      var t = overlay.tilfoejelser.find(function (r) { return String(r.id) === id; });
      if (t) Object.assign(t, felter);
    } else {
      overlay.aendringer[id] = Object.assign({}, overlay.aendringer[id], felter);
    }
    gem();
    lukModal();
  }

  function sletRaekke(id) {
    id = String(id);
    var i = overlay.tilfoejelser.findIndex(function (r) { return String(r.id) === id; });
    if (i !== -1) {
      overlay.tilfoejelser.splice(i, 1);
    } else if (!overlay.slettede.includes(id)) {
      overlay.slettede.push(id);
    }
    delete overlay.aendringer[id];
    gem();
  }

  function eksporterCsv() {
    var blob = new Blob(["\ufeff" + tilCsv(DATA)], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tegneserier-eksport.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function init() {
    $("tilfoej").addEventListener("click", function () { aabenModal(null); });
    $("eksport").addEventListener("click", eksporterCsv);
    $("nulstil-overlay").addEventListener("click", function () {
      overlay = tomtOverlay();
      gem();
    });
    $("import").addEventListener("click", function () { $("import-fil").click(); });
    $("import-fil").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importerCsv(e.target.files[0]);
      e.target.value = "";
    });
    $("api-token").value = token();
    $("api-token").addEventListener("input", function () {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, $("api-token").value); } catch (err) {}
      loadServerData().then(function () { opdaterLagring(); renderAlt(); });
    });
    $("album-form").addEventListener("submit", gemFraFormular);
    $("annuller").addEventListener("click", lukModal);
    $("modal").addEventListener("click", function (e) {
      if (e.target === $("modal")) lukModal();
    });
    $("tbody").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var record = DATA.find(function (r) { return String(r.id) === id; });
      if (btn.getAttribute("data-act") === "rediger") {
        if (record) aabenModal(record);
      } else if (btn.getAttribute("data-act") === "slet") {
        sletRaekke(id);
      }
    });
    ["q", "f-serie", "f-forfatter", "f-forlag", "aar-fra", "aar-til"].forEach(function (id) {
      $(id).addEventListener("input", render);
    });
    $("sog").addEventListener("click", render);
    $("kun-ulaest").addEventListener("change", render);
    $("kun-manglende").addEventListener("change", render);
    $("nulstil").addEventListener("click", function () {
      $("q").value = "";
      $("f-serie").value = "";
      $("f-forfatter").value = "";
      $("f-forlag").value = "";
      $("aar-fra").value = "";
      $("aar-til").value = "";
      $("kun-ulaest").checked = false;
      $("kun-manglende").checked = false;
      render();
    });
    document.querySelectorAll("#tabel thead th[data-key]").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-key");
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = "asc";
        }
        render();
      });
    });
    opdaterLagring();
    loadServerData().then(function () {
      opdaterLagring();
      if (serverMode) {
        window.addEventListener("online", function () { syncPending(); });
        syncPending().then(function () { renderAlt(); });
      } else {
        renderAlt();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
