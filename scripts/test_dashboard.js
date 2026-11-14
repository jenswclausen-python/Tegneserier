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

const ov = D.tomtOverlay();
ov.tilfoejelser.push({ id: "ny-1", titel: "Testalbum", forfatter: "Test", serie: "Testserie", nummer: "1", aar: "", forlag: "", kommentar: "", note: "", mangler: true, placeholder: false });
const eff1 = D.anvendOverlay(data, ov);
check("overlay: tilføjelse med i data", eff1.length === data.length + 1 && eff1.some((r) => r.id === "ny-1"));

ov.aendringer = { [data[0].id]: { titel: "Ændret titel" } };
const eff2 = D.anvendOverlay(data, ov);
check("overlay: ændring slår igennem på eksisterende række", eff2.find((r) => r.id === data[0].id).titel === "Ændret titel");

ov.slettede = [data[1].id];
const eff3 = D.anvendOverlay(data, ov);
check("overlay: sletning fjerner række", !eff3.some((r) => r.id === data[1].id) && eff3.length === data.length);

check("csv-eksport har header og rækker", D.tilCsv(eff1).split("\n").length === eff1.length + 1 && D.tilCsv(eff1).startsWith("id;titel;"));

if (failures) {
  console.error(failures + " test fejlede");
  process.exit(1);
}
console.log("Alle dashboard-tests bestået (" + data.length + " rækker)");
