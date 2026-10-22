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
| `manifest-varianten/` | Die 13 alternativen App-Symbole zur Auswahl in den Einstellungen. Standard ist `manifest.json` im Hauptordner. |
| `images/` | Bilder der App. |
| `Unterkuenfte_Fuerteventura.xlsx` | Arbeitsliste der Unterkünfte (Preise, Verfügbarkeit, Nummerierung). |
| `dossiers/` | PDF-Dossiers zu den engeren Unterkunfts-Favoriten. |
| `Recherche/` | Recherche-Notizen, Quellen und die Restaurant-Excel. |
| `Wetter Tool/` | Meteogramm-Baustein (Wetterdiagramme mit gemeinsamer Zeitachse), eigene README drin. |
| `_sicherungen/` | Sicherungskopien vor größeren Änderungen (Excel-Stände, Worker-Stand). |
| `_generator-quelle/` | Python-Skript und Fotos, mit denen die Villa-Unterseiten erzeugt wurden. |

## Wetter-Baustein (Meteogramm)

- **Heimat seit 21.10.2026:** `Wetter Apps/WetterPro Nachbauten/gemeinsam/meteogramm.js/.css`. Hier in `Wetter Tool/` liegt nur eine Kopie; Änderungen dort machen, dann im Nachbauten-Ordner `python3 meteogramm-holen.py` (kopiert hierher).
- **Stand 22.10.2026:** Baustein aus Nachbauten `81b6238` (Pfeilspitze am Auswahl-Strich, 11-px-Schrift, Vollbild als Blatt über dem ganzen Bildschirm mit „Fertig“/Esc/Zurück). Der eigene Vollbild-Melder der App (CSS-Klasse `vollbild` am `<html>`, blendete Kopf- und Fußleiste aus) ist entfernt, weil das Blatt das jetzt selbst erledigt.
- **Nach jedem Holen:** Versionsparameter `?v=` der beiden Einbindungen oben in `index.html` und `CACHE` in `sw.js` hochzählen, sonst lädt der Browser den alten Stand.
- **Test:** `node --test tests/sw-speicher.test.mjs` (Offline-Speicher). Lokal ansehen: `python3 -m http.server <port>` hier im Ordner; Fehler zum Sync-Server (`fuerte-sync…workers.dev`, „Access-Control“) sind lokal normal, der Server lehnt `localhost` ab (403).

## Andere Reisen in diesem Ordner

Liegen gesammelt in `Andere Reisen/`:

- `nizza-2026/` – Nizza & Côte d'Azur, 3.–7.09.2026, gleicher Aufbau wie die Fuerte-App (Test der Übertragbarkeit).
- `Nizza Reiseführer/` – Restaurant-Recherche dazu.
- `teneriffa-reise-2026.md` – Notizen Teneriffa.
