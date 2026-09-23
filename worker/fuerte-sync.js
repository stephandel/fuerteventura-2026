// Gemeinsamer Stand für den Fuerteventura-Reiseplaner.
// Hält Favoriten, Ausgeblendete, abgehakte Aufgaben, Packlisten-Haken
// und Notizen von Stephan und Bilgen.
//
// Drei Wege hinein:
//   GET  /state         -> alles auf einmal
//   POST /marks         -> Favoriten, Ausgeblendete, Aufgaben- und Packlisten-Haken setzen
//                          (je Liste: nur die mitgeschickten Arten werden ersetzt)
//   POST /note          -> Notiz anhängen
//   POST /note/delete   -> eigene Notiz löschen
//   GET  /webcam?ort=x  -> Liste der gespeicherten Bilder einer Kamera (Schlüssel wie in WEBCAMS)
//   GET  /webcam/bild/7 -> ein gespeichertes Bild (ohne Herkunftsprüfung, damit <img> es laden kann)
//   GET  /webcam/jetzt  -> von Hand ein Bild je Ort holen (zum Testen)
//
// Dazu ein Cron-Auslöser (im Dashboard: Settings -> Trigger Events -> Cron, "5 * * * *"),
// der jede Stunde das aktuelle Webcam-Bild holt und in D1 ablegt. Es wird kein
// Zugangsschlüssel gebraucht - die Kameras geben ihr Standbild frei heraus, und
// die Tabelle legt der Worker beim ersten Zugriff selbst an.
//
// Antwort ist immer der vollständige neue Stand, damit die Seite nach
// jeder Änderung sofort das Richtige anzeigen kann.

const ERLAUBTE_HERKUNFT = [
  'https://stephandel.github.io',
  'http://localhost:8777'
];

const LEUTE = ['stephan', 'bilgen'];

// Webcams je Ort. Beide Quellen liefern ihr Standbild frei, ohne Schlüssel:
//   skyline = SkylineWebcams, feste Bildadresse, alle paar Sekunden neu
//   youtube = Vorschaubild eines laufenden Livestreams (nur gültig, solange er läuft)
// Geprüft am 23.09.2026. Fällt eine Kamera aus, bleibt die Stunde einfach leer.
const WEBCAMS = {
  corralejo: {
    name: 'Grandes Playas, Corralejo', art: 'skyline',
    url: 'https://cdn.skylinewebcams.com/live6086.jpg',
    quelle: 'SkylineWebcams',
    link: 'https://www.skylinewebcams.com/en/webcam/espana/canarias/corralejo/grandes-playas-corralejo.html'
  },
  // MeteoSurf Canarias sammelt Strandkameras und gibt die Bilder frei heraus;
  // Zeitstempel steht im Bild, Last-Modified verrät das Alter (ca. alle 15 Min.).
  cotillo: {
    name: 'El Cotillo, Hafen', art: 'bild',
    url: 'https://www.meteosurfcanarias.com/1-webcams/webcam-el-cotillo.jpg',
    quelle: 'MeteoSurf Canarias',
    link: 'https://www.meteosurfcanarias.com/webcams/new/de/strand-webcams-insel_fuerteventura.php'
  },
  sotavento: {
    name: 'Sotavento, Playa Barca', art: 'youtube', video: '8CxYZ4tPTmo',
    quelle: 'René Egli · YouTube',
    link: 'https://www.youtube.com/watch?v=8CxYZ4tPTmo'
  },
  jandia: {
    name: 'Faro de Jandía, Morro Jable', art: 'bild',
    url: 'https://www.meteosurfcanarias.com/1-webcams/webcam-faro-jandia.jpg',
    quelle: 'MeteoSurf Canarias',
    link: 'https://www.meteosurfcanarias.com/webcams/new/de/strand-webcams-insel_fuerteventura.php'
  }
};
const WEBCAM_TAGE = 4;          // so lange bleiben Bilder liegen
const WEBCAM_MAX_BYTES = 600000; // Sicherheitsgrenze je Bild

// Obergrenzen, damit ein Versehen oder ein Fremder die Datenbank
// nicht vollschreiben kann.
const MAX_MARKEN = 60;
const MAX_TEXT = 500;
const MAX_SLUG = 80;

function kopfzeilen(herkunft) {
  return {
    'Access-Control-Allow-Origin': ERLAUBTE_HERKUNFT.includes(herkunft) ? herkunft : ERLAUBTE_HERKUNFT[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function antwort(daten, herkunft, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...kopfzeilen(herkunft)
    }
  });
}

function text(wert, max) {
  return String(wert == null ? '' : wert).slice(0, max);
}

function person(wert, ersatz) {
  return LEUTE.includes(wert) ? wert : ersatz;
}

async function standLesen(env) {
  const marken = await env.DB.prepare(
    'SELECT slug, kind, by_who, at FROM marks'
  ).all();
  const notizen = await env.DB.prepare(
    'SELECT id, slug, by_who, text, at FROM notes ORDER BY at ASC, id ASC'
  ).all();

  const favs = {};
  const hidden = {};
  const todos = {};
  const pack = {};
  for (const z of marken.results) {
    const ziel = z.kind === 'fav' ? favs : z.kind === 'todo' ? todos : z.kind === 'pack' ? pack : hidden;
    ziel[z.slug] = { by: z.by_who, at: z.at };
  }

  const notes = {};
  for (const z of notizen.results) {
    if (!notes[z.slug]) notes[z.slug] = [];
    notes[z.slug].push({ id: z.id, by: z.by_who, text: z.text, at: z.at });
  }

  return { favs, hidden, todos, pack, notes, stand: Date.now() };
}

// ---------- Webcam-Bilder ----------

// Die Bildtabelle legt der Worker selbst an, damit niemand von Hand SQL
// eintippen muss. Kostet beim ersten Aufruf einer Worker-Instanz eine Abfrage.
let tabelleGeprueft = false;
async function tabelleSicherstellen(env) {
  if (tabelleGeprueft) return;
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS webcam_shots (' +
    ' id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    ' ort TEXT NOT NULL, t TEXT NOT NULL, taken_at INTEGER NOT NULL,' +
    ' mime TEXT, bytes BLOB, quelle TEXT, link TEXT,' +
    ' UNIQUE (ort, t))'
  ).run();
  tabelleGeprueft = true;
}

// Volle Stunde in kanarischer Ortszeit als "JJJJ-MM-TTTHH:00"
function ortsStunde(d) {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Atlantic/Canary', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const t = f.formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  return `${t.year}-${t.month}-${t.day}T${t.hour === '24' ? '00' : t.hour}:00`;
}

// Ein Livestream-Vorschaubild ist nur brauchbar, solange der Stream läuft -
// sonst liefert YouTube ein altes Standbild, das aussieht wie ein echtes Foto.
async function laeuftStream(videoId) {
  try {
    const r = await fetch('https://www.youtube.com/watch?v=' + videoId, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de' }
    });
    if (!r.ok) return false;
    const t = await r.text();
    return t.includes('"isLiveNow":true') || t.includes('"isLive":true');
  } catch (e) { return false; }
}

// Holt für einen Ort das aktuelle Bild und legt es zur vollen Stunde ab
async function bildHolen(ortId, env) {
  const cfg = WEBCAMS[ortId];
  if (!cfg) return { ort: ortId, fehler: 'unbekannter Ort' };

  let url = cfg.url;
  if (cfg.art === 'youtube') {
    if (!(await laeuftStream(cfg.video))) return { ort: ortId, fehler: 'Stream läuft gerade nicht' };
    url = 'https://i.ytimg.com/vi/' + cfg.video + '/maxresdefault_live.jpg';
  }
  if (!url) return { ort: ortId, fehler: 'keine Bildadresse' };

  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'fv=' + Date.now(), {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!r.ok) return { ort: ortId, fehler: 'Bild ' + r.status };

  // Bei SkylineWebcams verrät die Kopfzeile, wie alt das Bild ist. Älter als
  // eine halbe Stunde heißt: Kamera steht - dann lieber gar kein Bild.
  const lm = r.headers.get('Last-Modified');
  if (lm) {
    const alter = Date.now() - new Date(lm).getTime();
    if (alter > 45 * 60000) return { ort: ortId, fehler: 'Bild veraltet' };
  }

  const bytes = await r.arrayBuffer();
  if (bytes.byteLength < 2000) return { ort: ortId, fehler: 'Bild zu klein' };
  if (bytes.byteLength > WEBCAM_MAX_BYTES) return { ort: ortId, fehler: 'Bild zu groß' };

  const t = ortsStunde(new Date());
  await env.DB.prepare(
    'INSERT OR REPLACE INTO webcam_shots (ort, t, taken_at, mime, bytes, quelle, link) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(ortId, t, Date.now(), r.headers.get('Content-Type') || 'image/jpeg', bytes, cfg.quelle, cfg.link).run();
  return { ort: ortId, t, bytes: bytes.byteLength };
}

async function alleBilderHolen(env) {
  await tabelleSicherstellen(env);
  const out = [];
  for (const ortId of Object.keys(WEBCAMS)) {
    try { out.push(await bildHolen(ortId, env)); }
    catch (e) { out.push({ ort: ortId, fehler: String(e && e.message || e) }); }
  }
  // Altes wegräumen
  await env.DB.prepare('DELETE FROM webcam_shots WHERE taken_at < ?').bind(Date.now() - WEBCAM_TAGE * 86400000).run();
  return out;
}

async function bilderListe(ortId, env) {
  await tabelleSicherstellen(env);
  const z = await env.DB.prepare(
    'SELECT id, t, quelle, link FROM webcam_shots WHERE ort = ? ORDER BY t ASC'
  ).bind(ortId).all();
  return {
    ort: ortId,
    quelle: z.results.length ? z.results[z.results.length - 1].quelle : '',
    link: z.results.length ? z.results[z.results.length - 1].link : '',
    shots: z.results.map(r => ({ t: r.t, url: '/webcam/bild/' + r.id }))
  };
}

export default {
  // Stündlicher Auslöser (Cron)
  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    ctx.waitUntil(alleBilderHolen(env));
  },

  async fetch(request, env) {
    const herkunft = request.headers.get('Origin') || '';
    const pfad = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

    // Gespeichertes Webcam-Bild: darf jeder sehen, sonst kann <img> es nicht laden
    const bildTreffer = pfad.match(/^\/webcam\/bild\/(\d+)$/);
    if (request.method === 'GET' && bildTreffer && env.DB) {
      let z = null;
      try {
        await tabelleSicherstellen(env);
        z = await env.DB.prepare('SELECT mime, bytes FROM webcam_shots WHERE id = ?').bind(Number(bildTreffer[1])).first();
      } catch (e) { return new Response('Fehler', { status: 500 }); }
      if (!z || !z.bytes) return new Response('kein Bild', { status: 404 });
      // D1 liefert BLOBs je nach Fassung als ArrayBuffer oder als Zahlenliste.
      const roh = Array.isArray(z.bytes) ? new Uint8Array(z.bytes) : z.bytes;
      return new Response(roh, { headers: { 'Content-Type': z.mime || 'image/jpeg', 'Cache-Control': 'public, max-age=86400, immutable' } });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: kopfzeilen(herkunft) });
    }

    // Nur unsere eigene Seite darf. Das hält keinen entschlossenen
    // Angreifer auf, aber jede fremde Webseite und jeden Suchroboter.
    if (!ERLAUBTE_HERKUNFT.includes(herkunft)) {
      return antwort({ fehler: 'nicht erlaubt' }, herkunft, 403);
    }

    if (!env.DB) {
      return antwort({ fehler: 'Datenbank nicht verbunden' }, herkunft, 500);
    }

    try {
      if (request.method === 'GET' && (pfad === '/' || pfad === '/state')) {
        return antwort(await standLesen(env), herkunft);
      }

      if (request.method === 'POST' && pfad === '/marks') {
        const daten = await request.json();
        const ich = person(daten.by, 'stephan');
        const jetzt = Date.now();

        // Jede Art wird nur ersetzt, wenn sie mitgeschickt wurde. So kann
        // eine ältere Fassung der Seite, die die Haken noch nicht kennt,
        // diese nicht versehentlich löschen.
        const befehle = [];
        for (const [art, liste] of [['fav', daten.favs], ['hidden', daten.hidden], ['todo', daten.todos], ['pack', daten.pack]]) {
          if (!Array.isArray(liste)) continue;
          befehle.push(env.DB.prepare('DELETE FROM marks WHERE kind = ?').bind(art));
          for (const eintrag of liste.slice(0, MAX_MARKEN)) {
            const slug = text(eintrag && eintrag.slug != null ? eintrag.slug : eintrag, MAX_SLUG).trim();
            if (!slug) continue;
            const wer = person(eintrag && eintrag.by, ich);
            const wann = Number(eintrag && eintrag.at) || jetzt;
            befehle.push(
              env.DB.prepare(
                'INSERT OR REPLACE INTO marks (slug, kind, by_who, at) VALUES (?, ?, ?, ?)'
              ).bind(slug, art, wer, wann)
            );
          }
        }
        if (befehle.length) await env.DB.batch(befehle);
        return antwort(await standLesen(env), herkunft);
      }

      if (request.method === 'POST' && pfad === '/note') {
        const daten = await request.json();
        const slug = text(daten.slug, MAX_SLUG).trim();
        const inhalt = text(daten.text, MAX_TEXT).trim();
        const wer = person(daten.by, 'stephan');
        if (!slug || !inhalt) {
          return antwort({ fehler: 'leer' }, herkunft, 400);
        }
        await env.DB.prepare(
          'INSERT INTO notes (slug, by_who, text, at) VALUES (?, ?, ?, ?)'
        ).bind(slug, wer, inhalt, Number(daten.at) || Date.now()).run();
        return antwort(await standLesen(env), herkunft);
      }

      if (request.method === 'POST' && pfad === '/note/delete') {
        const daten = await request.json();
        const id = Number(daten.id);
        const wer = person(daten.by, '');
        if (!id || !wer) {
          return antwort({ fehler: 'ungültig' }, herkunft, 400);
        }
        // Nur eigene Notizen - das prüft der Server, nicht die Seite.
        await env.DB.prepare(
          'DELETE FROM notes WHERE id = ? AND by_who = ?'
        ).bind(id, wer).run();
        return antwort(await standLesen(env), herkunft);
      }

      if (request.method === 'GET' && pfad === '/webcam') {
        const ortId = new URL(request.url).searchParams.get('ort') || 'corralejo';
        if (!WEBCAMS[ortId]) return antwort({ fehler: 'unbekannter Ort' }, herkunft, 400);
        return antwort(await bilderListe(ortId, env), herkunft);
      }

      if (request.method === 'GET' && pfad === '/webcam/jetzt') {
        return antwort({ ergebnis: await alleBilderHolen(env) }, herkunft);
      }

      return antwort({ fehler: 'unbekannter Weg' }, herkunft, 404);
    } catch (e) {
      return antwort({ fehler: 'Serverfehler', detail: String(e && e.message || e) }, herkunft, 500);
    }
  }
};
