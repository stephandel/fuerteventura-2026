// Gemeinsamer Stand für den Fuerteventura-Reiseplaner.
// Hält Favoriten, Ausgeblendete, abgehakte Aufgaben und Notizen von
// Stephan und Bilgen.
//
// Drei Wege hinein:
//   GET  /state         -> alles auf einmal
//   POST /marks         -> Favoriten, Ausgeblendete, Haken komplett setzen
//                          (je Liste: nur die mitgeschickten Arten werden ersetzt)
//   POST /note          -> Notiz anhängen
//   POST /note/delete   -> eigene Notiz löschen
//
// Antwort ist immer der vollständige neue Stand, damit die Seite nach
// jeder Änderung sofort das Richtige anzeigen kann.

const ERLAUBTE_HERKUNFT = [
  'https://stephandel.github.io',
  'http://localhost:8777'
];

const LEUTE = ['stephan', 'bilgen'];

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
  for (const z of marken.results) {
    const ziel = z.kind === 'fav' ? favs : z.kind === 'todo' ? todos : hidden;
    ziel[z.slug] = { by: z.by_who, at: z.at };
  }

  const notes = {};
  for (const z of notizen.results) {
    if (!notes[z.slug]) notes[z.slug] = [];
    notes[z.slug].push({ id: z.id, by: z.by_who, text: z.text, at: z.at });
  }

  return { favs, hidden, todos, notes, stand: Date.now() };
}

export default {
  async fetch(request, env) {
    const herkunft = request.headers.get('Origin') || '';

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

    const pfad = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

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
        for (const [art, liste] of [['fav', daten.favs], ['hidden', daten.hidden], ['todo', daten.todos]]) {
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

      return antwort({ fehler: 'unbekannter Weg' }, herkunft, 404);
    } catch (e) {
      return antwort({ fehler: 'Serverfehler', detail: String(e && e.message || e) }, herkunft, 500);
    }
  }
};
