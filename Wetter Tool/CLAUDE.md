# Wetter-Tool – Arbeitsstand für neue Chats

Dieser Ordner ist das Wetter-Tool (Meteogramm) der Fuerteventura-Seite. Wer hier einen Chat startet,
findet unten alles, um nahtlos weiterzumachen. Die Bedienung und Einstellungen des Bausteins stehen in
`README.md`, ausführlichere Hintergründe im Gedächtnis des Projekts (Notizen `fuerte-meteogramm`,
`fuerte-webcams`, `fuerte-satellitenbilder`, `fuerte-mondbild`, `fuerte-offene-punkte`).

Stand: **27.09.2026**

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
| `wetterseite-entwurf.html` | Entwurf der ganzen Wetterseite mit 7 Punkten vom 26.09. (⑥ Knöpfe mittig, ⑦ Zeitraffer) (echte Wassertemperatur, Zeile `wasser`, `tagesSymbol`, `mond`, `tipps`), Umschalter „Bisher (live)“ als iframe. |
| `../index.html` | Die Fuerteventura-Seite; ruft `Meteogramm.einbauen({...})` mit Orten, Zeilen, Kameras auf. |
| `../worker/fuerte-sync.js` | Cloudflare-Worker: speichert stündlich Webcam-Bilder (Bildspeicher). |

Live: https://stephandel.github.io/fuerteventura-2026/Wetter%20Tool/entwurf.html und
`…/schriftprobe.html`. Veröffentlichen = `git push` im Oberordner (GitHub Pages). Achtung: Alles in
diesem Ordner wird mit veröffentlicht (Positivliste in `../.gitignore`), also auch diese Datei.

## Offene Entscheidungen von Stephan

Keine – alle entschieden (siehe unten).

## Entschieden

- **Reihenfolge (28.09.2026, live):** Knopfleiste (↻ ‹ Jetzt zentrieren › ☰) direkt unter dem Diagramm, darunter Webcam/Satellit/Regen, ganz unten „Was der Tag bringt“. Das ☰-Menü klappt deshalb nach unten auf.
- **Wetterkasten oben (27.09.2026, live):** Stephans Wahl aus `wetterkopf-probe.html`: Hintergrund D (Foto je
  Wetterlage + ziehende Wolken/Regen/Wetterleuchten/Calima-Dunst als Canvas), Aufbau 2 (Tageskurve Temperatur +
  Tide), Schrift 4 (Inter 200), Ecken sanft (12 px). In `../index.html` als gekapselter Block `WETTERKOPF`
  (Code aus der Probeseite übernommen: `fotoFuer`, `Himmel` im Überlagerungsmodus, `tageskurve`);
  `renderWxHero(d)` reicht nur noch die Daten weiter. Tide, Wassertemperatur und Saharastaub holt der Kasten
  selbst (Marine + Air-Quality, alle 30 Min.). Fotos `../images/wx-*.webp` + `strand-tuerkis.webp`.
  Sicherung: `../_sicherungen/index_vor-wetterkopf_2026-09-27.html`.
  **Nachtrag:** Stephan meinte eigentlich die Startseite. Jetzt gibt es zwei Kästen mit `class="wkopf"`, die
  `WETTERKOPF.malen()` beide füllt (je eigener `Himmel`): **Startseite** `#home-weather.home-kopf` mit Kurve,
  darunter nur noch die Tagesleiste und der Sonnenuntergangs-Hinweis (`renderHomeSun`; `sneak-now` sowie die
  Kästchen Sonnenzeiten/Hoch-/Niedrigwasser `sneak-sun` entfallen dort – Stephan: „sonst zu riesig“);
  **Wetterseite** `#wx-hero.ohne-kurve` ohne Linien (Stephans Wunsch – die Kurven stehen im Wetter-Tool).
  Sicherung davor: `../_sicherungen/index_vor-startseiten-wetter_2026-09-27.html`.

- **Wetterseite verschlankt (27.09.2026, live):** Entwurf `wetterseite-entwurf.html` 1:1 übernommen. In
  `../index.html`: `#wx-days-card` und `#wx-tiles` samt `renderWxDays`/`renderWxTiles`, Mond-Kachel
  (NASA-Foto, Meeus-Rechnung) und deren CSS entfernt; Wassertemperatur live im Wetterkasten
  (`wasserTemperatur()`, Marine `current=sea_surface_temperature`). Wetter-Tool mit `tagesSymbol`, `mond`,
  `knoepfeMittig`, `filmLeiste`, `tipps` und Zeile `wasser` statt `druck`; wer schon eine Zeilenauswahl
  gespeichert hatte, bekommt `wasser` einmalig dazu (`fuerte-mg-wasser-neu`). Sicherung:
  `../_sicherungen/index_vor-wetterseite-schlank_2026-09-27.html`. Der Entwurf bleibt als Spielwiese.

- **Aufbau (25.09.2026, fest im Baustein):** Bild unten, Werte „am Strich“, Knöpfe unten,
  Datumsfahne haftet beim Scrollen. Reihenfolge im Baustein: Reiter → Fahne (`.mg-readout`, sticky)
  → Werteliste mit Mittelstrich → Diagramm → Bildreiter + Bild → Knöpfe → Fußzeile. `.mg-head` gibt
  es nicht mehr; `.mg` hat `overflow: visible`, sonst haftet die Fahne nicht. Abstand nach oben über
  `--mg-haft-oben`; `../index.html` setzt ihn auf die Höhe der Menüleiste. Das Zeilen-Menü ☰ klappt
  nach oben auf. Zusatzzeile (Böen, gefühlt …) bleibt an.
- **Schrift für die Zahlen (25.09.2026):** Arial (Nr. 18 der Schriftprobe), gesetzt über `--mg-mono`
  in `meteogramm.css`. Kein Download nötig; der JetBrains-Mono-Link in `../index.html` bleibt, weil
  die Seite ihn an anderen Stellen nutzt.
- **Mond (seit 27.09.2026 im Wetter-Tool):** Die Mond-Kachel ist entfallen. Mondphase und Uhrzeit von
  Neumond/Viertel/Vollmond stehen im Tagesfuß der Sonnenzeile (`mond: true`, Rechnung nach Meeus in
  `meteogramm.js`, geprüft gegen die US-Sternwarte USNO: auf die Minute gleich).

## Offene technische Punkte

- **Webcam-Bilder halbstündlich (26.09.2026):** Worker speichert unter `t = …T14:00` bzw. `…T14:30`
  (`ortsHalbstunde()`), Cron im Dashboard muss `5,35 * * * *` sein. Das Tool frischt zu `bildMinute` und
  30 Min. später auf und zeigt das nächstliegende Bild (höchstens 45 Min. entfernt).
  **Eingespielt am 26.09.2026** (Code von Stephan, Cron `5,35 * * * *` per Browser gesetzt); `/webcam/jetzt`
  lieferte danach vier Orte mit `t = …T09:30`. Prüfen: `…/webcam?ort=corralejo` zeigt `:00`- und `:30`-Einträge.
- **Kein Platzhalterbild (geprüft 26.09.):** Skyline (Corralejo) liefert öffentlich nur eine kleine Vorschau
  (344 × 193 Pixel, ~5 KB), aber echt und aktuell. Die zwei gleich großen Bilder vom 24.09. kamen vermutlich
  daher, dass die alte Worker-Fassung auch El Cotillo über Skyline holte. MeteoSurf liefert 640 × 480.

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
