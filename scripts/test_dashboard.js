const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(root, "comics-data.js"), "utf8"));
const D = require(path.join(root, "app.js"));
const data = global.window.TEGNESERIER;

const base = { q: "", serie: "", forfatter: "", forlag: "", aarFra: "", aarTil: "", kunUlaest: false, kunManglende: false };
let failures = 0;

function check(name, cond) {
  if (!cond) failures++;
  console.log((cond ? "PASS" : "FAIL") + " " + name);
}

check("data er et ikke-tomt array", Array.isArray(data) && data.length > 0);

const keys = ["id", "titel", "forfatter", "serie", "nummer", "aar", "forlag", "kommentar", "note", "mangler", "placeholder"];
check("alle rækker har alle felter", data.every((r) => keys.every((k) => k in r)));

check("filtrer uden filtre giver alle rækker", D.filtrer(data, base).length === data.length);

const mangler = data.filter((r) => r.mangler);
check("der findes manglende album", mangler.length > 0);
check("kunManglende giver kun mangler-rækker", D.filtrer(data, { ...base, kunManglende: true }).every((r) => r.mangler) && D.filtrer(data, { ...base, kunManglende: true }).length === mangler.length);
check("alle pladsholdere er markeret mangler", data.filter((r) => r.placeholder).every((r) => r.mangler));

const medSerie = data.find((r) => r.serie);
check("søgning på serie-navn finder mindst serien selv", D.filtrer(data, { ...base, q: medSerie.serie.toLowerCase() }).length >= D.filtrer(data, { ...base, serie: medSerie.serie }).length);

const aarDesc = D.sorter(data, "aar", "desc");
const aarTal = aarDesc.filter((r) => r.aar !== "").map((r) => Number(r.aar));
check("sortering år desc: tal først, faldende", aarTal.every((v, i) => i === 0 || aarTal[i - 1] >= v));
check("sortering år desc: tomme år til sidst", aarDesc.slice(-1)[0].aar === "" || data.every((r) => r.aar === ""));

const st = D.statistik(data);
check("statistik: album ekskl. pladsholdere", st.album === data.filter((r) => !r.placeholder).length);
check("statistik: mangler tæller alle mangler", st.mangler === mangler.length);
check("statistik: album + pladsholdere = total", st.album + data.filter((r) => r.placeholder).length === data.length);

if (failures) {
  console.error(failures + " test fejlede");
  process.exit(1);
}
console.log("Alle " + "dashboard-tests bestået (" + data.length + " rækker)");
