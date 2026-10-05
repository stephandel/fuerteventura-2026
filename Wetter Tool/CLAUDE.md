# Wetter-Tool – Arbeitsstand für neue Chats

Dieser Ordner ist das Wetter-Tool (Meteogramm) der Fuerteventura-Seite. Wer hier einen Chat startet,
findet unten alles, um nahtlos weiterzumachen. Die Bedienung und Einstellungen des Bausteins stehen in
`README.md`, ausführlichere Hintergründe im Gedächtnis des Projekts (Notizen `fuerte-meteogramm`,
`fuerte-webcams`, `fuerte-satellitenbilder`, `fuerte-mondbild`, `fuerte-offene-punkte`).

Stand: **05.10.2026**

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

## Konzepte vom 28.09.2026 (Ordner `konzepte/`) – hier geht es weiter

Stephan hat zwei Konzept-Seiten als Claude-Artifacts bekommen und will daran **weiterarbeiten**:

- **„Passat“ – Claudes Entwurf der perfekten Fuerteventura-Wetter-App** (ohne Vorgaben):
  Artifact https://claude.ai/artifact/Pc7yBycS2fhAy8U2hcirpw · Quelle `konzepte/passat.html`
  (Fotos über `../../images/`). Bausteine: Jetzt-Bild mit Foto je Tageszeit, „Was heute geht“
  (Strand/Wasser/Wind/Abend mit Zeitfenstern), Strand-Kompass (Inselkarte mit Note je Ort),
  Stundenverlauf mit Wochenkarte, 7 Tage, Tide-Uhr/Sonne/Mond, Windrose, Calima, Webcams.
  Beispieldaten. Schrift Fraunces + Plus Jakarta Sans, Sand/Nachtmeer, Türkis, Vulkan-Ocker.
- **Knopfleiste-Baukasten** (Knöpfe unter dem Diagramm): Artifact
  https://claude.ai/artifact/MZhaXet8yzKrUzycegFCVL · Quelle `konzepte/knopfleiste-baukasten.html`.
  Presets „So ist es heute“, „Claudes Vorschlag“ (Jetzt mittig, nur Rand, Türkis, Lupe halbdurchsichtig
  rechts unten im Diagramm + Zwei-Finger-Zoom, Extras) und „Claude pur“ (7-Tage-Übersichtskarte statt
  Pfeilen). Stephans Auswahl landet per „Auswahl speichern“ in der Artifact-Datenbank
  (`ArtifactData` get, collection `konzept`, doc `knopfleiste`). **Entschieden und umgesetzt 05.10.** (siehe unten).

Weiterarbeiten: Artifact per `read` mit der URL holen, ändern, mit `url` republishen; die Kopie in
`konzepte/` mitziehen (Seitengerüst `<!doctype html>` bleibt nur in der Repo-Kopie).
Fallstrick aus dem Bau: Scroll-Bereiche in Grid-Eltern brauchen `min-width: 0`, sonst wächst das
Diagramm endlos in die Breite.

## Offene Entscheidungen von Stephan

Keine – alle entschieden (siehe unten).

## Entschieden

- **Knopfleiste neu (05.10.2026, live, Version `20261005c`):** Stephans Wahl aus dem Baukasten: Anordnung *mitte*
  (↻ links, ‹ Jetzt › als Gruppe in einem Rahmen `.mg-gruppe` in der Mitte, ☰ rechts; Raster `auto 1fr auto`), Ecken sanft
  (`--mg-r: 11px`), Jetzt nur fett (kein Türkis mehr) mit Abstand „+14 h“ (`.mg-jrel`, `relKurz()`), Jetzt ruht (`disabled`)
  wenn der Strich auf jetzt steht. Zoom als `.mg-ecke` (− 🔍 +) rechts unten im Diagramm, halb durchsichtig; dazu
  Zwei-Finger-Geste (touchmove, je feiner Stufe ab 12 % Abstandänderung; `ZOOMS` hat seit 05.10. abends 9 Stufen mit
  Zwischenwerten 1,4 / 0,7 / 0,35 / 0,18 – Geste und Mausrad nehmen jede Stufe, die Knöpfe springen zwei) und Strg/⌘+Mausrad; `.mg-scroll` hat `touch-action: pan-x pan-y`.
  Extras: Rand-Pfeil `.mg-randpfeil` (links neben der Achse / rechts), Doppeltipp = jetzt (Einzeltipp wartet 280 ms),
  Zoom-Hinweis „3 Tage im Bild“ (900 ms), beide stehen in der Mitte des *sichtbaren* Ausschnitts (`--mg-sicht-mitte`,
  `sichtMitte()` bei Seiten-Scroll). Leiste haftet unten (`position: sticky; bottom: var(--mg-haft-unten)`; `../index.html`
  setzt die Variable auf die Höhe der Fußleiste + 6 px); das ☰-Menü klappt nach oben auf, wenn unten kein Platz ist
  (`is-oben`, gemessen beim Öffnen). Alle Zeichen als Inline-SVG (`ico()`/`SYMBOL`), keine Emojis mehr in der Leiste.
  **Fallstrick behoben:** „Zu jetzt“ scrollt sanft und lädt erst 650 ms später nach (`zuJetzt()`), sonst blieb das Diagramm
  auf halbem Weg stehen, wenn die Werte mitten im Scrollen ankamen. `knoepfeMittig` ist ohne Wirkung.
- **Zeile Saharastaub (05.10.2026, live):** `staub` im Katalog (`luft: true`, `farbskala: 'staub'`, Helfer `staubText`/`staubFarbe`),
  eigene Abfrage `air-quality-api.open-meteo.com` (`hourly=dust`, höchstens 7 Tage voraus – der 8. Tag bleibt leer) nur bei
  sichtbarer Zeile (`braucheStaub()`); Nachladen beim Einschalten über `neuZeichnenNachWahl`. Skala mindestens 0–200, Striche
  bei 50/150 (ab 400: 150/300). In `../index.html` in `zeilen` und `zeilenStandard`, bestehende Auswahl bekommt sie einmalig
  dazu (`fuerte-mg-staub-neu`), Version `20261005a`. Gehört zum Calima-Plan der Seite (Karte auf der Wetterseite, Planer, Startseite).

- **Zoom & Linien (28.09.2026, live):** Knopfpaar − 🔍 + in der Knopfleiste, Stufen 2 / 1 / ½ / ¼ / ⅛ (gemerkt im Browser, `zoom`); beim Herauszoomen werden Beschriftungen ausgedünnt. Tide: gepunktete Linie über die Hochwasser-Spitzen (`huelle`). Tide und Wasser: waagerechte Linie auf Höhe des gewählten Werts plus Zahl an der Achse (`wertlinie`). Auf Handys ≤480 px heißt der Knopf nur „Jetzt“.
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
