# Meteogramm

Mehrere Wetterdiagramme übereinander mit einer gemeinsamen Zeitachse — Sonnenschein,
Temperatur, Wind, Niederschlag, UV, Luftfeuchte, Bewölkung, Luftdruck, Wellen, Tide.
Man wischt die Zeit unter einer feststehenden Auswahl-Linie hindurch; oben stehen
Datum, Uhrzeit und alle Werte an dieser Stelle. Welche Zeilen erscheinen und in
welcher Reihenfolge, lässt sich einstellen.

Kein Zugangsschlüssel, keine fremden Bibliotheken, eine Datei plus ein Gestaltungsblatt.
Die Daten kommen von [Open-Meteo](https://open-meteo.com) (kostenlos, ohne Anmeldung).

**Zum Ausprobieren:** `demo.html` im Browser öffnen.

## Einbauen

```html
<link rel="stylesheet" href="meteogramm.css">
<div id="wetter"></div>
<script src="meteogramm.js"></script>
<script>
  Meteogramm.einbauen({
    ziel: '#wetter',
    orte: [{ id: 'berlin', name: 'Berlin', lat: 52.52, lon: 13.405 }]
  });
</script>
```

Mehr braucht es nicht. Alles Weitere ist wahlfrei.

## Einstellungen

| Name | Bedeutung | Vorgabe |
|---|---|---|
| `ziel` | Container, als CSS-Auswahl oder Element | — (Pflicht) |
| `orte` | Liste `{ id, name, lat, lon, meer? }`. `meer` ist ein abweichender Punkt für Wellen und Tide (die Küste vor dem Ort). Ab zwei Orten erscheinen Reiter. | ein Beispielort |
| `modelle` | Liste `{ id, name, lang, hinweis? }`. `id` ist ein Open-Meteo-Modell. Ab zwei Modellen erscheinen Reiter. | Mix, ECMWF, ICON, GFS |
| `zeilen` | Welche Zeilen angeboten werden, in dieser Reihenfolge | alle außer Luftdruck |
| `zeilenStandard` | Welche davon beim ersten Öffnen angehakt sind | alle angebotenen |
| `kameras` | `{ ortId: kamera }` oder `{ ortId: [kamera, kamera, …] }` mit `kamera = { id?, name, live, quelle, seite, hinweis? }`. `live` ist die Adresse eines Standbilds. Bei mehreren Kameras erscheint oben rechts im Bild ein Umschalter; `id` ist zugleich der Schlüssel im Bildspeicher. | keine |
| `karte` | Satelliten- und Niederschlagsbilder. `false` schaltet sie ab. Sonst ein Objekt, das die Vorgaben überschreibt: `wms`, `basis`, `auflage`, `schritt` (Minuten je Bild), `verzug` (wie weit das neueste Bild hinterherhinkt), `bilder` (Länge des Films), `bereich` (`{sued, west, nord, ost}` in Grad), `quelle`, `link` | EUMETSAT, Ausschnitt um den ersten Ort |
| `bildspeicher` | Adresse eines Dienstes, der vergangene Stunden vorhält (siehe unten) | keiner |
| `zeitzone` | z. B. `'Atlantic/Canary'`. `'auto'` nimmt die Zeitzone des Ortes. | `'auto'` |
| `tageVorher` / `tageVoraus` | Wie weit das Diagramm reicht | 1 / 8 |
| `bildMinute` | Minute nach der vollen Stunde, zu der von selbst aufgefrischt wird – und 30 Minuten später noch einmal (passend zum Bildspeicher) | `7` |
| `merkschluessel` | Präfix für die gespeicherte Auswahl (Ort, Modell, Zeilen, Reihenfolge) | `'meteogramm'` |
| `tagesSymbol` | `true`: am Tageswechsel und links oben Wetter-Symbol und Hoch/Tief des Tages, z. B. „Mo 28.09. ☀️ 30° / 22°“ (aus den hellen Stunden: Gewitter vor Regen vor Bewölkung) | `false` |
| `mond` | `true`: dritte Zeile im Tagesfuß der Sonnenzeile mit der Mondphase; bei Neumond, Viertel und Vollmond mit Uhrzeit (Rechnung nach Meeus) | `false` |
| `tipps` | Liste von Regeln für „was der Tag bringt“ unter dem Diagramm, siehe unten | keine |
| `filmLeiste` | `true`: Zeitraffer statt des ▶ im Satellitenbild – Play/Pause vorn in der Bildleiste, siehe unten | `false` |
| `knoepfeMittig` | `true`: ↻ steht links außen (↻ ‹ Jetzt zentrieren › ☰), damit „Jetzt zentrieren“ mittig sitzt | `false` |

Rückgabe: `{ neu(), auffrischen(), zeichnen(), zeigeOrt(id), abbauen() }`.

## Bedienung

- **Wischen** verschiebt die Zeit, **Antippen** holt eine Stelle in die Mitte.
- **‹ ›** springen einen Tag zurück oder vor.
- **Jetzt zentrieren** springt auf die aktuelle Stunde **und holt frische Werte**.
- **↻** holt frische Werte, ohne die gewählte Stelle zu verlassen.
- **📷 Webcam · 🛰️ Satellit · 🌧️ Regen** schalten das Bild über dem Diagramm um.
  Satellit und Regen folgen der gewählten Zeit: wischt man zurück, wandert auch
  das Satellitenbild zurück. **▶** spielt die letzten zwei Stunden als Film.
- **☰** öffnet die Zeilenauswahl: Haken setzen, was zu sehen sein soll, und am
  Griff `⠿` die Reihenfolge durch Ziehen ändern.
- **Lang auf eine Zeile im Diagramm drücken** (etwa eine halbe Sekunde) packt sie;
  dann nach oben oder unten ziehen und loslassen. Wer stattdessen wischt, bricht
  das ab – es wird also nichts versehentlich verschoben.

Auswahl und Reihenfolge merkt sich das Gerät.

## Wann es sich von selbst auffrischt

- jede halbe Stunde kurz nach `bildMinute` (bzw. 30 Minuten später) – dann liegt das neue Webcam-Bild bereit
- sobald die Seite nach mehr als zehn Minuten wieder in den Vordergrund kommt
- alle fünf Minuten wandert die „Jetzt"-Linie mit und das Live-Kamerabild wird neu geholt

## Verfügbare Zeilen

`sonne` · `temp` · `wind` · `regen` · `uv` · `feuchte` · `wolken` · `druck` · `welle` · `tide` · `wasser`

Besonderheiten:

- **sonne** — Balken in Minuten je Stunde, darunter je Tag die Summe, Auf- und Untergang und der UV-Höchstwert.
- **temp** — durchgezogen die gemessene, gestrichelt die gefühlte Temperatur; Tageshoch und -tief sind beschriftet.
- **wind** — Balken für den Mittelwind, heller Aufsatz für die Böen, darunter Pfeile für die Windrichtung (sie zeigen, wohin der Wind weht).
- **regen** — Balken in Millimetern, dünne Linie für die Wahrscheinlichkeit.
- **uv** — Balken in den üblichen Ampelfarben (grün bis violett).
- **wasser** — Wassertemperatur als Linie; die Skala umfasst mindestens 3 Grad, damit kleine Schwankungen nicht riesig wirken.
- **welle**, **tide**, **wasser** — brauchen die Meeres-Abfrage; werden nur geholt, wenn eine der beiden sichtbar ist. Hoch- und Niedrigwasser sind mit Uhrzeit beschriftet.

**UV-Index:** ECMWF und ICON rechnen ihn nicht. Fehlt er, holt der Baustein ihn
einzeln aus der besten Mischung und schreibt das in die Fußzeile.

## Tipps zum Tag (wahlfrei)

`tipps` ist eine Liste von Regeln. Gerechnet wird für den Tag unter dem Strich und den gewählten Ort:

```js
tipps: [
  { art:'strand', icon:'🏖️', titel:'Strand' },                                  // längstes Fenster: trocken, Wind < 25, Wolken < 85 %, ab 20°
  { art:'wind', icon:'🪁', titel:'Kiten', orte:['sotavento'], von:22, bis:50 },  // Wind zwischen von und bis (km/h)
  { art:'ebbe', icon:'🏝️', titel:'Lagune', orte:['sotavento'], text:'…' }        // 2 Std. vor bis 1 Std. nach Niedrigwasser, nur bei Tageslicht
]
```

`orte` schränkt eine Regel auf bestimmte Orte ein. Weitere Stellschrauben: `windBis` und `abGrad` (strand),
`vorher` und `nachher` in Stunden (ebbe). Fenster unter zwei Stunden zählen nicht. Liegt es schon hinter
„jetzt“, steht „(schon vorbei)“ dahinter. Eine `ebbe`-Regel holt die Meeresdaten auch dann, wenn keine
Meeres-Zeile sichtbar ist.

## Zeitraffer (wahlfrei, `filmLeiste`)

▶ vorn in der Bildleiste lässt den Auswahl-Strich selbst durch die letzten Stunden wandern: Datum,
Werte, Tipps und Bild laufen mit – bei der Webcam die gespeicherten Bilder, bei Satellit und Regen die
EUMETSAT-Aufnahmen. Schleife, am letzten Bild drei Takte Pause. Unter dem Bild erscheint eine Leiste mit
Fortschritt, **Rückblick** 2 / 6 / 12 / 24 Std. und **Tempo** ruhig / normal / flott (900 / 550 / 300 ms
je Bild; gemerkt unter `<praefix>-film-spanne` und `-film-tempo`) sowie „✕ zurück zu jetzt“.
Abstand der Bilder: Satellit 10 Min. bei 2 Std., sonst 30 bzw. 60 Min.; Webcam 30 Min., bei 24 Std. 60 Min.
– nie mehr als gut zwei Dutzend Bilder. Greift man selbst ins Diagramm oder tippt einen Knopf,
endet der Zeitraffer; ein Wechsel der Ansicht während des Films lässt ihn weiterlaufen.

## Farben

Der Baustein nimmt die Farben der umgebenden Seite, wenn sie diese Variablen setzt:
`--surface`, `--surface-2`, `--border`, `--ink`, `--ink-dim`, `--teal`, `--ochre`, `--shadow`.
Fehlen sie, greifen eingebaute Ersatzwerte (dunkel). Die Farben der Diagrammlinien
stehen in `meteogramm.js` im `KATALOG`.

## Datumsfahne

Datum und Uhrzeit stehen als Fahne oben am Auswahl-Strich und bleiben beim Scrollen der Seite
stehen. Hat die Seite eine feste Menüleiste, setzt sie `--mg-haft-oben` am Ziel-Element auf deren
Höhe (z. B. `ziel.style.setProperty('--mg-haft-oben', nav.offsetHeight + 'px')`), sonst rutscht die
Fahne darunter. Das Ziel-Element und seine Eltern dürfen kein `overflow: hidden` haben, sonst haftet
die Fahne nicht.

## Vergangene Stunden (wahlfrei)

Ohne `bildspeicher` zeigt der Baustein nur das Kamerabild der **laufenden** Stunde,
direkt vom Betreiber geholt. Für die Vergangenheit braucht es einen Dienst, der
jede halbe Stunde ein Bild wegspeichert und zwei Wege anbietet:

    GET  <bildspeicher>/webcam?ort=<id>
    → { "shots": [ { "t": "2026-09-23T09:00", "url": "/webcam/bild/42" } ] }

    GET  <bildspeicher>/webcam/bild/42
    → das Bild (JPEG)

`t` ist die Zeit in Ortszeit (volle oder halbe Stunde, z. B. `09:00`, `09:30`), `url` darf absolut oder relativ sein.
Der Baustein zeigt zum Strich das zeitlich nächste Bild, höchstens 45 Minuten entfernt.
Ein fertiger Cloudflare-Worker dafür liegt im Nachbarprojekt unter `worker/`.

## Satellit und Niederschlag

Die Bilder kommen vom offenen Kartendienst von [EUMETSAT](https://view.eumetsat.int/)
(Meteosat, kein Schlüssel nötig):

- **Satellit** — `mtg_fd:rgb_geocolour`, alle 10 Minuten. Tagsüber echte Farben,
  nachts Wolken im Infrarot plus die Lichter der Städte.
- **Regen** — dasselbe Bild, darüber `mtg_fd:h40b` (satellitengestützter
  Niederschlag) als durchsichtige Auflage.

Das neueste Bild hinkt etwa 40–50 Minuten hinterher; der Baustein fragt deshalb
nie neuer als `verzug` an. Ein Archiv gibt es bis zwei Jahre zurück, man kann
also auch nachsehen, wie es an einem vergangenen Tag aussah.

**Kein Regenradar:** Über dem Atlantik und den Kanaren gibt es keine
Radarabdeckung (geprüft mit RainViewer: leere Kacheln). Der Niederschlag hier
ist aus Satellitendaten abgeleitet — gröber als ein Radar, aber flächendeckend.

## Browser

Alles ES5 mit `fetch` und `Promise`, also alles ab etwa 2017. Gezeichnet wird als
SVG. Die Anzeige läuft über `setTimeout`, nicht `requestAnimationFrame` — sonst
stünde sie still, solange der Tab im Hintergrund ist.

## Datensparmodus (seit 26.09.2026)

Steht auf der einbettenden Seite `<html data-datensparen="1">`, holt der Baustein die Bilder des
Wolken-/Regenfilms nicht mehr vorab, sondern erst beim Abspielen (`filmVorladen()`). Die
Fuerteventura-Seite setzt das Merkmal über den Schalter „Datensparmodus“ im Zahnrad-Menü.
