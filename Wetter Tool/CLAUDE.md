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
| `../index.html` | Die Fuerteventura-Seite; ruft `Meteogramm.einbauen({...})` mit Orten, Zeilen, Kameras auf. |
| `../worker/fuerte-sync.js` | Cloudflare-Worker: speichert stündlich Webcam-Bilder (Bildspeicher). |

Live: https://stephandel.github.io/fuerteventura-2026/Wetter%20Tool/entwurf.html und
`…/schriftprobe.html`. Veröffentlichen = `git push` im Oberordner (GitHub Pages). Achtung: Alles in
diesem Ordner wird mit veröffentlicht (Positivliste in `../.gitignore`), also auch diese Datei.

## Offene Entscheidungen von Stephan

Keine – alle entschieden (siehe unten).

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
