# Tegneserier

Liste over mine tegneserier

## Dashboard

Åbn `index.html` i en browser — så vises dashboardet med søgning og filtre på titel, forfatter, serie, år, forlag og nummer i serie. Der skal ikke køres nogen server; siden læser data fra `comics-data.js`.

## Filer

- `index.html` — dashboardets side (UI)
- `app.js` — søgning, filtre, sortering og statistik (uden eksterne afhængigheder)
- `comics-data.js` — dine data, genereret fra Excel (genereret fil, rediger ikke manuelt)
- `Tegneserier oversigt 2.xlsx` — din oprindelige Excel-liste (source of truth)
- `scripts/xlsx_to_data.py` — konverterer Excel til `comics-data.js`

## Opdatér data

Når du har rettet i Excel-filen:

```bash
pip install openpyxl
python3 scripts/xlsx_to_data.py "Tegneserier oversigt 2.xlsx"
```

Genindlæs derefter `index.html` i browseren.

Scriptet læser alle ark i Excel-filen, slår dubletter sammen (på forfatter + serie + nummer + titel) og skriver kolonnerne `Forfatter`, `serie`, `nummer`, `titel`, `Kommentarer`, `år` samt forlag/note-kolonner til `comics-data.js`.
