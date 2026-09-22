-- Tabellen für den gemeinsamen Stand von Stephan und Bilgen.
-- Einmalig ausführen; bei erneutem Ausführen passiert nichts Schlimmes.

-- Herz und Ausblenden je Unterkunft. Pro Unterkunft und Art genau eine
-- Zeile - wer es zuletzt gesetzt hat, steht in by_who.
CREATE TABLE IF NOT EXISTS marks (
  slug   TEXT    NOT NULL,
  kind   TEXT    NOT NULL,
  by_who TEXT    NOT NULL,
  at     INTEGER NOT NULL,
  PRIMARY KEY (slug, kind)
);

-- Notizen je Unterkunft, beliebig viele, in zeitlicher Reihenfolge.
CREATE TABLE IF NOT EXISTS notes (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug   TEXT    NOT NULL,
  by_who TEXT    NOT NULL,
  text   TEXT    NOT NULL,
  at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS notes_slug_at ON notes (slug, at);

-- Stündliche Webcam-Bilder je Ort (vom Cron-Auslöser gefüllt). Pro Ort und
-- voller Stunde ein Bild; alte Bilder räumt der Worker nach ein paar Tagen weg.
CREATE TABLE IF NOT EXISTS webcam_shots (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ort      TEXT    NOT NULL,
  t        TEXT    NOT NULL,   -- volle Stunde in Ortszeit, z. B. 2026-09-22T09:00
  taken_at INTEGER NOT NULL,   -- Zeitstempel der Aufnahme (ms)
  mime     TEXT,
  bytes    BLOB,
  quelle   TEXT,
  link     TEXT,
  UNIQUE (ort, t)
);
