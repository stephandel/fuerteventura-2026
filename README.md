# Fuerteventura Reiseplaner · Herbst 2026

Reiseplaner-Web-App (PWA) für den Fuerteventura-Urlaub, gemeinsam genutzt von zwei Personen.
Unterkünfte, Ausflüge, Gastro, Wetter mit Tiden, To-do- und Packliste, Kalender, Kosten.

## Wo läuft was

| Was | Wo |
|---|---|
| Live-Seite | https://stephandel.github.io/fuerteventura-2026/ (GitHub Pages) |
| Code-Repo | https://github.com/stephandel/fuerteventura-2026 (Branch `main`) |
| Geteilte Daten (Favoriten, Haken, Notizen, Webcam-Bilder) | Cloudflare Worker `fuerte-sync` + D1-Datenbank, https://fuerte-sync.stephanhandel.workers.dev |
| Cloudflare-Konto | dash.cloudflare.com, Account `Stephanhandel@googlemail` (Worker unter Workers & Pages → fuerte-sync) |

**Veröffentlichen** = `git push origin main`, nach 30–60 Sekunden ist es live. Die `.gitignore`
ist eine Positivliste: nur `index.html`, `README.md`, `manifest.json`, `sw.js` und `images/`
landen online. Alles andere in diesem Ordner bleibt lokal.

## Was ist was

| Datei / Ordner | Bedeutung |
|---|---|
| `index.html` | **Die aktuelle App.** Einzige Datei, die gepflegt wird. |
| `worker/` | Code des Cloudflare Workers (`fuerte-sync.js`) und Tabellenschema (`schema.sql`). Wird im Cloudflare-Dashboard eingefügt, nicht per Kommandozeile. |
| `manifest.json`, `sw.js`, `favicon.ico` | PWA-Dateien (Home-Bildschirm-Symbol, Offline-Cache). |
| `manifest-*.json` | Alternative App-Symbol-Varianten aus der Auswahlrunde. Nur `manifest.json` ist aktiv. |
| `images/` | Bilder der App. |
| `Unterkuenfte_Fuerteventura.xlsx` | Arbeitsliste der Unterkünfte (Preise, Verfügbarkeit, Nummerierung). |
| `dossiers/` | PDF-Dossiers zu den engeren Unterkunfts-Favoriten. |
| `fuerteventura-reise-2026.md`, `fuerteventura-quellen.md`, `Recherche Quellen Fuerteventura.md`, `Fuerteventura_Quellen_Linkverzeichnis_2026.md` | Recherche-Notizen und Quellen. |
| `Wetter Tool/` | Meteogramm-Baustein (Wetterdiagramme mit gemeinsamer Zeitachse), eigene README drin. |
| `_sicherungen/` | Sicherungskopien vor größeren Änderungen (Excel-Stände, Worker-Stand). |
| `_generator-quelle/` | Python-Skript und Fotos, mit denen die Villa-Unterseiten erzeugt wurden. |
| `fuerteventura-reiseplaner.html`, `Fuerteventura Urlaubsplaner.html` | Ältere Stände vom 28.08., überholt durch `index.html`. |
| `*.png` im Hauptordner | Screenshots aus dem Testen (Mobile-Ansichten, Karten, Kosten). Können weg. |

## Andere Reisen in diesem Ordner

- `nizza-2026/` – Nizza & Côte d'Azur, 3.–7.09.2026, gleicher Aufbau wie die Fuerte-App (Test der Übertragbarkeit).
- `Nizza Reiseführer/` – Restaurant-Recherche dazu.
- `teneriffa-reise-2026.md` – Notizen Teneriffa.
