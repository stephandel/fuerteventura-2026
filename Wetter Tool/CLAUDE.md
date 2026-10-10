# Wetter-Tool – Arbeitsstand für neue Chats

Dieser Ordner ist das Wetter-Tool (Meteogramm) der Fuerteventura-Seite. Wer hier einen Chat startet,
findet unten alles, um nahtlos weiterzumachen. Die Bedienung und Einstellungen des Bausteins stehen in
`README.md`, ausführlichere Hintergründe im Gedächtnis des Projekts (Notizen `fuerte-meteogramm`,
`fuerte-webcams`, `fuerte-satellitenbilder`, `fuerte-mondbild`, `fuerte-offene-punkte`).

Stand: **09.10.2026**

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

- **Kopfteil-Baukasten (05.10.2026 abends, offen):** Reiter + Fahne + Werteliste kompakter. Artifact
  https://claude.ai/artifact/SaafPAzNcUMMEdWcsWF9KG · Quelle `konzepte/kopfteil-baukasten.html`. Gruppen: Reiter
  (zwei/eine/menue), Fahne (zwei/eine/klein), Spalten (eine/zwei/raster/zeile), Dichte (luftig/dicht/eng), Zusatz
  (alle/wichtig/keine), Umfang (alle/klug/klappe/wenige), Extras (paare/fahnedicht/flach). Maßband misst die Kopfhöhe
  gegen „heute“ (650 px) und den iPhone-Bildschirm (≈ 680 px). Preset „Claudes Vorschlag“ = eine/eine/zwei/dicht/wichtig/
  klug + paare, fahnedicht → 218 px (−66 %). Auswahl landet in `ArtifactData` get, collection `konzept`, doc `kopfteil`
  (oder Stephan fügt den „Schlüssel“ im Chat ein). **Entschieden und umgesetzt 05.10. spät (siehe unten).**

Weiterarbeiten: Artifact per `read` mit der URL holen, ändern, mit `url` republishen; die Kopie in
`konzepte/` mitziehen (Seitengerüst `<!doctype html>` bleibt nur in der Repo-Kopie).
Fallstrick aus dem Bau: Scroll-Bereiche in Grid-Eltern brauchen `min-width: 0`, sonst wächst das
Diagramm endlos in die Breite.

## Offene Entscheidungen von Stephan

Keine – alle entschieden (siehe unten).

## Entschieden

- **☰-Zeilenfenster gespiegelt (10.10.2026, Version `20261010a`, Probe auf Stephans Wunsch):** `.mg-zeilen-panel` sitzt
  rechts unter/über dem ☰-Knopf (`right: 8px; left: auto`, auch auf dem Handy – die alte Regel `left/right: 14px` ist weg),
  `width: max-content` (≈ 239 px, so breit wie „Saharastaub (Calima)“ + Haken + Griff), `.mg-zeile` und `label` mit
  `flex-direction: row-reverse` (Griff ⠿ ganz rechts, dann Haken, Farbpunkt, Name rechtsbündig), Überschrift zweizeilig
  (`<h4>Welche Zeilen?<small>Zum Umsortieren ziehen</small>`), Hintergrund `color-mix(… 70 %, transparent)` (Stephan: „30 % durchsichtig“, Version `20261010b`) plus
  `backdrop-filter: blur(12px)`. **Version `20261010c`:** klappt **immer nach oben** auf (`is-oben` fest in `zeilenPanel()`,
  die Messung „Platz unten?“ ist weg), Höchsthöhe `calc(100dvh - var(--mg-haft-oben) - 80px)` statt `min(62vh, 470px)`,
  damit alle 11 Zeilen (≈ 500 px) ohne Scrollen passen; kurze Aufklapp-Animation `mg-auf` (Ursprung unten rechts). Rückbau: diese CSS-Regeln auf den Stand vor Commit „Zeilenfenster gespiegelt“ setzen.
- **Fahne hinter der Menüleiste + Fragezeichen im Regenbild (09.10.2026, Version `20261009a`):** Zwei Fehler von
  Stephans iPhone-Screenshot (Seite als App vom Startbildschirm, Safe-Area oben ≈ 47 px). (1) Außerhalb des Vollbilds
  war der schwarze Kasten mit Datum/Uhrzeit (`.mg-zeit`) nicht zu sehen – er klebte **hinter** der Menüleiste, nur die
  Werte-Zeile schaute heraus. Ursache: `../index.html` maß `nav.offsetHeight` nur einmal beim Start, und iOS kennt den
  Safe-Area-Streifen in dem Moment noch nicht (Leiste wird erst danach um die Safe-Area höher). Jetzt: `fahnenAbstand()`
  misst `getBoundingClientRect().height`, ein `ResizeObserver` mit `{ box: 'border-box' }` (wichtig: content-box sieht den
  Padding-Zuwachs nicht) auf Menü- und Fußleiste, dazu hashchange/pageshow/visibilitychange und zwei verzögerte Messungen
  (400/1500 ms). Nachgestellt mit Playwright: Padding nachträglich auf 47 px → `--mg-haft-oben` springt von 65 auf 112 px.
  (2) Der blaue Kasten mit „?“ mitten im Regenbild ist Safaris Zeichen für ein Bild, das nicht lädt: EUMETSAT lieferte
  am 09.10. abends für die Regen-Auflage `mtg_fd:h40b` (und zeitweise auch für das Basisbild) **HTTP 500** bei den
  jüngsten Zeitpunkten, obwohl GetCapabilities Daten bis 21:00Z versprach; Bilder von 15:00Z kamen. Jetzt in
  `meteogramm.js`: `auflageLaden(zeit)` blendet die Auflage aus, bis `load` feuert; bei `error` probiert das Tool bis zu
  6 Bilder (= 1 Std.) früher (`auflageVersuch`), die Unterschrift bekommt dann „· Regen 21:20“ (`auflageHinweis()`,
  `.mg-k-hinweis`), nach 7 Fehlschlägen „· kein Regenbild“ und die Auflage bleibt verborgen. Getestet mit `page.route`
  (500 ab 20:30Z → Rückfall auf 20:20Z; alles 500 → Hinweis, kein Kasten). Unterschrift bleibt bei 390 px einzeilig.
- **Vollbild statt Safari-Logik (07.10.2026, live, Version `20261007a`):** Die Scroll-Automatik vom Vormittag ist
  wieder raus (Stephan: lieber bewusst schalten). Jetzt: Knopf ⤢ `.mg-btn-voll` in der Knopfleiste (rechts neben der
  Jetzt-Gruppe, vor ☰; Raster `minmax(max-content,1fr) auto minmax(max-content,1fr)`, Rechtsgruppe `.mg-rechts`),
  **Doppeltipp auf die Lupe** (`#lupe` ist jetzt ein Button, 350 ms) und im Vollbild ein **× oben rechts**
  (`.mg-vollbild-x`, fixed). `vollbildSetzen(an)` setzt `mg-vollbild` am Baustein und ruft `cfg.vollbild(an)`;
  `../index.html` schaltet damit die Klasse `vollbild` am `<html>`: Kopfzeile/Fußleiste per `transform` weg,
  `--mg-haft-oben` = Safe-Area oben (Streifen für Notch/Uhrzeit per `body::before` abgedeckt), `--mg-haft-unten` = 0,
  Knopfleiste bekommt `padding-bottom` + Safe-Area unten und sitzt ganz am Bildschirmrand („so tief wie möglich“),
  Lupe rutscht entsprechend mit. Seitenwechsel (hashchange) beendet das Vollbild (`FUERTE_MG.vollbild(false)`).
  **08.10.:** Auf dem Handy (≤ 560 px) nutzt das Tool **immer** die volle Breite (erst nur im Vollbild, dann auf Stephans Wunsch generell): `#meteogramm` mit
  `margin: 0 -20px`, ohne Seitenrahmen und Ecken (CSS in `../index.html`); das Diagramm zeichnet sich über den
  ResizeObserver neu und behält die Stelle. 390 statt 350 px → gut eine Stunde mehr im Bild.
  **08.10. nachmittags (Version `20261008b`):** Im Vollbild haftet die Leiste mit `bottom: env(safe-area-inset-bottom)`
  (`--mg-haft-unten`, in `.mg-vollbild` und `html.vollbild #meteogramm` mit `!important`), also knapp **über** dem
  iPhone-Home-Balken, nie darauf. Kein `padding-bottom` mehr – das hatte beim Scrollen eine Übergangszone, in der die
  Leiste ohne Polster auf dem Balken lag (Stephans Beobachtung „liegt über dem schwarzen Anzeiger“), und stand als
  leerer Streifen auch unter der Leiste, wenn das Tool weggescrollt war („roter Abstand“). Haftet die Leiste wirklich
  (Klasse `is-haftend`: Fühler `.mg-haft-fuss` direkt unter der Leiste, gemessen bei scroll/resize per rAF – Leiste ist dann
  von ihrer normalen Stelle nach oben verschoben), zieht `::after` die Leistenfarbe bis zum Bildschirmrand. Getestet mit
  nachgestellter Safe-Area 34 px: Abstand nie unter 34 px, Klasse stets passend.
  **08.10. abends (Version `20261008c`):** Die Fahne `.mg-readout` hat jetzt `z-index: 8` (über der Knopfleiste 7):
  scrollt man am Tool vorbei, taucht die Leiste **unter** der Fahne durch, statt sie zu verdecken (Stephan: „liegt über
  dem schwarzen Anzeiger“). Die Fahne bleibt in beiden Modi oben kleben, solange irgendein Teil des Tools im Bild ist
  (Stephans ausdrücklicher Wunsch – ein Versuch, Fahne + Diagramm in einen Kasten `.mg-oben` zu stecken, damit sie mit dem
  Diagramm verschwindet, wurde deshalb wieder zurückgenommen). Ist das ☰-Menü offen, fällt die Fahne auf `z-index: 5`
  (`.mg:has(.mg-zeilen-panel:not([hidden]))`), damit das nach oben aufklappende Menü nicht verdeckt wird.
  **08.10. spät (Version `20261008d`):** Bildunterschrift (`.mg-cam-text`, Webcam und Satellit) ist immer einzeilig:
  Flex, `white-space: nowrap`; der Name im `<b>` kürzt sich mit …, Uhrzeit/Quelle stehen in `.mg-cam-rest` und bleiben ganz.
  Vorher brach „… · 08.10. 18:30 · SkylineWebcams ↗“ auf dem iPhone in zwei Zeilen um (Stephan: „stört das Bild“).
  Version `20261008e`: Datum vor der Uhrzeit nur, wenn das Bild von einem anderen Tag stammt als der Strich – so passt
  „Grandes Playas, Corralejo · 22:00 · SkylineWebcams ↗“ auch bei 390 px ungekürzt.
  **Version `20261008f`:** Die Punkte auf den Kurven liegen nicht mehr im SVG (dort verdeckte sie der schwarze Strich),
  sondern als `<i class="mg-wpunkt">` in der Ebene `.mg-punkte` direkt nach `.mg-cursor` in `.mg-wrap`; `punktFuer(z)` legt
  sie bei Bedarf an, `zeichnen()` leert die Ebene, `wertlinienSetzen()` setzt left = `el.cursor.offsetLeft`, top = y.
  Achtung: `.mg-punkt` (ohne w) sind die Farbpunkte im ☰-Menü – nicht verwechseln. `elementFromPoint` taugt wegen
  `pointer-events: none` nicht als Test für die Ebenenfolge; stattdessen Zoom-Screenshot.
- **Sonnenschein aus der Sonnenkraft (06.10.2026, live, Version `20261006b`):** Open-Meteos `sunshine_duration` zählt
  fast jede helle Stunde voll (Schwelle auf den Stundenmittelwert → „Zaun“ aus 60-Minuten-Balken, Tagessumme ≈ Tageslänge).
  Jetzt rechnet `sonneMinuten(direkt, terr)`: `direct_radiation` / (`terrestrial_radiation` × 0,7^(Luftmasse^0,678) × 0,75),
  Luftmasse nach Kasten-Young, gedeckelt auf 60 min; Faktor 0,75 so geeicht, dass ECMWF bei 0 % Wolken ≈ 60 min liefert.
  Beide Felder stehen in der Stundenabfrage; fehlen sie, gilt der alte Open-Meteo-Wert. Tagessumme im Sonnenfuß folgt
  automatisch. Probe 06.10.: ECMWF (klar) 9,4 h, ICON (wolkig) 6,7 h – WeatherPro zeigte 8,9 h. Hinweis in `quelleText()`.
- **Wertlinie überall + schmaler Kopf (06.10.2026, live, Version `20261006a`):** Vorbild Marea (marea.ooo): beim
  Wischen wandert ein Punkt auf der Kurve, von der Achse bis zum Punkt läuft eine gestrichelte Linie, die Zahl steht an
  der Achse. Jetzt für alle Zeilen außer Sonne und Regen (`wertlinie:true` im KATALOG; Balkenzeilen ohne Punkt);
  `wertlinienSetzen()` setzt x1 = scrollLeft, x2 = Cursor, Punkt `.mg-wertpunkt`, Achsenzahl aus `zelle().wert`
  (Tide 2 Stellen). Der Kopf ist nur noch die haftende Fahne plus **eine schmale Zeile** `.mg-werte` (jetzt **in**
  `.mg-readout`) mit dem, was keine Achsenzahl hat: Sonne, Regen, „gefühlt“, „Böen“ + Richtung (und Wasser, falls
  nicht als Zeile gewählt). `wertePaare`/`werteKlug` sind damit praktisch ohne Wirkung, bleiben aber im Code.
  Die Zoom-Lupe sitzt in `.mg-ecke-halter { position: sticky; bottom: calc(var(--mg-haft-unten) + 64px); height: 0 }`
  am Ende von `.mg-wrap` und bleibt so am unteren Bildrand über der Knopfleiste stehen. Kopf auf dem iPhone: 134 px.
- **Kopfteil kompakt (05.10.2026 spät, live, Version `20261005e`):** Stephans Wahl aus dem Kopfteil-Baukasten:
  `reiter: eine` + `flach` (Orte als flache Reiter mit Unterstrich, Modell als Feld „Mix ▾“ = `.mg-modell`, Aufklapp-Liste
  `modellWahl()` mit Name/Langname/Hinweis; `reiter()` nur noch für die Orte), `fahne: eine` + `fahnedicht` (Wetterlage
  `#lage` steckt jetzt **im** `.mg-zeit`-Kasten, `.mg-readout` padding 6/4, kein Strich-Stummel mehr), `spalten: zwei`
  (`.mg-werte` immer 2 Spalten, der Strich läuft zwischen den Spalten), `dichte: dicht` (Zeile = `.mg-wl` + `.mg-wr`
  mit Wert `.mg-wv` und Zusatz `.mg-wz` nebeneinander, 4 px Luft), `zusatz: alle`, `umfang: klug` (`werteKlug`, je Zeile
  `zaehlt(v, daten, i)` im KATALOG: Sonne/UV nur bei `daten.tag[i]`, Regen ab 0,1 mm oder 30 %, Wolken ab 20 %, Staub ab 50),
  `paare` (`wertePaare`, `zelleHtml(titel, [zellen], farbe)` fasst Tide · Wasser usw. in eine Zeile, getrennt durch `.mg-sep`).
  Ergebnis auf dem iPhone: Kopf 184 px statt 650 px. Sicherung der Werteliste-Logik vorher: Commit 2215cd2.
  **Nachtrag 06.10.:** Stephan will **immer alle Werte** sehen, nichts Dynamisches – `werteKlug` ist seit Version
  `20261005f` standardmäßig aus (`cfg.werteKlug === true` schaltet es ein). Die `zaehlt()`-Funktionen bleiben im Katalog.
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
