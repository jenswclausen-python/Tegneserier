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

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
check("index.html er selvstændig enkeltfil (indlejret data, ingen eksterne scripts)", html.includes("window.TEGNESERIER") && !html.includes("<script src="));
const tpl = fs.readFileSync(path.join(root, "template.html"), "utf8");
check("template.html refererer comics-data.js og app.js (kræves af build_single.py)", tpl.includes('<script src="comics-data.js"></script>') && tpl.includes('<script src="app.js"></script>'));
check("template.html har Søg-knap", tpl.includes('id="sog"'));

check("harAktivSoegning: tom tilstand = false", D.harAktivSoegning(base) === false);
check("harAktivSoegning: søgetekst = true", D.harAktivSoegning({ ...base, q: "asterix" }) === true);
check("harAktivSoegning: serie-filter = true", D.harAktivSoegning({ ...base, serie: "Asterix" }) === true);
check("harAktivSoegning: kunManglende = true", D.harAktivSoegning({ ...base, kunManglende: true }) === true);
check("harAktivSoegning: aarFra = true", D.harAktivSoegning({ ...base, aarFra: "1980" }) === true);
check("harAktivSoegning: tom søgestreng = false", D.harAktivSoegning({ ...base, q: "   " }) === false);

const man = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
check("manifest: standalone med >=2 ikoner", man.display === "standalone" && man.icons.length >= 2);
check("manifest-ikoner findes på disk", man.icons.every((i) => fs.existsSync(path.join(root, i.src))));
check("sw.js findes", fs.existsSync(path.join(root, "sw.js")));
check("template.html: manifest-link + service worker-registrering", tpl.includes('rel="manifest"') && tpl.includes("serviceWorker") && tpl.includes('register("sw.js")'));

const csv = D.tilCsv(data.slice(0, 50));
const parsed = D.parseCsv(csv);
check("csv roundtrip: samme antal rækker", parsed.length === 50);
check("csv roundtrip: felter matcher", parsed[0].titel === data[0].titel && parsed[0].serie === data[0].serie && parsed[0].aar === String(data[0].aar) && parsed[0].mangler === String(data[0].mangler));
check("parseCsv: dansk header (år) mappes til aar", D.parseCsv("titel;år\nX;1989\n")[0].aar === "1989");
check("api.php findes", fs.existsSync(path.join(root, "api.php")));
check("template.html har import + api-token", tpl.includes('id="import"') && tpl.includes('id="api-token"'));

check("overlayTom: tomt overlay er tomt", D.overlayTom(D.tomtOverlay()) === true);
const ov2 = D.tomtOverlay();
ov2.tilfoejelser.push({ id: "ny-x", titel: "X" });
check("overlayTom: tilføjelse gør overlay ikke-tomt", D.overlayTom(ov2) === false);

if (failures) {
  console.error(failures + " test fejlede");
  process.exit(1);
}
console.log("Alle dashboard-tests bestået (" + data.length + " rækker)");
