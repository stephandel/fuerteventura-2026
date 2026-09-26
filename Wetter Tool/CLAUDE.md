# Wetter-Tool – Arbeitsstand für neue Chats

Dieser Ordner ist das Wetter-Tool (Meteogramm) der Fuerteventura-Seite. Wer hier einen Chat startet,
findet unten alles, um nahtlos weiterzumachen. Die Bedienung und Einstellungen des Bausteins stehen in
`README.md`, ausführlichere Hintergründe im Gedächtnis des Projekts (Notizen `fuerte-meteogramm`,
`fuerte-webcams`, `fuerte-satellitenbilder`, `fuerte-mondbild`, `fuerte-offene-punkte`).

Stand: **25.09.2026**

## Für wen

Stephan hat kaum Technik-Kenntnisse: einfache Sprache, Fachbegriffe erklären, keine Rückfragen zu
Dingen, die man selbst prüfen kann. Handy zuerst. Optik ruhig und aufgeräumt – **keine Kacheln,
keine Pillen, nicht „zu rund“**.

## Dateien

| Datei | Zweck |
|---|---|
| `meteogramm.js` / `meteogramm.css` | Der Baustein selbst. Weiß nichts von Fuerteventura. |
| `demo.html` | Zum Ausprobieren ohne die große Seite. |
| `entwurf.html` | Zeigt den Baustein allein, mit Hell/Dunkel-Schalter (früher Gestaltungs-Labor). |
| `schriftprobe.html` | 18 Schriften für die Zahlen zur Auswahl (Nr. 18 = Arial). |
| `wetterkopf-probe.html` | Probeseite für den großen Wetterkasten oben auf der Wetterseite: 4 Hintergründe × 5 Aufbauten × 9 Schriften, Simulator für Wetter/Tageszeit. Fotos `../images/wx-*.webp`. |
| `wetterseite-entwurf.html` | Entwurf der ganzen Wetterseite mit den 5 Punkten vom 26.09. (echte Wassertemperatur, Zeile `wasser`, `tagesSymbol`, `mond`, `tipps`), Umschalter „Bisher (live)“ als iframe. |
| `../index.html` | Die Fuerteventura-Seite; ruft `Meteogramm.einbauen({...})` mit Orten, Zeilen, Kameras auf. |
| `../worker/fuerte-sync.js` | Cloudflare-Worker: speichert stündlich Webcam-Bilder (Bildspeicher). |

Live: https://stephandel.github.io/fuerteventura-2026/Wetter%20Tool/entwurf.html und
`…/schriftprobe.html`. Veröffentlichen = `git push` im Oberordner (GitHub Pages). Achtung: Alles in
diesem Ordner wird mit veröffentlicht (Positivliste in `../.gitignore`), also auch diese Datei.

## Offene Entscheidungen von Stephan

1. **Wetterkopf (`wetterkopf-probe.html`, gebaut 26.09.2026)** – Stephan nennt „Hintergrund A–D · Aufbau 1–5 ·
   Schrift 1–9 · Ecken“ (steht unten auf der Seite). Empfehlung: Hintergrund D (Foto + Bewegung), Aufbau 2
   (Tageskurve), Schrift 4 (Inter dünn). Umsetzung dann in `../index.html` (`.wx-hero`, `renderWx…` um Zeile 4690);
   Bild-Logik `fotoFuer()`, Himmel-Zeichner `Himmel`, Kurven `tageskurve()` usw. aus der Probeseite übernehmen.
   Calima: Open-Meteo Air-Quality `current=dust`, ab 100 µg/m³ gilt es als Calima.
2. **Wetterseite-Entwurf (`wetterseite-entwurf.html`, gebaut 26.09.2026)** – Stephan schaut ihn an. Die
   Neuerungen stecken schon im Baustein, sind aber nur per Einstellung an (`tagesSymbol`, `mond`, `tipps`,
   Zeile `wasser`); die Live-Seite nutzt sie noch nicht. Übernehmen heißt in `../index.html`: Optionen im
   `Meteogramm.einbauen({...})` setzen (Tipps-Liste aus dem Entwurf kopieren), `'druck'` durch `'wasser'`
   ersetzen, `#wx-days-card` und `#wx-tiles` samt Code entfernen, Wassertemperatur live in den Wetterkasten
   (Marine `current=sea_surface_temperature`). Versionskennung hochzählen.

## Entschieden

- **Aufbau (25.09.2026, fest im Baustein):** Bild unten, Werte „am Strich“, Knöpfe unten,
  Datumsfahne haftet beim Scrollen. Reihenfolge im Baustein: Reiter → Fahne (`.mg-readout`, sticky)
  → Werteliste mit Mittelstrich → Diagramm → Bildreiter + Bild → Knöpfe → Fußzeile. `.mg-head` gibt
  es nicht mehr; `.mg` hat `overflow: visible`, sonst haftet die Fahne nicht. Abstand nach oben über
  `--mg-haft-oben`; `../index.html` setzt ihn auf die Höhe der Menüleiste. Das Zeilen-Menü ☰ klappt
  nach oben auf. Zusatzzeile (Böen, gefühlt …) bleibt an.
- **Schrift für die Zahlen (25.09.2026):** Arial (Nr. 18 der Schriftprobe), gesetzt über `--mg-mono`
  in `meteogramm.css`. Kein Download nötig; der JetBrains-Mono-Link in `../index.html` bleibt, weil
  die Seite ihn an anderen Stellen nutzt.
- **Mond-Kachel (25.09.2026, in `../index.html`):** im hellen Modus kräftiger (Foto abgedunkelt,
  Deckkraft 0,85). Darunter steht der nächste Voll- oder Neumond mit genauer Uhrzeit in Ortszeit
  (`naechsteMondphase()`, Rechnung nach Meeus, geprüft gegen die US-Sternwarte USNO: auf die Minute gleich).

## Offene technische Punkte

- **Webcam-Bilder halbstündlich (26.09.2026):** Worker speichert unter `t = …T14:00` bzw. `…T14:30`
  (`ortsHalbstunde()`), Cron im Dashboard muss `5,35 * * * *` sein. Das Tool frischt zu `bildMinute` und
  30 Min. später auf und zeigt das nächstliegende Bild (höchstens 45 Min. entfernt).
  **Eingespielt am 26.09.2026** (Code von Stephan, Cron `5,35 * * * *` per Browser gesetzt); `/webcam/jetzt`
  lieferte danach vier Orte mit `t = …T09:30`. Prüfen: `…/webcam?ort=corralejo` zeigt `:00`- und `:30`-Einträge.
- **Kein Platzhalterbild (geprüft 26.09.):** Skyline (Corralejo) liefert öffentlich nur eine kleine Vorschau
  (344 × 193 Pixel, ~5 KB), aber echt und aktuell. Die zwei gleich großen Bilder vom 24.09. kamen vermutlich
  daher, dass die alte Worker-Fassung auch El Cotillo über Skyline holte. MeteoSurf liefert 640 × 480.
- **Mondbild-Pfad gilt nur für 2026** (NASA-Datensatz a005587); für 2027 den neuen Datensatz suchen,
  sonst greift das SVG als Rückfall.

## Regeln, die sich bewährt haben

- **Versionskennung** `meteogramm.js?v=…` / `.css?v=…` in `../index.html` bei jeder Änderung hochzählen,
  sonst zeigt das iPhone tagelang alte Kopien.
- Ordnername hat ein Leerzeichen → in Adressen `Wetter%20Tool`.
- Kameras stehen doppelt: `KAMERAS` in `meteogramm.js` und `WEBCAMS` im Worker – beide müssen passen.
- Uhrzeiten in den Daten sind Ortszeit; für den Bildserver über `ortszeitNachEcht()` umrechnen.
- ECMWF und ICON liefern keinen UV-Index; der Baustein holt ihn separat.
- CSS-Blöcke nie „bis zum nächsten Kommentar“ ersetzen – dabei gingen schon Regeln verloren.
- Handy-Test über eine Wegwerf-Seite mit `<iframe width=390>`; beim Prüfen `?cb=<zeit>` anhängen
  (Service Worker und Zwischenspeicher liefern gern alte Dateien).
- Labor-Fallen: Raster brauchen `minmax(0,1fr)`/`min-width:0`; `position:sticky` haftet nicht in
  `.mg { overflow:hidden }`.
