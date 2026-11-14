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
    return {
      album: rows.filter(function (r) { return !r.placeholder; }).length,
      serier: unikke(rows.filter(function (r) { return !r.placeholder; }), "serie").length,
      forfattere: unikke(rows.filter(function (r) { return !r.placeholder; }), "forfatter").length,
      aarMin: aar.length ? Math.min.apply(null, aar) : null,
      aarMax: aar.length ? Math.max.apply(null, aar) : null,
      ikkeLaest: rows.filter(function (r) {
        return txt(r.kommentar + " " + r.note).toLowerCase().indexOf("ikke læst") !== -1;
      }).length,
      mangler: rows.filter(function (r) { return r.mangler; }).length,
    };
  }

  var api = { filtrer: filtrer, sorter: sorter, unikke: unikke, statistik: statistik, soegeTekst: soegeTekst, txt: txt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.Dashboard = api;

  if (typeof document === "undefined") return;

  var DATA = global.TEGNESERIER || [];
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
    document.querySelectorAll("#tabel thead th").forEach(function (th) {
      var key = th.getAttribute("data-key");
      var pil = th.querySelector(".pil");
      if (key === state.sortKey) {
        pil.textContent = state.sortDir === "desc" ? "▼" : "▲";
      } else {
        pil.textContent = "";
      }
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
        if (c.key === "aar") td.className = "tal";
        if (c.key === "nummer") td.className = "tal";
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    $("antal").textContent = "Viser " + fundne.length + " af " + DATA.length + " album";
  }

  function render() {
    laesState();
    opdaterSorteringsPile();
    renderTabel();
  }

  function init() {
    fyldSelect($("f-serie"), unikke(DATA, "serie"), "Alle serier");
    fyldSelect($("f-forfatter"), unikke(DATA, "forfatter"), "Alle forfattere");
    fyldSelect($("f-forlag"), unikke(DATA, "forlag"), "Alle forlag");
    ["q", "f-serie", "f-forfatter", "f-forlag", "aar-fra", "aar-til"].forEach(function (id) {
      $(id).addEventListener("input", render);
    });
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
    document.querySelectorAll("#tabel thead th").forEach(function (th) {
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
    renderStats();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
