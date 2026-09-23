# Meteogramm

Mehrere Wetterdiagramme übereinander mit einer gemeinsamen Zeitachse — Sonnenschein,
Temperatur, Wind, Niederschlag, UV, Luftfeuchte, Bewölkung, Luftdruck, Wellen, Tide.
Man wischt die Zeit unter einer feststehenden Auswahl-Linie hindurch; oben stehen
Datum, Uhrzeit und alle Werte an dieser Stelle.

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
| `kameras` | `{ ortId: { name, live, quelle, seite, hinweis? } }` — `live` ist die Adresse eines Standbilds | keine |
| `bildspeicher` | Adresse eines Dienstes, der vergangene Stunden vorhält (siehe unten) | keiner |
| `zeitzone` | z. B. `'Atlantic/Canary'`. `'auto'` nimmt die Zeitzone des Ortes. | `'auto'` |
| `tageVorher` / `tageVoraus` | Wie weit das Diagramm reicht | 1 / 8 |
| `merkschluessel` | Präfix für die gespeicherte Auswahl (Ort, Modell, Zeilen) | `'meteogramm'` |

Rückgabe: `{ neu(), zeichnen(), zeigeOrt(id), abbauen() }`.

## Verfügbare Zeilen

`sonne` · `temp` · `wind` · `regen` · `uv` · `feuchte` · `wolken` · `druck` · `welle` · `tide`

Besonderheiten:

- **sonne** — Balken in Minuten je Stunde, darunter je Tag die Summe, Auf- und Untergang und der UV-Höchstwert.
- **temp** — durchgezogen die gemessene, gestrichelt die gefühlte Temperatur; Tageshoch und -tief sind beschriftet.
- **wind** — Balken für den Mittelwind, heller Aufsatz für die Böen, darunter Pfeile für die Windrichtung (sie zeigen, wohin der Wind weht).
- **regen** — Balken in Millimetern, dünne Linie für die Wahrscheinlichkeit.
- **uv** — Balken in den üblichen Ampelfarben (grün bis violett).
- **welle**, **tide** — brauchen die Meeres-Abfrage; werden nur geholt, wenn eine der beiden sichtbar ist. Hoch- und Niedrigwasser sind mit Uhrzeit beschriftet.

**UV-Index:** ECMWF und ICON rechnen ihn nicht. Fehlt er, holt der Baustein ihn
einzeln aus der besten Mischung und schreibt das in die Fußzeile.

## Farben

Der Baustein nimmt die Farben der umgebenden Seite, wenn sie diese Variablen setzt:
`--surface`, `--surface-2`, `--border`, `--ink`, `--ink-dim`, `--teal`, `--ochre`, `--shadow`.
Fehlen sie, greifen eingebaute Ersatzwerte (dunkel). Die Farben der Diagrammlinien
stehen in `meteogramm.js` im `KATALOG`.

## Vergangene Stunden (wahlfrei)

Ohne `bildspeicher` zeigt der Baustein nur das Kamerabild der **laufenden** Stunde,
direkt vom Betreiber geholt. Für die Vergangenheit braucht es einen Dienst, der
stündlich ein Bild wegspeichert und zwei Wege anbietet:

    GET  <bildspeicher>/webcam?ort=<id>
    → { "shots": [ { "t": "2026-09-23T09:00", "url": "/webcam/bild/42" } ] }

    GET  <bildspeicher>/webcam/bild/42
    → das Bild (JPEG)

`t` ist die volle Stunde in Ortszeit, `url` darf absolut oder relativ sein.
Ein fertiger Cloudflare-Worker dafür liegt im Nachbarprojekt unter `worker/`.

## Browser

Alles ES5 mit `fetch` und `Promise`, also alles ab etwa 2017. Gezeichnet wird als
SVG. Die Anzeige läuft über `setTimeout`, nicht `requestAnimationFrame` — sonst
stünde sie still, solange der Tab im Hintergrund ist.
