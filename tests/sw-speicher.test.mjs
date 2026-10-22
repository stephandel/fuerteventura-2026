// Prüft: Ein Update löscht nur die eigenen Offline-Speicher (fuerte-…), nie die anderer Apps unter stephandel.github.io.
// Aufruf: node --test tests/sw-speicher.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ordner = new URL('../', import.meta.url);
const FREMDE = ['wpc-v40', 'wedda-v12', 'wedder-v3', 'ph-v11', 'ph-media'];

function falscherSpeicher(namen) {
  const m = new Map(namen.map(n => [n, {}]));
  return { keys: async () => [...m.keys()], delete: async n => m.delete(n), open: async () => ({ addAll: async () => {}, put: async () => {} }), match: async () => undefined, namen: () => [...m.keys()].sort() };
}

test('sw.js: Update löscht nur alte fuerte-Speicher', async () => {
  const code = fs.readFileSync(new URL('sw.js', ordner), 'utf8');
  const eigen = code.match(/var CACHE = '([^']+)'/)[1];
  const caches = falscherSpeicher([...FREMDE, 'fuerte-v1', eigen]);
  const h = {};
  const self = { addEventListener: (t, f) => { h[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} }, location: { origin: 'https://stephandel.github.io' }, registration: {} };
  vm.runInNewContext(code, { self, caches, URL, Promise, console });
  let warten; h.activate({ waitUntil: p => { warten = p; } }); await warten;
  assert.deepEqual(caches.namen(), [...FREMDE, eigen].sort());
});

test('index.html: Knopf „Frisch laden“ löscht nur fuerte-Speicher', async () => {
  const html = fs.readFileSync(new URL('index.html', ordner), 'utf8');
  const start = html.indexOf("var frisch = document.getElementById('einst-frisch');");
  const ende = html.indexOf('einstBereit = true;', start);
  assert.ok(start > 0 && ende > start, 'Abschnitt „Frisch laden“ nicht gefunden');
  const caches = falscherSpeicher([...FREMDE, 'fuerte-v118', 'fuerte-alt']);
  let klick, neu = 0;
  const knopf = { addEventListener: (t, f) => { klick = f; } };
  const document = { getElementById: () => knopf };
  const window = { caches };
  vm.runInNewContext(html.slice(start, ende), { document, window, caches, swReg: null, location: { reload: () => { neu++; } }, setTimeout: () => {}, Promise });
  klick(); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  assert.deepEqual(caches.namen(), [...FREMDE].sort());
  assert.ok(neu >= 1, 'Seite wurde nicht neu geladen');
});

// 22.10.2026: index.html lädt das Wetter-Tool mit ?v=…, CORE speichert es ohne. Offline muss es trotzdem kommen,
// nicht index.html als Ersatz (sonst fehlt das Meteogramm direkt nach einem Update ohne Netz).
test('sw.js: Datei mit ?v= wird offline aus CORE gefunden', async () => {
  const code = fs.readFileSync(new URL('sw.js', ordner), 'utf8');
  const BASIS = 'https://stephandel.github.io/fuerteventura-2026/sw.js';
  const ablage = new Map();
  const ohneQuery = u => { const x = new URL(u); x.search = ''; return x.href; };
  const caches = {
    open: async () => ({ addAll: async l => l.forEach(u => ablage.set(new URL(u, BASIS).href, 'inhalt ' + new URL(u, BASIS).pathname)), put: async () => {} }),
    keys: async () => [], delete: async () => true,
    match: async (req, opt) => {
      const u = new URL(typeof req === 'string' ? req : req.url, BASIS).href;
      if (ablage.has(u)) return ablage.get(u);
      if (opt && opt.ignoreSearch) { for (const [k, v] of ablage) if (ohneQuery(k) === ohneQuery(u)) return v; }
      return undefined;
    }
  };
  const h = {};
  const self = { addEventListener: (t, f) => { h[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} }, location: new URL(BASIS), registration: {} };
  const fetch = () => Promise.reject(new TypeError('offline'));
  vm.runInNewContext(code, { self, caches, URL, Promise, console, fetch });
  let warten; h.install({ waitUntil: p => { warten = p; } }); await warten;
  let antwort;
  h.fetch({ request: { method: 'GET', url: 'https://stephandel.github.io/fuerteventura-2026/Wetter%20Tool/meteogramm.js?v=20261022a' }, respondWith: p => { antwort = p; } });
  assert.equal(await antwort, 'inhalt /fuerteventura-2026/Wetter%20Tool/meteogramm.js');
});
