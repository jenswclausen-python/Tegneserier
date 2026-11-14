# Tegneserier

Liste over mine tegneserier

## Dashboard

Åbn `dashboard.html` i en browser — filen er selvstændig (data og kode er indlejret), så den virker når som helst, også hvis du kun har den ene fil. Dashboardet har søgning (med Søg-knap og løbende filtrering) og filtre på titel, forfatter, serie, år, forlag og nummer i serie.

Alternativt kan du åbne `index.html`, der læser `comics-data.js` og `app.js` som separate filer — de skal så ligge samme sted. `dashboard.html` bygges automatisk af `scripts/build_single.py` (CI tjekker at den er i sync).

## Indtastning og redigering i dashboardet

Dashboardet kan også bruges til at tilføje, redigere og slette album direkte:

- **+ Tilføj album** åbner en formular (titel er påkrævet; forfatter, serie, nummer, år, forlag, kommentar og "mangler" er valgfrie)
- Hver række har **✎** (rediger) og **✕** (slet)
- Ændringer gemmes i browserens `localStorage` oven på data fra Excel — Excel-filen ændres ikke
- **⬇ Eksportér CSV** downloader hele den aktuelle liste (inkl. dine ændringer) som CSV med `;`-separator, klar til at kopiere ind i Excel
- **Nulstil mine ændringer** fjerner alle localStorage-ændringer

## Filer

- `index.html` — dashboardets side (UI)
- `app.js` — søgning, filtre, sortering og statistik (uden eksterne afhængigheder)
- `comics-data.js` — dine data, genereret fra Excel (genereret fil, rediger ikke manuelt)
- `Tegneserier oversigt 2.xlsx` — din oprindelige Excel-liste (source of truth)
- `scripts/xlsx_to_data.py` — konverterer Excel til `comics-data.js`
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
