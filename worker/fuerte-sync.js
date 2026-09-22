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
//   GET  /webcam?ort=x  -> Liste der gespeicherten Webcam-Bilder (letzte 3 Tage)
//   GET  /webcam/bild/7 -> ein gespeichertes Bild (ohne Herkunftsprüfung, damit <img> es laden kann)
//   GET  /webcam/jetzt  -> von Hand ein Bild je Ort holen (zum Testen)
//
// Dazu ein Cron-Auslöser (im Dashboard: Settings -> Triggers -> Cron, z. B. "5 * * * *"),
// der jede Stunde von Windy das aktuelle Webcam-Bild holt und in D1 ablegt.
// Braucht das Geheimnis WINDY_KEY (Settings -> Variables and Secrets), Schlüssel
// gibt es kostenlos unter https://api.windy.com/keys (Webcams API).
//
// Antwort ist immer der vollständige neue Stand, damit die Seite nach
// jeder Änderung sofort das Richtige anzeigen kann.

const ERLAUBTE_HERKUNFT = [
  'https://stephandel.github.io',
  'http://localhost:8777'
];

const LEUTE = ['stephan', 'bilgen'];

// Webcams je Ort. windy = feste Kamera-Nummer bei windy.com; fehlt sie,
// nimmt der Worker die nächstgelegene Kamera im Umkreis von 12 km.
const WEBCAMS = {
  corralejo: { windy: '1394743738', name: 'Corralejo Bay', lat: 28.7297, lon: -13.8672 },
  cotillo:   { windy: null,         name: 'El Cotillo',    lat: 28.6855, lon: -14.0110 },
  sotavento: { windy: null,         name: 'Sotavento',     lat: 28.1560, lon: -14.2275 }
};
const WEBCAM_TAGE = 4;          // so lange bleiben Bilder liegen
const WEBCAM_MAX_BYTES = 400000; // Sicherheitsgrenze je Bild

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

// Volle Stunde in kanarischer Ortszeit als "JJJJ-MM-TTTHH:00"
function ortsStunde(d) {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Atlantic/Canary', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const t = f.formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  return `${t.year}-${t.month}-${t.day}T${t.hour === '24' ? '00' : t.hour}:00`;
}

async function windy(pfad, env) {
  const r = await fetch('https://api.windy.com/webcams/api/v3/' + pfad, { headers: { 'x-windy-api-key': env.WINDY_KEY } });
  if (!r.ok) throw new Error('Windy ' + r.status);
  return r.json();
}

// Kamera-Nummer für einen Ort: fest hinterlegt oder die nächste im Umkreis
async function kameraFuer(ortId, env) {
  const cfg = WEBCAMS[ortId];
  if (!cfg) return null;
  if (cfg.windy) return cfg.windy;
  const liste = await windy(`webcams?nearby=${cfg.lat},${cfg.lon},12&limit=1&sortKey=distance`, env);
  const erste = liste && liste.webcams && liste.webcams[0];
  return erste ? String(erste.webcamId) : null;
}

// Holt für einen Ort das aktuelle Bild und legt es zur vollen Stunde ab
async function bildHolen(ortId, env) {
  const id = await kameraFuer(ortId, env);
  if (!id) return { ort: ortId, fehler: 'keine Kamera' };
  const cam = await windy(`webcams/${id}?include=images`, env);
  const url = cam && cam.images && cam.images.current && (cam.images.current.preview || cam.images.current.thumbnail);
  if (!url) return { ort: ortId, fehler: 'kein Bild' };
  const r = await fetch(url);
  if (!r.ok) return { ort: ortId, fehler: 'Bild ' + r.status };
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength > WEBCAM_MAX_BYTES) return { ort: ortId, fehler: 'Bild zu groß' };
  const t = ortsStunde(new Date());
  const quelle = 'Windy · ' + (cam.title || WEBCAMS[ortId].name);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO webcam_shots (ort, t, taken_at, mime, bytes, quelle, link) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(ortId, t, Date.now(), r.headers.get('Content-Type') || 'image/jpeg', bytes, quelle, 'https://www.windy.com/webcams/' + id).run();
  return { ort: ortId, t, bytes: bytes.byteLength };
}

async function alleBilderHolen(env) {
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
    if (!env.DB || !env.WINDY_KEY) return;
    ctx.waitUntil(alleBilderHolen(env));
  },

  async fetch(request, env) {
    const herkunft = request.headers.get('Origin') || '';
    const pfad = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

    // Gespeichertes Webcam-Bild: darf jeder sehen, sonst kann <img> es nicht laden
    const bildTreffer = pfad.match(/^\/webcam\/bild\/(\d+)$/);
    if (request.method === 'GET' && bildTreffer && env.DB) {
      const z = await env.DB.prepare('SELECT mime, bytes FROM webcam_shots WHERE id = ?').bind(Number(bildTreffer[1])).first();
      if (!z) return new Response('kein Bild', { status: 404 });
      return new Response(z.bytes, { headers: { 'Content-Type': z.mime || 'image/jpeg', 'Cache-Control': 'public, max-age=86400, immutable' } });
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
        if (!env.WINDY_KEY) return antwort({ fehler: 'WINDY_KEY fehlt' }, herkunft, 500);
        return antwort({ ergebnis: await alleBilderHolen(env) }, herkunft);
      }

      return antwort({ fehler: 'unbekannter Weg' }, herkunft, 404);
    } catch (e) {
      return antwort({ fehler: 'Serverfehler', detail: String(e && e.message || e) }, herkunft, 500);
    }
  }
};
