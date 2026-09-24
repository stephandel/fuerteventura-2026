# Wetter-Tool – Arbeitsstand für neue Chats

Dieser Ordner ist das Wetter-Tool (Meteogramm) der Fuerteventura-Seite. Wer hier einen Chat startet,
findet unten alles, um nahtlos weiterzumachen. Die Bedienung und Einstellungen des Bausteins stehen in
`README.md`, ausführlichere Hintergründe im Gedächtnis des Projekts (Notizen `fuerte-meteogramm`,
`fuerte-webcams`, `fuerte-satellitenbilder`, `fuerte-mondbild`, `fuerte-offene-punkte`).

Stand: **24.09.2026**

## Für wen

Stephan hat kaum Technik-Kenntnisse: einfache Sprache, Fachbegriffe erklären, keine Rückfragen zu
Dingen, die man selbst prüfen kann. Handy zuerst. Optik ruhig und aufgeräumt – **keine Kacheln,
keine Pillen, nicht „zu rund“**.

## Dateien

| Datei | Zweck |
|---|---|
| `meteogramm.js` / `meteogramm.css` | Der Baustein selbst. Weiß nichts von Fuerteventura. |
| `demo.html` | Zum Ausprobieren ohne die große Seite. |
| `entwurf.html` | Gestaltungs-Labor: Varianten zum Umschalten (siehe unten). |
| `schriftprobe.html` | 17 Schriften für die Zahlen zur Auswahl. |
| `../index.html` | Die Fuerteventura-Seite; ruft `Meteogramm.einbauen({...})` mit Orten, Zeilen, Kameras auf. |
| `../worker/fuerte-sync.js` | Cloudflare-Worker: speichert stündlich Webcam-Bilder (Bildspeicher). |

Live: https://stephandel.github.io/fuerteventura-2026/Wetter%20Tool/entwurf.html und
`…/schriftprobe.html`. Veröffentlichen = `git push` im Oberordner (GitHub Pages). Achtung: Alles in
diesem Ordner wird mit veröffentlicht (Positivliste in `../.gitignore`), also auch diese Datei.

## Offene Entscheidungen von Stephan

1. **Gestaltungs-Labor (`entwurf.html`)** – Schalter oben: Bild oben/unten/beides, Werte „am Strich“
   an/aus, Knöpfe unten/oben, Zusatzzeile an/aus, Datumsfahne haftet/scrollt, hell/dunkel.
   **Empfehlung:** Bild unten + am Strich + Knöpfe unten + Fahne haftet.
   Wenn Stephan entscheidet: im Baustein selbst umsetzen (`meteogramm.css`/`.js`), nicht als
   Überlagerung wie im Labor.
2. **Schrift für die Zahlen (`schriftprobe.html`)** – Stephan nennt eine Nummer 1–17. Nr. 1 =
   JetBrains Mono = Ist-Stand. Umstellen: `--mg-mono` in `meteogramm.css` + Google-Fonts-Link in
   `../index.html`.
3. **Mond im hellen Modus** bewusst blass (Deckkraft 0,42) – kräftiger oder so lassen?

## Offene technische Punkte

- **Worker nicht auf dem neuesten Stand.** Geprüft 24.09.: `GET https://fuerte-sync.stephanhandel.workers.dev/webcam/jetzt`
  (mit Header `Origin: https://stephandel.github.io`) liefert nur `corralejo`, `sotavento`, `cotillo` –
  **`jandia` (Faro de Jandía) fehlt**, obwohl er in `../worker/fuerte-sync.js` steht. Also neu einspielen:
  `cat worker/fuerte-sync.js | pbcopy`, Stephan fügt im Cloudflare-Dashboard unter
  Workers & Pages → fuerte-sync → „Edit code“ ein und klickt „Deploy“. Danach per curl prüfen: vier Orte.
- **Verdacht Platzhalterbild:** Bei derselben Prüfung meldeten Corralejo und El Cotillo beide genau
  **5685 Bytes** – echte Fotos wären unterschiedlich groß. Prüfen, ob der Worker bei einem Fehler ein
  Ersatzbild speichert statt nichts (Liveness-Test im Worker nicht entfernen!).
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
