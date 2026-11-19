# Tegneserier

Liste over mine tegneserier

## Dashboard

Åbn **`index.html`** i en browser — filen er selvstændig (data og kode er indlejret), så den virker når som helst, også hvis du kun har den ene fil. Dashboardet har søgning (med Søg-knap og løbende filtrering) og filtre på titel, forfatter, serie, år, forlag og nummer i serie.

`index.html` er en genereret fil: den bygges af `scripts/build_single.py` ud fra skabelonen `template.html` + `comics-data.js` + `app.js` (CI tjekker, at den altid er i sync). Ret derfor i `template.html`/`app.js`, og kør `python3 scripts/build_single.py` bagefter.

Øverst vises en smal linje med totals (album, serier, forfattere, år, ikke-læst, mangler). Under den vises større bokse med statistik for de **aktuelle søgeresultater** — de er tomme, så længe der ikke er søgt/filtreret.

## Egen hosting: data gemmes på serveren (uagtet browser)

Dashboardet tjekker ved load om der findes en `api.php` samme sted (din egen hjemmeside):

- **GET `api.php`** → returnerer `data.json` (hele datasættet) — bruges som data-kilde, så alle browsere/enheder ser samme liste
- **POST `api.php`** (JSON-body = hele datasættet, header `Authorization: Bearer <token>`) → skriver `data.json`

På GitHub Pages findes `api.php` ikke, så dashboardet falder automatisk tilbage til localStorage (+ CSV-eksport/import).

Opsætning på egen host (f.eks. et webhotel med PHP):

```bash
cp api.php index.html manifest.webmanifest sw.js icon-192.png icon-512.png /din/mappe/
python3 scripts/export_json.py        # laver data.json ud fra comics-data.js
echo "dit-hemmelige-token" > api-secret.txt   # vælg et langt tilfældigt token
```

Beskyt token-filen, f.eks. via `.htaccess` i samme mappe:

```
<Files "api-secret.txt">
  Require all denied
</Files>
```

I dashboardet sættes token i feltet "API-token" (gemmes kun i browserens localStorage, aldrig i repoet). Status-linjen under knapperne viser om der gemmes på server eller lokalt — i server-tilstand vises "synkroniseret ✓ kl. …" eller "afventer synkronisering ⏳ (N ændringer lokalt)". Ændringer lavet offline gemmes lokalt og synkroniseres automatisk, når der igen er net (eller ved næste load). Bemærk: ved samtidige redigeringer fra flere enheder vinder seneste gemte datasæt (last-write-wins). `scripts/export_json.py` konverterer `comics-data.js` til `data.json`.

## Indtastning og redigering i dashboardet

Dashboardet kan også bruges til at tilføje, redigere og slette album direkte:

- **+ Tilføj album** åbner en formular (titel er påkrævet; forfatter, serie, nummer, år, forlag, kommentar og "mangler" er valgfrie)
- Hver række har **✎** (rediger) og **✕** (slet)
- Ændringer gemmes i browserens `localStorage` oven på data fra Excel — Excel-filen ændres ikke
- **⬇ Eksportér CSV** downloader hele den aktuelle liste (inkl. dine ændringer) som CSV med `;`-separator, klar til at kopiere ind i Excel
- **Nulstil mine ændringer** fjerner alle localStorage-ændringer

## Filer

- `index.html` — dashboardet som selvstændig enkeltfil (genereret — åbn denne)
- `template.html` — HTML-skabelon til `index.html` (ret i denne ved ændringer)
- `app.js` — søgning, filtre, sortering og statistik (uden eksterne afhængigheder)
- `comics-data.js` — dine data, genereret fra Excel (genereret fil, rediger ikke manuelt)
- `Tegneserier oversigt 2.xlsx` — din oprindelige Excel-liste (source of truth)
- `scripts/xlsx_to_data.py` — konverterer Excel til `comics-data.js`
- `scripts/build_single.py` — bygger `index.html` fra `template.html` + data + kode
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` — gør siden til en installerbar webapp (PWA): på telefonen åbner du `https://jenswclausen-python.github.io/Tegneserier/` og vælger "Tilføj til hjemmeskærm"; appen virker også offline. Ikoner genereres med `scripts/make_icons.py` (kræver `pillow`)
- `scripts/test_dashboard.js` — logik-tests (køres af CI)
- `.github/workflows/dashboard-check.yml` — CI: tjekker at `comics-data.js` er i sync med Excel, syntakstjekker `app.js` og kører tests

## Opdatér data

Når du har rettet i Excel-filen:

```bash
pip install openpyxl
python3 scripts/xlsx_to_data.py "Tegneserier oversigt 2.xlsx"
```

Genindlæs derefter `index.html` i browseren.

Scriptet læser alle ark i Excel-filen, slår dubletter sammen (på forfatter + serie + nummer + titel) og skriver kolonnerne `Forfatter`, `serie`, `nummer`, `titel`, `Kommentarer`, `år` samt forlag/note-kolonner til `comics-data.js`.

### Manglende album

- Rækker markeret med **gul** cellefarve i Excel læses som `mangler: true` — de vises med gul baggrund i tabellen og kan filtreres frem med "Kun manglende".
- Scriptet finder også **huller i serier**: for hver serie med mindst 3 numre og mindst 60 % dækning af nummerintervallet tilføjes pladsholder-rækker (titel "(mangler)", kommentar "Mangler i serien") for de manglende numre. De er også omfattet af "Kun manglende"-filteret. Konstante `HUL_MIN_OWNED` og `HUL_MIN_COVERAGE` i scriptet styrer dette.
- Serie-navne normaliseres via `SERIE_ALIAS` i scriptet (f.eks. "Agent 328"–"Agent 333" slås sammen til "Agent 327"), så varianter på tværs af ark ikke tæller som flere serier.
- Samlebind med titel "Den Store …" flyttes automatisk fra hovedserien til en eksisterende "<serie> - samlede"-serie (f.eks. "Den Store Asterix 1–8" → "Asterix - samlede"), så de ikke både ligger i hovedserien og som dubletter i samlede-serien.
