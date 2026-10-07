/* ===========================================================================
   Meteogramm - mehrere Wetterdiagramme übereinander mit gemeinsamer Zeitachse.

   Eigenständiger Baustein ohne fremde Bibliotheken. Einbinden:

     <link rel="stylesheet" href="meteogramm.css">
     <div id="wetter"></div>
     <script src="meteogramm.js"></script>
     <script>
       Meteogramm.einbauen({
         ziel: '#wetter',
         orte: [{ id:'corralejo', name:'Corralejo', lat:28.7297, lon:-13.8672 }]
       });
     </script>

   Alles Weitere steht in README.md. Daten: Open-Meteo, kein Schlüssel nötig.
   =========================================================================== */
(function (global) {
  'use strict';

  // ---------- Vorgaben ----------

  var MODELLE_STANDARD = [
    { id:'best_match',    name:'Mix',   lang:'Beste Mischung', hinweis:'Open-Meteo nimmt je Region das passendste Modell' },
    { id:'ecmwf_ifs025',  name:'ECMWF', lang:'ECMWF (Europa)', hinweis:'Europäisches Wetterzentrum – meist das treffsicherste Modell' },
    { id:'icon_seamless', name:'ICON',  lang:'ICON (DWD)',     hinweis:'Deutscher Wetterdienst, reicht nur 7 Tage voraus' },
    { id:'gfs_seamless',  name:'GFS',   lang:'GFS (USA)',      hinweis:'US-Wetterdienst NOAA, gröberes Raster' }
  ];

  // Alle Zeilen, die es gibt. `feld` zeigt auf die aufbereiteten Stundenwerte.
  //   art       balken | linie
  //   feld2     zweiter Wert derselben Zeile (Böen als heller Aufsatz,
  //             gefühlte Temperatur als gestrichelte Linie)
  //   vorher    Summenwert der vergangenen Stunde (Balken linksbündig setzen)
  //   meer      braucht die Meeres-Abfrage
  var KATALOG = {
    // zaehlt(): ob der Wert in der Werteliste gerade etwas aussagt (nachts keine Sonne, kein Regen bei 0 mm …)
    sonne:   { titel:'Sonnenschein', kurz:'Sonne', einheit:'min', art:'balken', feld:'sonne', farbe:'#e6c245', zaehlt:function(v, d, i){ return !!d.tag[i]; },
               min:0, max:60, ticks:[0,30,60], vorher:true, icon:'☀️', tagesinfo:true,
               fmt:function(v){ return Math.round(v) + ' min'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: 'min' }; } },
    temp:    { titel:'Temperatur', einheit:'°C', art:'linie', feld:'temp', feld2:'gefuehlt', farbe:'#ef8a5c', wertlinie:true,
               extrema:'tag', icon:'🌡️',
               fmt:function(v, v2){ return Math.round(v) + '°' + (v2 != null ? ' (gefühlt ' + Math.round(v2) + '°)' : ''); },
               zelle:function(v, v2){ return { wert: Math.round(v), einheit: '°', zusatz: v2 != null ? 'gefühlt ' + Math.round(v2) + '°' : '' }; } },
    wind:    { titel:'Wind', einheit:'km/h', art:'balken', feld:'wind', feld2:'boe', farbe:'#7fb3d9', wertlinie:true,
               min:0, icon:'💨', pfeile:'windrichtung',
               fmt:function(v, v2){ return Math.round(v) + (v2 != null ? ' (Böen ' + Math.round(v2) + ')' : '') + ' km/h'; },
               zelle:function(v, v2, d, i){
                 var zu = v2 != null ? 'Böen ' + Math.round(v2) : '';
                 if (d && d.windrichtung[i] != null) zu += (zu ? ' · ' : '') + HIMMEL[Math.round(d.windrichtung[i] / 45) % 8];
                 return { wert: Math.round(v), einheit: 'km/h', zusatz: zu };
               } },
    regen:   { titel:'Niederschlag', kurz:'Regen', einheit:'mm; Wahrsch. %', art:'balken', feld:'regen_mm', feld2:null, farbe:'#4f8fd0', zaehlt:function(v, d, i){ return v >= 0.1 || (d.regen_pct && d.regen_pct[i] >= 30); },
               min:0, vorher:true, icon:'💧', prozentlinie:'regen_pct',
               fmt:function(v){ return dez(v, 1) + ' mm'; },
               zelle:function(v, v2, d, i){
                 return { wert: dez(v, 1), einheit: 'mm',
                          zusatz: (d && d.regen_pct[i] != null) ? Math.round(d.regen_pct[i]) + ' % Wahrsch.' : '' };
               } },
    uv:      { titel:'UV-Index', kurz:'UV', einheit:'', art:'balken', feld:'uv', farbe:'#d98032', wertlinie:true, zaehlt:function(v, d, i){ return !!d.tag[i]; },
               min:0, ticks:[0,4,8], icon:'🔆', farbskala:'uv',
               fmt:function(v){ return dez(v, 1) + ' (' + uvText(v) + ')'; },
               zelle:function(v){ return { wert: dez(v, 1), einheit: '', zusatz: uvText(v) }; } },
    feuchte: { titel:'Rel. Luftfeuchte', kurz:'Feuchte', einheit:'%', art:'linie', feld:'feuchte', farbe:'#68c8e0', wertlinie:true,
               min:0, max:100, ticks:[0,50,100], icon:'💦',
               fmt:function(v){ return Math.round(v) + ' %'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: '%' }; } },
    wolken:  { titel:'Bewölkung', einheit:'%', art:'balken', feld:'wolken', farbe:'#9aa7b4', wertlinie:true, zaehlt:function(v){ return v >= 20; },
               min:0, max:100, ticks:[0,50,100], icon:'☁️',
               fmt:function(v){ return Math.round(v) + ' %'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: '%', zusatz: v < 15 ? 'wolkenlos' : v < 50 ? 'heiter' : v < 85 ? 'wolkig' : 'bedeckt' }; } },
    druck:   { titel:'Luftdruck', einheit:'hPa', art:'linie', feld:'druck', farbe:'#c3a6d8', wertlinie:true,
               icon:'🧭', fmt:function(v){ return Math.round(v) + ' hPa'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: 'hPa' }; } },
    welle:   { titel:'Wellen', einheit:'m', art:'linie', feld:'welle', farbe:'#6fc9b8', wertlinie:true,
               min:0, meer:true, icon:'🌊', fmt:function(v){ return dez(v, 1) + ' m'; },
               zelle:function(v){ return { wert: dez(v, 1), einheit: 'm' }; } },
    tide:    { titel:'Tide', einheit:'m', art:'linie', feld:'tide', farbe:'#4bc4cb',
               glatt:true, extrema:'tide', huelle:true, wertlinie:true, meer:true, icon:'🌊',
               fmt:function(v){ return (v > 0 ? '+' : '') + dez(v, 1) + ' m'; },
               zelle:function(v, v2, d, i, steigt){ return { wert: (v > 0 ? '+' : '') + dez(v, 1), einheit: 'm', zusatz: steigt == null ? '' : (steigt ? 'steigt' : 'fällt') }; } },
    wasser:  { titel:'Wassertemperatur', kurz:'Wasser', einheit:'°C', art:'linie', feld:'wasser', farbe:'#3f8fd6',
               glatt:true, wertlinie:true, meer:true, icon:'🌡️', fmt:function(v){ return dez(v, 1) + '°'; },
               zelle:function(v){ return { wert: dez(v, 1), einheit: '°' }; } },
    // Saharastaub (Calima): Wüstenstaub in der Luft, eigene Abfrage bei Open-Meteo (Luftqualität, CAMS).
    // Unter 50 klar, ab 50 leichter Dunst, ab 150 Calima, ab 300 starke Calima.
    staub:   { titel:'Saharastaub (Calima)', kurz:'Staub', einheit:'µg/m³', art:'balken', feld:'staub', farbe:'#c49a5a', wertlinie:true, zaehlt:function(v){ return v >= 50; },
               min:0, luft:true, icon:'🌫️', farbskala:'staub',
               fmt:function(v){ return Math.round(v) + ' µg/m³ (' + staubText(v) + ')'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: 'µg/m³', zusatz: staubText(v) }; } }
  };

  var ZEILEN_STANDARD = ['sonne','temp','wind','regen','uv','feuchte','wolken','welle','tide'];

  var WOCHENTAG = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  var HIMMEL = ['N','NO','O','SO','S','SW','W','NW'];
  var WMO_ICON = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
  var WMO_TEXT = {0:'klar',1:'überwiegend klar',2:'teils bewölkt',3:'bedeckt',45:'Nebel',48:'Nebel',51:'Nieselregen',53:'Nieselregen',55:'Nieselregen',61:'leichter Regen',63:'Regen',65:'starker Regen',80:'Schauer',81:'Schauer',82:'kräftige Schauer',95:'Gewitter',96:'Gewitter',99:'Gewitter'};

  // ---------- kleine Helfer ----------

  function dez(v, n){ return v == null ? '–' : v.toFixed(n).replace('.', ','); }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function uvText(v){ return v < 3 ? 'niedrig' : v < 6 ? 'mäßig' : v < 8 ? 'hoch' : v < 11 ? 'sehr hoch' : 'extrem'; }
  function uvFarbe(v){ return v < 3 ? '#4a9a5e' : v < 6 ? '#d4b63c' : v < 8 ? '#d98032' : v < 11 ? '#c0504a' : '#9b59b6'; }
  function staubText(v){ return v < 50 ? 'klar' : v < 150 ? 'leichter Dunst' : v < 300 ? 'Calima' : 'starke Calima'; }
  function staubFarbe(v){ return v < 50 ? '#d8c89f' : v < 150 ? '#d2a24a' : v < 300 ? '#c8702a' : '#8e4418'; }

  // ---------- Mond ----------

  // Genaue Zeitpunkte der Mondphasen nach J. Meeus, "Astronomical Algorithms" (wenige Minuten genau).
  // Dieselbe Rechnung steht auf der Fuerteventura-Seite (Mond-Kachel).
  function mondPhaseZeit(k){
    var r = Math.PI / 180, T = k / 1236.85, art = k - Math.floor(k);
    var JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T * T * T + 0.00000000073 * T * T * T * T;
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    var M  = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * r;
    var Mm = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T) * r;
    var F  = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T) * r;
    var O  = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * r;
    var s = Math.sin, c;
    if (art === 0 || art === 0.5) {
      var voll = art === 0.5;
      c = (voll ? -0.40614 : -0.40720) * s(Mm) + (voll ? 0.17302 : 0.17241) * E * s(M) + (voll ? 0.01614 : 0.01608) * s(2 * Mm)
        + (voll ? 0.01043 : 0.01039) * s(2 * F) + (voll ? 0.00734 : 0.00739) * E * s(Mm - M) - (voll ? 0.00515 : 0.00514) * E * s(Mm + M)
        + (voll ? 0.00209 : 0.00208) * E * E * s(2 * M) - 0.00111 * s(Mm - 2 * F) - 0.00057 * s(Mm + 2 * F)
        + 0.00056 * E * s(2 * Mm + M) - 0.00042 * s(3 * Mm) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
        - 0.00024 * E * s(2 * Mm - M) - 0.00017 * s(O) - 0.00007 * s(Mm + 2 * M) + 0.00004 * s(2 * Mm - 2 * F)
        + 0.00004 * s(3 * M) + 0.00003 * s(Mm + M - 2 * F) + 0.00003 * s(2 * Mm + 2 * F) - 0.00003 * s(Mm + M + 2 * F)
        + 0.00003 * s(Mm - M + 2 * F) - 0.00002 * s(Mm - M - 2 * F) - 0.00002 * s(3 * Mm + M) + 0.00002 * s(4 * Mm);
    } else {
      c = -0.62801 * s(Mm) + 0.17172 * E * s(M) - 0.01183 * E * s(Mm + M) + 0.00862 * s(2 * Mm) + 0.00804 * s(2 * F)
        + 0.00454 * E * s(Mm - M) + 0.00204 * E * E * s(2 * M) - 0.00180 * s(Mm - 2 * F) - 0.00070 * s(Mm + 2 * F)
        - 0.00040 * s(3 * Mm) - 0.00034 * E * s(2 * Mm - M) + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F)
        - 0.00028 * E * E * s(Mm + 2 * M) + 0.00027 * E * s(2 * Mm + M) - 0.00017 * s(O) - 0.00005 * s(Mm - M - 2 * F)
        + 0.00004 * s(2 * Mm + 2 * F) - 0.00004 * s(Mm + M + 2 * F) + 0.00004 * s(Mm - 2 * M) + 0.00003 * s(Mm + M - 2 * F)
        + 0.00003 * s(3 * M) + 0.00002 * s(2 * Mm - 2 * F) + 0.00002 * s(Mm - M + 2 * F) - 0.00002 * s(3 * Mm + M);
      var W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mm) - 0.00002 * Math.cos(Mm - M) + 0.00002 * Math.cos(Mm + M) + 0.00002 * Math.cos(2 * F);
      c += art === 0.25 ? W : -W;
    }
    // Planeten-Zusatzglieder
    var A = [299.77 + 0.107408 * k - 0.009173 * T * T, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k, 349.42 + 36.412478 * k,
      84.66 + 18.206239 * k, 141.74 + 53.303771 * k, 207.14 + 2.453732 * k, 154.84 + 7.306860 * k, 29.16 + 27.261239 * k,
      205.66 + 0.121824 * k, 283.87 + 1.844379 * k, 157.64 + 0.070286 * k, 110.41 + 42.216316 * k, 342.51 + 0.041301 * k];
    var G = [325, 165, 164, 126, 110, 62, 60, 56, 47, 42, 40, 37, 35, 23];
    for (var i = 0; i < 14; i++) c += G[i] * 0.000001 * s(A[i] * r);
    // JDE ist Terrestrische Zeit; rund 69 s Unterschied zur Weltzeit
    return new Date((JDE + c - 2440587.5) * 86400000 - 69000);
  }

  var MOND_ICON = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
  var MOND_NAME = ['Neumond','zunehmende Sichel','erstes Viertel','zunehmender Mond','Vollmond','abnehmender Mond','letztes Viertel','abnehmende Sichel'];
  var MOND_EREIGNIS = ['Neumond','Erstes Viertel','Vollmond','Letztes Viertel'];
  // Anteil am Mondmonat: 0 = Neumond, 0,5 = Vollmond
  function mondBruch(d){
    var syn = 29.530588853 * 864e5, bek = Date.UTC(2000, 0, 6, 18, 14);
    return (((d.getTime() - bek) % syn) + syn) % syn / syn;
  }

  // ---------- Der Baustein ----------

  function einbauen(cfg) {
    cfg = cfg || {};
    var wurzel = typeof cfg.ziel === 'string' ? document.querySelector(cfg.ziel) : cfg.ziel;
    if (!wurzel) { console.warn('Meteogramm: Ziel nicht gefunden'); return null; }

    var ORTE = cfg.orte && cfg.orte.length ? cfg.orte : [{ id:'ort', name:'Ort', lat:52.52, lon:13.405 }];
    // Werteliste: Verwandtes in einer Zeile (wertePaare: Tide · Wasser, Sonne · UV, Regen · Bewölkung, Staub · Feuchte).
    // werteKlug: true würde nur zeigen, was gerade etwas aussagt - Stephan will aber immer alle Werte sehen (06.10.2026),
    // deshalb ist das aus, solange es niemand einschaltet.
    var WERTE_KLUG = cfg.werteKlug === true;
    // Vollbild (07.10.2026): Knopf in der Leiste oder Doppeltipp auf die Lupe. Die Seite kann über
    // cfg.vollbild(an) ihre eigenen Leisten ausblenden; der Baustein selbst setzt die Klasse mg-vollbild.
    var VOLLBILD_CB = typeof cfg.vollbild === 'function' ? cfg.vollbild : null;
    var vollbild = false;
    var WERTE_PAARE = cfg.wertePaare || [['tide', 'wasser'], ['sonne', 'uv'], ['regen', 'wolken'], ['staub', 'feuchte']];
    var MODELLE = cfg.modelle && cfg.modelle.length ? cfg.modelle : MODELLE_STANDARD;
    var KAMERAS = cfg.kameras || {};
    // Je Ort eine Kamera oder eine Liste. Jede bekommt eine Kennung - sie ist
    // zugleich der Schlüssel im Bildspeicher.
    function kamerasVon(ortId){
      var k = KAMERAS[ortId]; if (!k) return [];
      var liste = Array.isArray(k) ? k : [k];
      return liste.map(function(c, i){ return Object.assign({ id: c.id || (i ? ortId + '-' + (i + 1) : ortId) }, c); });
    }
    function aktiveKamera(){
      var liste = kamerasVon(ort); if (!liste.length) return null;
      var gemerkt = merkLesen('cam-' + ort, '');
      var treffer = liste.filter(function(c){ return c.id === gemerkt; })[0];
      return treffer || liste[0];
    }
    var SPEICHER = cfg.bildspeicher || null;
    var PRAEFIX = cfg.merkschluessel || 'meteogramm';
    var BILD_MINUTE = cfg.bildMinute != null ? cfg.bildMinute : 7;   // kurz nach dem Speichern

    // Satelliten- und Niederschlagsbilder. Vorgabe: EUMETSAT, offen zugänglich,
    // ohne Schlüssel. `bereich` ist der gezeigte Kartenausschnitt in Grad.
    var KARTE = cfg.karte === false ? null : Object.assign({
      wms:      'https://view.eumetsat.int/geoserver/wms',
      basis:    'mtg_fd:rgb_geocolour',
      auflage:  'mtg_fd:h40b',
      schritt:  10,          // Minuten zwischen zwei Bildern
      verzug:   50,          // so viel hinkt das neueste Bild hinterher
      bilder:   13,          // so viele Bilder hat der Film (13 x 10 Min. = 2 Std.)
      quelle:   'EUMETSAT',
      link:     'https://view.eumetsat.int/'
    }, cfg.karte || {});
    // Ohne eigene Angabe ein Ausschnitt rund um den ersten Ort - so passt der
    // Baustein auch für andere Gegenden, ohne dass man etwas einstellen muss.
    if (KARTE && !KARTE.bereich) {
      var o0 = ORTE[0];
      KARTE.bereich = { sued: o0.lat - 3.5, nord: o0.lat + 3.5,
                        west: o0.lon - 6.5, ost: o0.lon + 6.5 };
    }
    var ANSICHTEN = [{ id:'webcam', name:'Webcam', icon:'📷' }];
    if (KARTE) ANSICHTEN.push({ id:'satellit', name:'Satellit', icon:'🛰️' },
                               { id:'regen', name:'Regen', icon:'🌧️' });
    var TAGE_VORHER = cfg.tageVorher != null ? cfg.tageVorher : 1;
    var TAGE_VORAUS = cfg.tageVoraus != null ? cfg.tageVoraus : 8;
    // Wahlfreie Zusätze (siehe README): Wetter-Symbol je Tag, Mond im Tagesfuß, Tipps zum Tag
    var TAGES_SYMBOL = !!cfg.tagesSymbol;
    var MOND = !!cfg.mond;
    var TIPPS = cfg.tipps || [];
    // Zeitraffer-Knopf in der Bildleiste statt des ▶ im Satellitenbild; Knöpfe mit „Jetzt“ in der Mitte
    var FILM_LEISTE = !!cfg.filmLeiste;
    // Einfarbige Symbole für die Knöpfe (statt Emojis), Farbe = Schriftfarbe des Knopfs
    var SYMBOL = {
      frisch: '<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v5h-5"/>',
      menu:   '<path d="M4 7h16M4 12h16M4 17h16"/>',
      chevl:  '<path d="M14.5 6l-6 6 6 6"/>',
      chevr:  '<path d="M9.5 6l6 6-6 6"/>',
      chevd:  '<path d="M6 9.5l6 6 6-6"/>',
      voll:   '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
      vollaus:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
      x:      '<path d="M6 6l12 12M18 6L6 18"/>',
      lupe:   '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
      plus:   '<path d="M12 6v12M6 12h12"/>',
      minus:  '<path d="M6 12h12"/>',
      ziel:   '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>'
    };
    function ico(name){ return '<svg class="mg-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SYMBOL[name] + '</svg>'; }

    // Welche Zeilen stehen zur Verfügung, in welcher Reihenfolge
    var ANGEBOT = (cfg.zeilen && cfg.zeilen.length ? cfg.zeilen : ZEILEN_STANDARD)
      .filter(function(id){ return KATALOG[id]; });
    var STANDARD_AN = cfg.zeilenStandard && cfg.zeilenStandard.length
      ? cfg.zeilenStandard.filter(function(id){ return ANGEBOT.indexOf(id) >= 0; })
      : ANGEBOT.slice();

    // Maße
    var BAND_TAG = 22, BAND_CAM = 16, TITEL_H = 22, BAND_UNTEN = 24, TAGESINFO_H = MOND ? 50 : 34;
    var ZEILE_H_SCHMAL = 72, ZEILE_H_BREIT = 92, PXH_BREIT = 24;

    var el = {}, daten = null, cache = {}, geo = null, altT0 = null, datenNr = 0;
    var pxH = 26, idxJetzt = 0, sammler = 0, camAktuell = null;
    // Zoom: 1 = normal (gut ein Tag im Bild), kleiner = mehr Tage auf einmal
    // Zoom-Stufen: die Knöpfe springen je zwei Stufen (2 / 1 / ½ / ¼ / ⅛), die
    // Zwei-Finger-Geste nimmt auch die Zwischenstufen - so fühlt sie sich feiner an.
    var ZOOMS = [2, 1.4, 1, 0.7, 0.5, 0.35, 0.25, 0.18, 0.125];
    var zoom = parseFloat(merkLesen('zoom', '1'));
    if (ZOOMS.indexOf(zoom) < 0) zoom = 1;
    var datumPlatz = 104;
    var webcam = { shots: [], speicher: false, ort: null };
    var ort = merkLesen('ort', ORTE[0].id);
    var ansicht = merkLesen('ansicht', 'webcam');
    if (!ANSICHTEN.some(function(a2){ return a2.id === ansicht; })) ansicht = 'webcam';
    var modell = merkLesen('modell', MODELLE[0].id);
    var anZeilen = leseZeilenwahl();
    var reihenfolge = leseReihenfolge();

    if (!ORTE.some(function(o){ return o.id === ort; })) ort = ORTE[0].id;
    if (!MODELLE.some(function(m){ return m.id === modell; })) modell = MODELLE[0].id;

    function merkLesen(k, fb){ try { var v = localStorage.getItem(PRAEFIX + '-' + k); return v === null ? fb : v; } catch(e){ return fb; } }
    function merkSchreiben(k, v){ try { localStorage.setItem(PRAEFIX + '-' + k, v); } catch(e){} }
    function leseZeilenwahl(){
      var roh = merkLesen('zeilen', null);
      if (!roh) return STANDARD_AN.slice();
      var liste = roh.split(',').filter(function(id){ return ANGEBOT.indexOf(id) >= 0; });
      return liste.length ? liste : STANDARD_AN.slice();
    }
    // Die Reihenfolge darf man selbst festlegen. Gespeichert wird sie als Liste
    // aller angebotenen Zeilen - neu hinzugekommene hängen wir hinten an.
    function leseReihenfolge(){
      var roh = merkLesen('reihenfolge', null);
      var liste = roh ? roh.split(',').filter(function(id){ return ANGEBOT.indexOf(id) >= 0; }) : [];
      ANGEBOT.forEach(function(id){ if (liste.indexOf(id) < 0) liste.push(id); });
      return liste;
    }
    function setzeReihenfolge(neu){
      reihenfolge = neu.slice();
      merkSchreiben('reihenfolge', reihenfolge.join(','));
    }
    function sichtbareZeilen(){
      return reihenfolge.filter(function(id){ return anZeilen.indexOf(id) >= 0; }).map(function(id){
        var z = Object.create(KATALOG[id]); z.id = id; return z;
      });
    }
    function ortObj(){ return ORTE.filter(function(o){ return o.id === ort; })[0] || ORTE[0]; }
    function modellObj(){ return MODELLE.filter(function(m){ return m.id === modell; })[0] || MODELLE[0]; }
    function zeitzone(){ return cfg.zeitzone || 'auto'; }

    // "Jetzt" in der Zeitzone des Ortes, egal wo das Gerät steht
    function jetztDort(){
      var tz = cfg.zeitzone;
      if (!tz || tz === 'auto') return new Date();
      try { return new Date(new Date().toLocaleString('en-US', { timeZone: tz })); }
      catch(e){ return new Date(); }
    }

    // ---------- Daten holen ----------

    function tippsFuerOrt(){ return TIPPS.filter(function(t){ return !t.orte || t.orte.indexOf(ort) >= 0; }); }
    function braucheMeer(){
      return sichtbareZeilen().some(function(z){ return z.meer; }) ||
        tippsFuerOrt().some(function(t){ return t.art === 'ebbe'; });
    }
    // Die Staub-Abfrage (Luftqualität) nur, wenn die Zeile zu sehen ist
    function braucheStaub(){ return sichtbareZeilen().some(function(z){ return z.luft; }); }

    // opts.still     = ohne "Lade ..."-Text, die Anzeige bleibt stehen
    // opts.behalten  = nach dem Laden wieder an dieselbe Stelle, statt auf "jetzt"
    function laden(opts){
      opts = opts || {};
      var o = ortObj(), m = modellObj();
      var key = o.id + '|' + m.id;
      var c = cache[key];
      if (c && Date.now() - c.at < 15 * 60000) { daten = c.daten; nachLaden(opts); return; }
      ladeAnzeige(true);
      if (!opts.still) melde('Lade ' + o.name + ' · ' + m.lang + ' …');

      var tz = encodeURIComponent(zeitzone());
      var stunden = 'temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,' +
        'precipitation,precipitation_probability,sunshine_duration,uv_index,pressure_msl,' +
        'wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day,direct_radiation,terrestrial_radiation';
      var urlW = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
        '&hourly=' + stunden + '&daily=sunrise,sunset&past_days=' + TAGE_VORHER +
        '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz + '&models=' + m.id;
      var meerLat = (o.meer && o.meer.lat) || o.lat, meerLon = (o.meer && o.meer.lon) || o.lon;
      var urlM = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + meerLat + '&longitude=' + meerLon +
        '&hourly=sea_level_height_msl,wave_height,sea_surface_temperature&past_days=' + TAGE_VORHER +
        '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz;

      // Saharastaub: die Luftqualitäts-Abfrage reicht höchstens 7 Tage voraus
      var urlA = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + o.lat + '&longitude=' + o.lon +
        '&hourly=dust&past_days=' + TAGE_VORHER + '&forecast_days=' + Math.min(7, TAGE_VORAUS) + '&timezone=' + tz;

      var hole = [ fetch(urlW).then(function(r){ return r.json(); }) ];
      hole.push(braucheMeer() ? fetch(urlM).then(function(r){ return r.json(); }).catch(function(){ return null; })
                              : Promise.resolve(null));
      hole.push(braucheStaub() ? fetch(urlA).then(function(r){ return r.json(); }).catch(function(){ return null; })
                               : Promise.resolve(null));

      Promise.all(hole).then(function(res){
        var w = res[0];
        if (!w || !w.hourly || !w.hourly.time) throw new Error('leer');
        // Nicht jedes Modell rechnet den UV-Index. Fehlt er, holen wir ihn
        // einzeln aus der besten Mischung - sonst bliebe die Zeile leer.
        var uvLeer = !w.hourly.uv_index || w.hourly.uv_index.every(function(v){ return v == null; });
        if (!uvLeer) return [w, res[1], null, res[2]];
        var urlU = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
          '&hourly=uv_index&past_days=' + TAGE_VORHER + '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz;
        return fetch(urlU).then(function(r){ return r.json(); })
          .then(function(u){ return [w, res[1], u, res[2]]; })
          .catch(function(){ return [w, res[1], null, res[2]]; });
      }).then(function(alles){
        daten = aufbereiten(alles[0], alles[1], alles[2], alles[3]);
        cache[key] = { at: Date.now(), daten: daten };
        nachLaden(opts);
      }).catch(function(e){
        if (global.console && console.warn) console.warn('Meteogramm:', e);
        ladeAnzeige(false);
        if (!opts.still) melde('Wetterdaten gerade nicht erreichbar – bitte später noch einmal versuchen.');
      });
    }

    function aufbereiten(w, mm, uvExtra, luft){
      var H = w.hourly, n = H.time.length;
      var d = { zeit: H.time, t0: new Date(H.time[0]), uvErsatz: false,
                sonne:[], temp:[], gefuehlt:[], wind:[], boe:[], windrichtung:[],
                regen_mm:[], regen_pct:[], uv:[], feuchte:[], wolken:[], druck:[],
                code:[], tag:[], welle:[], tide:[], wasser:[], staub:[], sonnenauf:[], sonnenunter:[] };
      var uvQuelle = H.uv_index;
      if (uvExtra && uvExtra.hourly && uvExtra.hourly.uv_index) {
        var kU = {}; uvExtra.hourly.time.forEach(function(t, i){ kU[t] = uvExtra.hourly.uv_index[i]; });
        uvQuelle = H.time.map(function(t){ return kU[t] != null ? kU[t] : null; });
        d.uvErsatz = true;
      }
      function nimm(feld, i){ return H[feld] ? H[feld][i] : null; }
      for (var i = 0; i < n; i++) {
        // Sonnenminuten aus der Sonnenkraft (direkte Strahlung im Verhältnis zum klaren Himmel);
        // nur wenn das Modell keine Strahlung liefert, die grobe Alles-oder-nichts-Zahl von Open-Meteo
        var sm = sonneMinuten(nimm('direct_radiation', i), nimm('terrestrial_radiation', i));
        d.sonne.push(sm != null ? sm : (nimm('sunshine_duration', i) == null ? null : H.sunshine_duration[i] / 60));
        d.temp.push(nimm('temperature_2m', i));
        d.gefuehlt.push(nimm('apparent_temperature', i));
        d.wind.push(nimm('wind_speed_10m', i));
        d.boe.push(nimm('wind_gusts_10m', i));
        d.windrichtung.push(nimm('wind_direction_10m', i));
        d.regen_mm.push(nimm('precipitation', i));
        d.regen_pct.push(nimm('precipitation_probability', i));
        d.uv.push(uvQuelle ? uvQuelle[i] : null);
        d.feuchte.push(nimm('relative_humidity_2m', i));
        d.wolken.push(nimm('cloud_cover', i));
        d.druck.push(nimm('pressure_msl', i));
        d.code.push(nimm('weather_code', i));
        d.tag.push(H.is_day ? H.is_day[i] : 1);
      }
      var M = mm && mm.hourly ? mm.hourly : null, kM = {};
      if (M) for (var k = 0; k < M.time.length; k++) kM[M.time[k]] = k;
      for (var j = 0; j < n; j++) {
        var mi = M ? kM[H.time[j]] : undefined;
        d.welle.push(mi == null ? null : M.wave_height[mi]);
        d.tide.push(mi == null ? null : M.sea_level_height_msl[mi]);
        d.wasser.push(mi == null ? null : M.sea_surface_temperature[mi]);
      }
      // Saharastaub stundenweise anhängen (die Luftqualität hat ein eigenes Zeitraster)
      var A = luft && luft.hourly && luft.hourly.dust ? luft.hourly : null, kA = {};
      if (A) for (var a = 0; a < A.time.length; a++) kA[A.time[a]] = A.dust[a];
      for (var b = 0; b < n; b++) d.staub.push(A && kA[H.time[b]] != null ? kA[H.time[b]] : null);
      if (w.daily) { d.sonnenauf = w.daily.sunrise || []; d.sonnenunter = w.daily.sunset || []; }
      d.tage = tageBauen(d);
      d.nr = ++datenNr;
      return d;
    }

    // Je Tag: erster/letzter Stundenindex, Sonnensumme, UV-Höchstwert, Auf-/Untergang
    function tageBauen(d){
      var tage = [], karte = {};
      for (var i = 0; i < d.zeit.length; i++) {
        var t = d.zeit[i].slice(0, 10);
        if (!karte[t]) { karte[t] = { datum: t, von: i, bis: i, sonneMin: 0, uvMax: null, tmin: null, tmax: null, regen: 0 }; tage.push(karte[t]); }
        var e = karte[t];
        e.bis = i;
        if (d.sonne[i] != null) e.sonneMin += d.sonne[i];
        if (d.uv[i] != null && (e.uvMax == null || d.uv[i] > e.uvMax)) e.uvMax = d.uv[i];
        if (d.temp[i] != null) {
          if (e.tmin == null || d.temp[i] < e.tmin) e.tmin = d.temp[i];
          if (e.tmax == null || d.temp[i] > e.tmax) e.tmax = d.temp[i];
        }
        if (d.regen_mm[i] != null) e.regen += d.regen_mm[i];
      }
      (d.sonnenauf || []).forEach(function(iso){ if (karte[iso.slice(0,10)]) karte[iso.slice(0,10)].auf = iso.slice(11,16); });
      // Wetter-Symbol je Tag, nur aus den hellen Stunden: Gewitter vor Regen vor Bewölkung
      tage.forEach(function(e){
        var sw = 0, nw = 0, regen = 0, gewitter = false;
        for (var j = e.von; j <= e.bis; j++) {
          if (!d.tag[j]) continue;
          if (d.wolken[j] != null) { sw += d.wolken[j]; nw++; }
          var c = d.code[j];
          if (c >= 95) gewitter = true;
          if (((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) && (d.regen_mm[j] || 0) >= 0.3) regen++;
        }
        var w = nw ? sw / nw : null;
        e.symbol = gewitter ? '⛈️' : regen >= 3 ? '🌧️' : regen ? '🌦️' : w == null ? '' : w < 20 ? '☀️' : w < 45 ? '🌤️' : w < 75 ? '⛅' : '☁️';
      });
      if (MOND) mondTage(tage);
      (d.sonnenunter || []).forEach(function(iso){ if (karte[iso.slice(0,10)]) karte[iso.slice(0,10)].unter = iso.slice(11,16); });
      return tage;
    }

    // Datum und Uhrzeit eines echten Zeitpunkts in der Zeitzone des Ortes
    function ortsZeit(dUtc){
      var tz = cfg.zeitzone;
      if (tz && tz !== 'auto') {
        try {
          var p = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
            .formatToParts(dUtc).reduce(function(o, q){ o[q.type] = q.value; return o; }, {});
          return { tag: p.year + '-' + p.month + '-' + p.day, uhr: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
        } catch(e){}
      }
      return { tag: dUtc.getFullYear() + '-' + pad2(dUtc.getMonth() + 1) + '-' + pad2(dUtc.getDate()), uhr: pad2(dUtc.getHours()) + ':' + pad2(dUtc.getMinutes()) };
    }
    // Je Tag: Mondphase zur Mittagszeit, dazu Neumond, Viertel und Vollmond mit Uhrzeit
    function mondTage(tage){
      if (!tage.length) return;
      var karte = {};
      tage.forEach(function(e){
        var f = mondBruch(new Date(e.datum + 'T12:00'));
        e.mond = { icon: MOND_ICON[Math.round(f * 8) % 8], name: MOND_NAME[Math.round(f * 8) % 8],
                   licht: Math.round((1 - Math.cos(2 * Math.PI * f)) / 2 * 100) };
        karte[e.datum] = e;
      });
      var a = new Date(tage[0].datum + 'T00:00'), b = new Date(tage[tage.length - 1].datum + 'T23:59');
      var k = Math.floor(((a.getTime() / 864e5 + 2440587.5) - 2451550.09766) / 29.530588861 * 4) / 4 - 0.5;
      for (var n = 0; n < 60; n++, k += 0.25) {
        var z = mondPhaseZeit(k);
        if (z > b) break;
        var o = ortsZeit(z), e = karte[o.tag];
        if (e) { var art = Math.round((k - Math.floor(k)) * 4) % 4; e.mond.ereignis = MOND_EREIGNIS[art]; e.mond.icon = MOND_ICON[art * 2]; e.mond.uhr = o.uhr; }
      }
    }

    // Sonnenschein je Stunde in Minuten (seit 06.10.2026): Anteil der direkten Strahlung an dem,
    // was bei klarem Himmel möglich wäre. Open-Meteo zählt sonst jede Stunde voll, sobald die Sonne
    // überhaupt Schatten wirft - deshalb stand dort fast immer 60, auch bei dichten Wolken.
    // Klarer Himmel: Strahlung am oberen Rand der Atmosphäre (terrestrial) mal Durchlässigkeit der Luft
    // (0,7 hoch Luftmasse^0,678, Kasten-Young-Luftmasse), mal 0,75 für Dunst und Feuchte über dem Meer
    // (so geeicht, dass das ECMWF-Modell bei 0 % Wolken auf 60 Minuten kommt).
    function sonneMinuten(direkt, terr){
      if (direkt == null || terr == null) return null;
      if (terr < 5) return 0;
      var cosz = Math.min(1, terr / 1361), z = Math.acos(cosz) * 180 / Math.PI;
      var am = 1 / (cosz + 0.50572 * Math.pow(96.07995 - z, -1.6364));
      var klar = terr * Math.pow(0.7, Math.pow(am, 0.678)) * 0.75;
      if (klar < 10) return 0;
      return Math.round(60 * Math.max(0, Math.min(1, direkt / klar)));
    }

    function idxFuer(dt){ return (dt.getTime() - daten.t0.getTime()) / 3600000; }
    function idxFuerIso(iso){ return idxFuer(new Date(iso)); }

    function nachLaden(opts){
      opts = opts || {};
      quelleText();                       // erst jetzt ist klar, woher der UV-Wert kommt
      // Die gewählte Stelle als Uhrzeit merken, nicht als Bildschirmposition:
      // rutscht das Datenfenster über Nacht um einen Tag weiter, zeigten
      // dieselben Pixel sonst dieselbe Uhrzeit am nächsten Tag.
      var altZeit = (opts.behalten && geo && altT0) ? new Date(altT0.getTime() + idxAusScroll() * 3600000) : null;
      altT0 = daten.t0;
      idxJetzt = idxFuer(jetztDort());
      camAktuell = null;                  // Kamerabild neu holen, nicht aus dem Zwischenspeicher
      var altIdx = altZeit ? idxFuer(altZeit) : null;
      if (altIdx !== null && (altIdx < 0 || altIdx > daten.zeit.length - 1)) altIdx = null;   // liegt nicht mehr im Fenster
      zeichnen(altIdx === null);
      if (altIdx !== null) zentrieren(altIdx, false);
      webcamLaden();
      if (ansicht !== 'webcam') filmVorladen();
      ladeAnzeige(false);
      naechsteAuffrischung();
    }

    // Kleine Rückmeldung am Auffrischen-Knopf, damit man sieht, dass etwas passiert.
    // Kommt die Antwort aus dem Zwischenspeicher, ist sie nach 20 ms da - dann
    // bliebe die Anzeige unsichtbar. Deshalb mindestens einen Moment stehen lassen.
    var ladeSeit = 0, ladeEnde = null;
    function ladeAnzeige(an){
      var b = document.getElementById(kid('frisch'));
      if (!b) return;
      if (ladeEnde) { clearTimeout(ladeEnde); ladeEnde = null; }
      if (an) {
        ladeSeit = Date.now();
        b.disabled = true;
        b.classList.add('is-laedt');
        return;
      }
      var rest = Math.max(0, 450 - (Date.now() - ladeSeit));
      ladeEnde = setTimeout(function(){
        ladeEnde = null;
        b.disabled = false;
        b.classList.remove('is-laedt');
      }, rest);
    }

    // ---------- Zeichnen ----------

    function skala(z){
      var vals = (daten[z.feld] || []).filter(function(v){ return v != null; });
      if (z.feld2 && daten[z.feld2]) vals = vals.concat(daten[z.feld2].filter(function(v){ return v != null; }));
      var lo = z.min != null ? z.min : Math.min.apply(null, vals);
      var hi = z.max != null ? z.max : Math.max.apply(null, vals);
      if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
      if (z.id === 'temp')  { lo = Math.floor(lo / 2) * 2 - 1; hi = Math.ceil(hi / 2) * 2 + 1; }
      if (z.id === 'wind')  { hi = Math.max(30, Math.ceil(hi / 10) * 10); }
      if (z.id === 'welle') { hi = Math.max(1, Math.ceil(hi * 2) / 2); }
      if (z.id === 'regen') { hi = Math.max(1, Math.ceil(hi * 2) / 2); }
      if (z.id === 'uv')    { hi = Math.max(8, Math.ceil(hi)); }
      if (z.id === 'druck') { lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1; }
      if (z.id === 'tide')  { var a = Math.max(Math.abs(lo), Math.abs(hi), 0.5); a = Math.ceil(a * 2) / 2; lo = -a; hi = a; }
      // Staub: die Calima-Schwelle (150) soll immer im Bild sein, bei viel Staub wächst die Skala in 100er-Schritten
      if (z.id === 'staub') { hi = Math.max(200, Math.ceil(hi / 100) * 100); }
      // Das Meer ändert seine Temperatur nur langsam - enger Ausschnitt (mindestens 1 Grad, in halben Graden), damit die Kurve sichtbar schwankt
      if (z.id === 'wasser') { lo = Math.floor((lo - 0.1) * 2) / 2; hi = Math.ceil((hi + 0.1) * 2) / 2; while (hi - lo < 1) { lo -= 0.5; if (hi - lo < 1) hi += 0.5; } }
      if (hi === lo) hi = lo + 1;
      var ticks = z.ticks;
      if (!ticks) {
        if (z.id === 'temp') { ticks = []; for (var t = lo + 1; t <= hi - 1; t += (hi - lo > 12 ? 4 : 2)) ticks.push(t); }
        else if (z.id === 'tide') ticks = [lo, 0, hi];
        else if (z.id === 'staub') ticks = hi > 400 ? [150, 300] : [50, 150];
        else if (z.id === 'wasser') { var sw = hi - lo > 2 ? 1 : 0.5; ticks = []; for (var tw = Math.ceil((lo + 0.01) / sw) * sw; tw < hi - 0.01; tw += sw) ticks.push(tw); }
        else ticks = [lo, (lo + hi) / 2, hi];
      }
      return { lo: lo, hi: hi, ticks: ticks };
    }

    function zeichnen(zentrierJetzt){
      if (!daten || !el.scroll) return;
      var W = el.scroll.clientWidth;
      if (W < 40) return;                        // gerade nicht sichtbar
      var schmal = W < 560;
      pxH = (schmal ? Math.max(18, Math.min(40, Math.floor(W / 26))) : PXH_BREIT) * zoom;
      var tagB = 24 * pxH;                       // so viele Pixel breit ist ein Tag
      var zeileH = schmal ? ZEILE_H_SCHMAL : ZEILE_H_BREIT;

      var ZEILEN = sichtbareZeilen();
      var n = daten.zeit.length;
      var padL = Math.ceil(W / 2), padR = Math.ceil(W / 2);
      var breite = padL + (n - 1) * pxH + padR;
      var x = function(i){ return padL + i * pxH; };

      var y = BAND_TAG + BAND_CAM, zeilen = [];
      ZEILEN.forEach(function(z){
        var s = skala(z);
        var extra = z.tagesinfo ? TAGESINFO_H : 0;
        var g = { z: z, s: s, y0: y + TITEL_H, h: zeileH, yt: y, extra: extra };
        g.yv = function(v){ return g.y0 + g.h - (v - s.lo) / (s.hi - s.lo) * g.h; };
        zeilen.push(g);
        y += TITEL_H + zeileH + extra;
      });
      var hoehe = y + BAND_UNTEN;
      geo = { zeilen: zeilen, padL: padL, hoehe: hoehe, breite: breite, x: x, n: n };

      var s = ['<svg class="mg-svg" width="' + breite + '" height="' + hoehe + '" viewBox="0 0 ' + breite + ' ' + hoehe + '">'];
      var plotOben = BAND_TAG + BAND_CAM, plotUnten = hoehe - BAND_UNTEN;

      // Nachtstunden abdunkeln
      var nachtStart = null;
      for (var i = 0; i <= n; i++) {
        var istNacht = i < n && !daten.tag[i];
        if (istNacht && nachtStart === null) nachtStart = i;
        if (!istNacht && nachtStart !== null) {
          s.push('<rect class="mg-nacht" x="' + (x(nachtStart) - pxH / 2) + '" y="' + plotOben + '" width="' + ((i - nachtStart) * pxH) + '" height="' + (plotUnten - plotOben) + '"/>');
          nachtStart = null;
        }
      }

      // Titelbänder je Zeile, dazu die waagerechten Hilfslinien
      zeilen.forEach(function(g){
        s.push('<rect class="mg-titelband" x="0" y="' + g.yt + '" width="' + breite + '" height="' + TITEL_H + '"/>');
        if (g.extra) s.push('<rect class="mg-tagesband" x="0" y="' + (g.y0 + g.h) + '" width="' + breite + '" height="' + g.extra + '"/>');
        g.s.ticks.forEach(function(t){
          var yy = g.yv(t);
          s.push('<line class="mg-grid" x1="' + x(0) + '" y1="' + yy + '" x2="' + x(n - 1) + '" y2="' + yy + '"/>');
        });
      });

      // Senkrechte: alle 6 Stunden fein, Tagesgrenzen kräftig, oben Datum, unten Uhrzeit
      var heuteStr = jetztDort().toDateString();
      var stdSchritt = pxH >= 9 ? 6 : pxH >= 4.5 ? 12 : 24;
      var mitSymbol = TAGES_SYMBOL && tagB >= 170, kurzDatum = tagB < 64;
      datumPlatz = mitSymbol ? 190 : kurzDatum ? 44 : 70;
      for (var i2 = 0; i2 < n; i2++) {
        var iso = daten.zeit[i2], hh = parseInt(iso.slice(11, 13), 10);
        if (hh % stdSchritt !== 0) continue;
        var istTag = hh === 0;
        s.push('<line class="' + (istTag ? 'mg-tag' : 'mg-grid') + '" x1="' + x(i2) + '" y1="' + BAND_TAG + '" x2="' + x(i2) + '" y2="' + plotUnten + '"/>');
        if (stdSchritt < 24) s.push('<text class="mg-std" x="' + x(i2) + '" y="' + (hoehe - 7) + '" text-anchor="middle">' + iso.slice(11, 16) + '</text>');
        if (istTag) {
          var dt = new Date(iso);
          var lab = (dt.toDateString() === heuteStr) ? 'Heute' : WOCHENTAG[dt.getDay()] + ' ' + pad2(dt.getDate()) + '.' + (kurzDatum ? '' : pad2(dt.getMonth() + 1) + '.');
          if (mitSymbol) {
            var tg = daten.tage.filter(function(t){ return t.datum === iso.slice(0, 10); })[0];
            if (tg && tg.symbol) lab += '   ' + tg.symbol + ' ' + Math.round(tg.tmax) + '° / ' + Math.round(tg.tmin) + '°';
          }
          s.push('<text class="mg-datum" x="' + (x(i2) + 6) + '" y="15" data-x="' + (x(i2) + 6) + '">' + lab + '</text>');
        }
      }

      // Die Zeilen selbst
      zeilen.forEach(function(g){ zeichneZeile(s, g, x, n, pxH); });

      s.push('<g id="' + kid('cam-band') + '"></g>');

      if (idxJetzt >= 0 && idxJetzt < n) {
        s.push('<line class="mg-jetzt" x1="' + x(idxJetzt) + '" y1="' + BAND_TAG + '" x2="' + x(idxJetzt) + '" y2="' + plotUnten + '"/>');
        var std = ((idxJetzt % 24) + 24) % 24;
        if (Math.min(std, 24 - std) > 2.5) s.push('<text class="mg-jetzt-t" x="' + (x(idxJetzt) + 4) + '" y="15">Jetzt</text>');
      }
      s.push('</svg>');
      el.svgWrap.innerHTML = s.join('');
      el.svgWrap.style.height = hoehe + 'px';
      el.wrap.style.height = hoehe + 'px';

      // Feste Achse links
      var a = [];
      zeilen.forEach(function(g){
        a.push('<div class="mg-ax-titel" style="top:' + g.yt + 'px;height:' + TITEL_H + 'px">' +
          '<span class="mg-ax-punkt" style="background:' + g.z.farbe + '"></span>' +
          esc(g.z.titel) + (g.z.einheit ? ' <small>in ' + esc(g.z.einheit) + '</small>' : '') + '</div>');
        g.s.ticks.forEach(function(t){
          var ty = Math.max(g.y0, Math.min(g.y0 + g.h - 14, g.yv(t) - 7));
          var txt = (g.z.id === 'welle' || g.z.id === 'tide' || g.z.id === 'regen' || (g.z.id === 'wasser' && t % 1)) ? dez(t, 1) : Math.round(t);
          a.push('<div class="mg-ax-tick" style="top:' + ty + 'px">' + txt + '</div>');
        });
        if (g.z.wertlinie) a.push('<div class="mg-ax-wert" id="' + kid('wlw-' + g.z.id) + '" style="color:' + g.z.farbe + '" hidden></div>');
      });
      a.push('<div class="mg-ax-datum" id="' + kid('ax-datum') + '" style="top:0;height:' + BAND_TAG + 'px"></div>');
      el.achse.innerHTML = a.join('');
      el.achse.style.height = hoehe + 'px';

      webcamMarken();
      if (zentrierJetzt) zentrieren(idxJetzt, false); else anzeigen();
      datumsLabelsPruefen();
      zoomKnoepfe();
    }

    function zeichneZeile(s, g, x, n, pxH){
      var z = g.z, F = daten[z.feld] || [];
      if (z.art === 'balken') {
        var F2 = z.feld2 ? daten[z.feld2] : null;
        for (var i = 0; i < n; i++) {
          if (F[i] == null) continue;
          var bx = z.vorher ? x(i) - pxH + 1 : x(i) - pxH / 2 + 1, bw = Math.max(1, pxH - 2);
          if (F2 && F2[i] != null) {
            var y2 = g.yv(Math.min(F2[i], g.s.hi));
            s.push('<rect class="mg-balken2" x="' + bx + '" y="' + y2 + '" width="' + bw + '" height="' + (g.y0 + g.h - y2) + '" fill="' + z.farbe + '"/>');
          }
          var y1 = g.yv(Math.min(F[i], g.s.hi));
          var farbe = z.farbskala === 'uv' ? uvFarbe(F[i]) : z.farbskala === 'staub' ? staubFarbe(F[i]) : z.farbe;
          s.push('<rect class="mg-balken" x="' + bx + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, g.y0 + g.h - y1) + '" fill="' + farbe + '"/>');
        }
      } else {
        zeichneLinie(s, g, x, n, F, z.farbe, 'mg-linie', true);
        if (z.feld2 && daten[z.feld2]) zeichneLinie(s, g, x, n, daten[z.feld2], z.farbe, 'mg-linie2', false);
      }

      // Wahrscheinlichkeit als dünne Linie über den Millimeter-Balken
      if (z.prozentlinie && daten[z.prozentlinie]) {
        var P = daten[z.prozentlinie], pts = [];
        for (var p = 0; p < n; p++) if (P[p] != null) pts.push([x(p), g.y0 + g.h - (P[p] / 100) * g.h]);
        if (pts.length > 1) s.push('<path class="mg-linie2" d="' + pfadAus(pts, false) + '" stroke="#8fd0f0"/>');
      }

      // Windpfeile: zeigen, wohin der Wind weht
      if (z.pfeile && daten[z.pfeile]) {
        var R = daten[z.pfeile], schritt = Math.max(2, Math.ceil(16 / pxH));
        for (var q = 0; q < n; q += schritt) {
          if (R[q] == null) continue;
          var py = g.y0 + g.h - 7, px = x(q);
          s.push('<g class="mg-pfeil" transform="translate(' + px.toFixed(1) + ' ' + py + ') rotate(' + ((R[q] + 180) % 360) + ')">' +
                 '<path d="M0 -5 L3 4 L0 2 L-3 4 Z" fill="' + z.farbe + '" opacity="0.85"/></g>');
        }
      }

      // Sonnenauf- und -untergang in das Titelband der Sonnenzeile
      if (z.id === 'sonne' && 24 * pxH >= 110) {
        (daten.sonnenauf || []).forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↑ ' + iso.slice(11, 16) + '</text>'); });
        (daten.sonnenunter || []).forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↓ ' + iso.slice(11, 16) + '</text>'); });
      }

      if (z.extrema === 'tag') {
        tagesExtrema(F).forEach(function(e){
          s.push('<circle cx="' + x(e.i) + '" cy="' + g.yv(e.v) + '" r="3" fill="' + z.farbe + '"/>');
          if (24 * pxH >= 60) s.push('<text class="mg-mark" x="' + x(e.i) + '" y="' + (e.hoch ? g.yv(e.v) - 7 : g.yv(e.v) + 14) + '" text-anchor="middle">' + (e.hoch ? '↑ ' : '↓ ') + Math.round(e.v) + '°</text>');
        });
      }
      if (z.extrema === 'tide') {
        var ex = tideExtrema(F);
        // Gepunktete Linie über die Hochwasser-Spitzen: zeigt, ob die Flut stärker (Springflut) oder schwächer wird
        if (z.huelle) {
          var spitzen = ex.filter(function(e){ return e.hoch; }).map(function(e){ return [x(e.i), g.yv(e.v) - 4]; });
          if (spitzen.length > 1) s.push('<path class="mg-huelle" d="' + pfadAus(spitzen, true) + '" stroke="' + z.farbe + '"/>');
        }
        ex.forEach(function(e){
          s.push('<circle cx="' + x(e.i) + '" cy="' + g.yv(e.v) + '" r="' + (pxH < 5 ? 2.5 : 3.5) + '" fill="' + z.farbe + '"/>');
          var dt = new Date(daten.t0.getTime() + e.i * 3600000);
          if (pxH >= 7) s.push('<text class="mg-mark" x="' + x(e.i) + '" y="' + (e.hoch ? g.yv(e.v) - 8 : g.yv(e.v) + 15) + '" text-anchor="middle">' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + '</text>');
        });
      }

      // Waagerechte Linie auf Höhe des gewählten Werts (Lage wird beim Wischen nachgeführt)
      if (z.wertlinie) s.push('<line class="mg-wertlinie" id="' + kid('wl-' + z.id) + '" x1="' + x(0) + '" x2="' + x(n - 1) + '" y1="0" y2="0" stroke="' + z.farbe + '" visibility="hidden"/>');
      // Punkt auf der Kurve an der gewählten Stelle (nur bei Linien, nicht bei Balken)
      if (z.wertlinie && z.art !== 'balken') s.push('<circle class="mg-wertpunkt" id="' + kid('wp-' + z.id) + '" r="3.5" fill="' + z.farbe + '" visibility="hidden"/>');

      // Tages-Fußzeile unter der Sonnenzeile
      if (z.tagesinfo && g.extra && 24 * pxH >= 60) {
        var basis = g.y0 + g.h;
        daten.tage.forEach(function(t){
          var mitte = x((t.von + t.bis) / 2);
          if (t.bis - t.von < 6) return;                 // angeschnittene Tage weglassen
          var stunden = t.sonneMin / 60;
          s.push('<text class="mg-tagesinfo-stark" x="' + mitte + '" y="' + (basis + 15) + '" text-anchor="middle">☀ ' + dez(stunden, 1) + ' h</text>');
          if (24 * pxH < 150) return;              // herausgezoomt: nur die Sonnenstunden
          var unten = (t.auf && t.unter ? t.auf + ' – ' + t.unter : '') + (t.uvMax != null ? '  ·  UV ' + Math.round(t.uvMax) : '');
          if (unten) s.push('<text class="mg-tagesinfo" x="' + mitte + '" y="' + (basis + 28) + '" text-anchor="middle">' + unten + '</text>');
          if (MOND && t.mond) {
            var mt = t.mond.ereignis ? t.mond.icon + ' ' + t.mond.ereignis + ' ' + t.mond.uhr : t.mond.icon + ' ' + t.mond.name + ' · ' + t.mond.licht + ' %';
            s.push('<text class="mg-tagesinfo' + (t.mond.ereignis ? ' mg-tagesinfo-stark' : '') + '" x="' + mitte + '" y="' + (basis + 43) + '" text-anchor="middle">' + mt + '</text>');
          }
        });
      }
    }

    function zeichneLinie(s, g, x, n, F, farbe, klasse, mitFlaeche){
      var pts = [];
      for (var i = 0; i < n; i++) if (F[i] != null) pts.push([x(i), g.yv(F[i])]);
      if (pts.length < 2) return;
      var pfad = pfadAus(pts, !!g.z.glatt);
      if (mitFlaeche) {
        var unten = g.y0 + g.h;
        s.push('<path class="mg-flaeche" d="' + pfad + ' L' + pts[pts.length-1][0].toFixed(1) + ' ' + unten + ' L' + pts[0][0].toFixed(1) + ' ' + unten + ' Z" fill="' + farbe + '"/>');
      }
      s.push('<path class="' + klasse + '" d="' + pfad + '" stroke="' + farbe + '"/>');
    }

    function pfadAus(p, glatt){
      if (!glatt) return p.map(function(q, k){ return (k ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
      var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i-1] || p[i], p1 = p[i], p2 = p[i+1], p3 = p[i+2] || p2;
        d += ' C' + (p1[0] + (p2[0]-p0[0])/6).toFixed(1) + ' ' + (p1[1] + (p2[1]-p0[1])/6).toFixed(1) +
             ' ' + (p2[0] - (p3[0]-p1[0])/6).toFixed(1) + ' ' + (p2[1] - (p3[1]-p1[1])/6).toFixed(1) +
             ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d;
    }

    function tagesExtrema(F){
      var out = [], tag = null, hi = null, lo = null;
      function schliessen(){ if (hi) out.push({ i: hi.i, v: hi.v, hoch: true }); if (lo) out.push({ i: lo.i, v: lo.v, hoch: false }); hi = lo = null; }
      for (var i = 0; i < F.length; i++) {
        if (F[i] == null) continue;
        var t = daten.zeit[i].slice(0, 10);
        if (t !== tag) { schliessen(); tag = t; }
        if (!hi || F[i] > hi.v) hi = { i: i, v: F[i] };
        if (!lo || F[i] < lo.v) lo = { i: i, v: F[i] };
      }
      schliessen();
      return out;
    }

    // Hoch- und Niedrigwasser: Scheitel einer Parabel durch drei Stundenwerte
    function tideExtrema(F){
      var out = [];
      for (var i = 1; i < F.length - 1; i++) {
        var a = F[i-1], b = F[i], c = F[i+1];
        if (a == null || b == null || c == null) continue;
        var hoch = b >= a && b >= c && (b > a || b > c), tief = b <= a && b <= c && (b < a || b < c);
        if (!hoch && !tief) continue;
        var nenner = a - 2*b + c, shift = nenner === 0 ? 0 : 0.5 * (a - c) / nenner;
        if (shift > 1 || shift < -1) shift = 0;
        var neu = { i: i + shift, v: b - 0.25 * (a - c) * shift, hoch: hoch }, vorige = out[out.length - 1];
        if (vorige && vorige.hoch === hoch && neu.i - vorige.i < 2) { vorige.i = (vorige.i + neu.i) / 2; continue; }
        out.push(neu);
      }
      return out;
    }

    // ---------- Auswahl und Anzeige ----------

    function idxAusScroll(){ return el.scroll.scrollLeft / pxH; }
    function zentrieren(idx, weich){
      if (!geo) return;
      idx = Math.max(0, Math.min(geo.n - 1, idx));
      // Sanftes Scrollen fuehrt der Browser in einem Hintergrund-Tab nicht aus -
      // dann lieber hart springen, sonst passiert gar nichts.
      var sanft = weich && !document.hidden;
      try { el.scroll.scrollTo({ left: idx * pxH, behavior: sanft ? 'smooth' : 'auto' }); }
      catch(e){ el.scroll.scrollLeft = idx * pxH; }
      anzeigen();
      datumsLabelsPruefen();
    }

    function wertBei(z, f){
      var F = daten[z.feld] || [], n = F.length;
      if (z.art === 'balken') {
        var i = z.vorher ? Math.ceil(f) : Math.round(f);
        i = Math.max(0, Math.min(n - 1, i));
        return { v: F[i], v2: z.feld2 && daten[z.feld2] ? daten[z.feld2][i] : null, i: i };
      }
      var i0 = Math.max(0, Math.floor(f)), i1 = Math.min(n - 1, i0 + 1), t = f - i0;
      var v = (F[i0] == null || F[i1] == null) ? (F[i0] != null ? F[i0] : F[i1]) : F[i0] + (F[i1] - F[i0]) * t;
      var v2 = null;
      if (z.feld2 && daten[z.feld2]) { var G = daten[z.feld2]; v2 = G[i0] != null ? G[i0] : G[i1]; }
      return { v: v, v2: v2, i: i0 };
    }

    function anzeigen(){
      if (!daten || !geo || sammler) return;
      // Kurz sammeln statt bei jedem Scroll-Pixel neu rechnen. Kein
      // requestAnimationFrame: das steht still, solange der Tab im Hintergrund ist.
      sammler = setTimeout(function(){
        sammler = 0;
        var f = Math.max(0, Math.min(geo.n - 1, idxAusScroll()));
        var dt = new Date(daten.t0.getTime() + f * 3600000);
        var diff = f - idxJetzt;
        var rel = Math.abs(diff) < 0.5 ? 'jetzt' : (diff < 0 ? 'vor ' : 'in ') + relText(Math.abs(diff));
        el.zeit.innerHTML = '<b>' + pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '. · ' +
          pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + '</b> <span class="mg-rel">' + rel + '</span>';

        // Jetzt-Knopf: zeigt den Abstand ("+14 h") und ruht, wenn der Strich schon auf jetzt steht
        var aufJetzt = Math.abs(diff) < 0.5;
        var jb = document.getElementById(kid('jetzt')), jr = document.getElementById(kid('jrel'));
        if (jr) jr.textContent = aufJetzt ? '' : (diff < 0 ? '−' : '+') + relKurz(Math.abs(diff));
        if (jb) jb.disabled = aufJetzt;
        // Rand-Pfeile: liegt "jetzt" außerhalb des sichtbaren Bereichs, zeigt ein Pfeil die Richtung
        var halb = el.scroll.clientWidth / 2 / pxH;
        var rpl = document.getElementById(kid('rpl')), rpr = document.getElementById(kid('rpr'));
        if (rpl) rpl.classList.toggle('is-da', idxJetzt < f - halb + 0.5);
        if (rpr) rpr.classList.toggle('is-da', idxJetzt > f + halb - 0.5);
        sichtMitte();

        var links = Math.max(0, Math.min(geo.n - 1, f - el.scroll.clientWidth / 2 / pxH + 0.5));
        var dtL = new Date(daten.t0.getTime() + Math.floor(links) * 3600000);
        datumsLabelsPruefen();

        var axd = document.getElementById(kid('ax-datum'));
        if (axd) {
          var axt = (dtL.toDateString() === jetztDort().toDateString())
            ? 'Heute' : WOCHENTAG[dtL.getDay()] + ' ' + pad2(dtL.getDate()) + '.' + pad2(dtL.getMonth() + 1) + '.';
          if (TAGES_SYMBOL) {
            var tgL = daten.tage.filter(function(t){ return t.datum === dtL.getFullYear() + '-' + pad2(dtL.getMonth() + 1) + '-' + pad2(dtL.getDate()); })[0];
            if (tgL && tgL.symbol) axt += '  ' + tgL.symbol + ' ' + Math.round(tgL.tmax) + '° / ' + Math.round(tgL.tmin) + '°';
          }
          axd.textContent = axt;
        }

        var iR = Math.max(0, Math.min(geo.n - 1, Math.round(f)));
        var code = daten.code[iR];
        el.lage.innerHTML = code != null
          ? '<span class="mg-lage-i">' + wmoIcon(code, daten.tag[iR]) + '</span>' + esc(WMO_TEXT[code] || '')
          : '';

        // Schmale Zeile im Kopf (06.10.2026): nur, was im Diagramm nicht an der Achse abzulesen ist -
        // Zeilen ohne Wertlinie (Sonne, Regen) sowie "gefühlt" und "Böen", die sonst verloren gingen.
        var zellen = [], sicht = sichtbareZeilen();
        sicht.forEach(function(z){
          if (z.wertlinie) return;
          var w = wertBei(z, f);
          if (w.v == null) return;
          if (WERTE_KLUG && z.zaehlt && !z.zaehlt(w.v, daten, iR)) return;
          var c = z.zelle ? z.zelle(w.v, w.v2, daten, iR, null) : { wert: z.fmt(w.v, w.v2), einheit: '' };
          zellen.push(zelleHtml(z.kurz || z.titel, c, z.farbe));
        });
        sicht.forEach(function(z){
          var w;
          if (z.id === 'temp') { w = wertBei(z, f); if (w.v2 != null) zellen.push(zelleHtml('gefühlt', { wert: Math.round(w.v2), einheit: '°' }, z.farbe)); }
          if (z.id === 'wind') {
            w = wertBei(z, f);
            var r = daten.windrichtung && daten.windrichtung[iR] != null ? HIMMEL[Math.round(daten.windrichtung[iR] / 45) % 8] : '';
            if (w.v2 != null) zellen.push(zelleHtml('Böen', { wert: Math.round(w.v2), einheit: 'km/h', zusatz: r }, z.farbe));
            else if (r) zellen.push(zelleHtml('Wind aus', { wert: r, einheit: '' }, z.farbe));
          }
        });
        if (daten.wasser[iR] != null && anZeilen.indexOf('wasser') < 0) {
          zellen.push(zelleHtml('Wasser', { wert: Math.round(daten.wasser[iR]), einheit: '°' }, '#3fa9c9'));
        }
        el.werte.innerHTML = zellen.join('');
        el.werte.hidden = !zellen.length;
        wertlinienSetzen(f);
        tippsZeigen(f);
        bildZeigen(f);
      }, 16);
    }

    // Das Diagramm ist auf dem Handy höher als der Bildschirm. Rand-Pfeile und Zoom-Hinweis
    // sollen dort stehen, wo man gerade hinschaut: in der Mitte des sichtbaren Ausschnitts.
    function sichtMitte(){
      if (!el.wrap) return;
      var r = el.wrap.getBoundingClientRect(), H = global.innerHeight || r.height;
      var oben = Math.max(r.top, 0), unten = Math.min(r.bottom, H);
      var mitte = (unten > oben) ? (oben + unten) / 2 - r.top : r.height / 2;
      mitte = Math.max(48, Math.min(r.height - 48, mitte));
      el.wrap.style.setProperty('--mg-sicht-mitte', Math.round(mitte) + 'px');
    }

    function wertlinienSetzen(f){
      geo.zeilen.forEach(function(g){
        if (!g.z.wertlinie) return;
        var linie = document.getElementById(kid('wl-' + g.z.id)), marke = document.getElementById(kid('wlw-' + g.z.id));
        if (!linie || !marke) return;
        var w = wertBei(g.z, f), punkt = document.getElementById(kid('wp-' + g.z.id));
        if (w.v == null) { linie.setAttribute('visibility', 'hidden'); marke.hidden = true; if (punkt) punkt.setAttribute('visibility', 'hidden'); return; }
        var yy = g.yv(Math.max(g.s.lo, Math.min(g.s.hi, w.v)));
        var xx = geo.padL + f * pxH;
        // Linie wie bei Marea: von der Achse bis zum Punkt an der gewählten Stelle
        linie.setAttribute('x1', el.scroll.scrollLeft); linie.setAttribute('x2', xx);
        linie.setAttribute('y1', yy); linie.setAttribute('y2', yy); linie.setAttribute('visibility', 'visible');
        if (punkt) { punkt.setAttribute('cx', xx); punkt.setAttribute('cy', yy); punkt.setAttribute('visibility', 'visible'); }
        // Zahl an der Achse, so formatiert wie in der Werteliste (Tide mit zwei Stellen)
        var iR = Math.max(0, Math.min(geo.n - 1, Math.round(f)));
        var c = g.z.id === 'tide' ? { wert: dez(w.v, 2) } : (g.z.zelle ? g.z.zelle(w.v, w.v2, daten, iR, null) : { wert: dez(w.v, 1) });
        marke.textContent = String(c.wert);
        marke.style.top = Math.max(g.y0 - 2, Math.min(g.y0 + g.h - 12, yy - 8)) + 'px';
        marke.hidden = false;
      });
    }

    function zoomen(richtung, fein){
      var k0 = ZOOMS.indexOf(zoom), k = k0 + richtung * (fein ? 1 : 2);
      k = Math.max(0, Math.min(ZOOMS.length - 1, k));
      if (k === k0) return;
      // Nicht weiter herauszoomen, wenn schon alles ins Bild passt
      if (richtung > 0 && geo && (geo.n - 1) * pxH < el.scroll.clientWidth * 0.8) return;
      var mitte = idxAusScroll();
      zoom = ZOOMS[k]; merkSchreiben('zoom', String(zoom));
      zeichnen(false);
      zentrieren(mitte, false);
      zoomKnoepfe();
      zoomHinweis();
    }
    // Kurz eingeblendet: "1 Tag im Bild" - man weiß immer, wie viel man gerade sieht
    var hinweisTimer = 0;
    function zoomHinweis(){
      var h = document.getElementById(kid('zoomhinweis'));
      if (!h || !el.scroll) return;
      var std = el.scroll.clientWidth / pxH, t;
      if (std < 30) t = Math.round(std) + ' Stunden im Bild';
      else {
        var tg = Math.round(std / 12) / 2;
        t = (tg === 1 ? '1 Tag' : String(tg).replace('.', ',') + ' Tage') + ' im Bild';
      }
      h.textContent = t; h.classList.add('is-da');
      clearTimeout(hinweisTimer);
      hinweisTimer = setTimeout(function(){ h.classList.remove('is-da'); }, 900);
    }
    function zoomKnoepfe(){
      var k = ZOOMS.indexOf(zoom);
      var rein = document.getElementById(kid('zoomrein')), raus = document.getElementById(kid('zoomraus'));
      if (rein) rein.disabled = k <= 0;
      if (raus) raus.disabled = k >= ZOOMS.length - 1 || (geo && (geo.n - 1) * pxH < el.scroll.clientWidth * 0.8);
    }

    // ---------- Tipps zum Tag ----------
    // Aus den Stundenwerten des Tages unter dem Strich: wann Strand, wann Wind, wann Ebbe.
    function tippsZeigen(f){
      if (!el.tipps) return;
      var liste = tippsFuerOrt();
      if (!liste.length) { el.tipps.hidden = true; return; }
      var iR = Math.max(0, Math.min(daten.zeit.length - 1, Math.round(f)));
      var tagStr = daten.zeit[iR].slice(0, 10), key = ort + '|' + daten.nr + '|' + tagStr + '|' + Math.floor(idxJetzt);
      if (el.tipps.getAttribute('data-key') === key) return;
      var tag = daten.tage.filter(function(t){ return t.datum === tagStr; })[0];
      if (!tag) return;
      var dt = new Date(tagStr + 'T12:00');
      var kopf = dt.toDateString() === jetztDort().toDateString() ? 'Heute' : WOCHENTAG[dt.getDay()] + ' ' + pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '.';
      var zeilen = liste.map(function(t){
        var r = tippRechnen(t, tag);
        return r ? '<div class="mg-tipp"><span class="mg-tipp-i">' + esc(t.icon || '•') + '</span><span><b>' + esc(t.titel) + '</b> · ' + r + '</span></div>' : '';
      }).join('');
      el.tipps.innerHTML = '<div class="mg-tipps-kopf">' + esc(kopf) + ' – was der Tag bringt</div>' + zeilen;
      el.tipps.setAttribute('data-key', key);
      el.tipps.hidden = false;
    }
    function stundeText(i){ var d = new Date(daten.t0.getTime() + i * 3600000); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
    function vonBis(a, b){ return parseInt(stundeText(a), 10) + '–' + parseInt(stundeText(b + 1), 10) + ' Uhr'; }
    // Längster zusammenhängender Abschnitt heller Stunden, in denen alles passt
    function fenster(tag, passt){
      var best = null, start = null;
      for (var i = tag.von; i <= tag.bis + 1; i++) {
        var ok = i <= tag.bis && daten.tag[i] && passt(i);
        if (ok && start === null) start = i;
        if (!ok && start !== null) { if (!best || i - 1 - start > best.b - best.a) best = { a: start, b: i - 1 }; start = null; }
      }
      return best && best.b - best.a >= 1 ? best : null;     // mindestens zwei Stunden
    }
    function schonVorbei(fe){
      if (fe.b + 1 <= idxJetzt) return ' <span class="mg-tipp-alt">(schon vorbei)</span>';
      if (fe.a < idxJetzt) return ' <span class="mg-tipp-alt">(läuft gerade)</span>';
      return '';
    }
    function tippRechnen(t, tag){
      var W = daten.wind, i;
      if (t.art === 'strand') {
        var gruende = { wind: 0, regen: 0, wolken: 0, kuehl: 0 };
        var fe = fenster(tag, function(j){
          var r = (daten.regen_mm[j] || 0) >= 0.1 || (daten.regen_pct[j] || 0) >= 35, w = (W[j] || 0) >= (t.windBis || 25);
          var k = (daten.wolken[j] || 0) >= 85, c = (daten.temp[j] || 0) < (t.abGrad || 20);
          if (r) gruende.regen++; if (w) gruende.wind++; if (k) gruende.wolken++; if (c) gruende.kuehl++;
          return !r && !w && !k && !c;
        });
        if (!fe) {
          var g = Object.keys(gruende).sort(function(x, y){ return gruende[y] - gruende[x]; })[0];
          return 'eher kein Strandwetter – ' + { wind: 'zu windig', regen: 'Regen möglich', wolken: 'viele Wolken', kuehl: 'zu kühl' }[g];
        }
        var tmax = -99, ws = 0;
        for (i = fe.a; i <= fe.b; i++) { tmax = Math.max(tmax, daten.temp[i]); ws += W[i]; }
        return 'am schönsten ' + vonBis(fe.a, fe.b) + ' · bis ' + Math.round(tmax) + '°, Wind um ' + Math.round(ws / (fe.b - fe.a + 1)) + ' km/h' + schonVorbei(fe);
      }
      if (t.art === 'wind') {
        var von = t.von || 22, bis = t.bis || 50, wmax = 0;
        for (i = tag.von; i <= tag.bis; i++) if (daten.tag[i] && W[i] > wmax) wmax = W[i];
        var fw = fenster(tag, function(j){ return W[j] >= von && W[j] <= bis; });
        if (!fw) return wmax < von ? 'zu wenig Wind (höchstens ' + Math.round(wmax) + ' km/h)' : 'zu stürmisch (bis ' + Math.round(wmax) + ' km/h)';
        var lo = 999, hi = 0;
        for (i = fw.a; i <= fw.b; i++) { lo = Math.min(lo, W[i]); hi = Math.max(hi, W[i]); }
        var mitte = Math.round((fw.a + fw.b) / 2), r2 = daten.windrichtung[mitte];
        return 'guter Wind ' + vonBis(fw.a, fw.b) + ' · ' + Math.round(lo) + '–' + Math.round(hi) + ' km/h' +
          (r2 != null ? ' aus ' + HIMMEL[Math.round(r2 / 45) % 8] : '') + schonVorbei(fw);
      }
      if (t.art === 'ebbe') {
        if (!daten.tide.some(function(v){ return v != null; })) return 'Gezeiten gerade nicht abrufbar';
        var tiefs = tideExtrema(daten.tide).filter(function(e){ return !e.hoch && e.i >= tag.von - 0.5 && e.i < tag.bis + 0.5; });
        // Gut ist die Zeit von etwa 2 Stunden vor bis 1 Stunde nach Niedrigwasser -
        // aber nur, soweit es hell ist. Bleibt davon weniger als eine Stunde, zählt es nicht.
        var vor = t.vorher != null ? t.vorher : 2, nach = t.nachher != null ? t.nachher : 1;
        var auf = tag.auf ? idxFuerIso(tag.datum + 'T' + tag.auf) : tag.von + 7, unter = tag.unter ? idxFuerIso(tag.datum + 'T' + tag.unter) : tag.von + 19;
        var nutzbar = tiefs.map(function(e){ return { e: e, a: Math.max(e.i - vor, auf), b: Math.min(e.i + nach, unter) }; })
          .filter(function(x){ return x.b - x.a >= 1; });
        if (!nutzbar.length) return 'Niedrigwasser nur im Dunkeln' + (tiefs.length ? ' (' + tiefs.map(function(e){ return stundeText(e.i); }).join(', ') + ' Uhr)' : '');
        return nutzbar.map(function(x){
          var alt = x.b <= idxJetzt ? ' <span class="mg-tipp-alt">(schon vorbei)</span>' : '';
          var dunkel = x.b < x.e.i + nach - 0.01 ? ' <span class="mg-tipp-alt">(dann wird es dunkel)</span>' : '';
          return 'Niedrigwasser ' + stundeText(x.e.i) + ' Uhr, gut etwa ' + stundeText(x.a) + '–' + stundeText(x.b) + ' Uhr' + dunkel + alt;
        }).join(' · ') + (t.text ? ' <span class="mg-tipp-alt">' + esc(t.text) + '</span>' : '');
      }
      return '';
    }

    // Eine Zeile der Werteliste: Bezeichnung links, rechts ein oder mehrere Werte (je Wert Zahl, Einheit, Zusatz)
    function zelleHtml(titel, teile, farbe){
      if (!Array.isArray(teile)) teile = [teile];
      return '<div class="mg-wert" style="--c:' + farbe + '">' +
        '<span class="mg-wl">' + esc(titel) + '</span>' +
        '<span class="mg-wr">' + teile.map(function(c){
          return '<span class="mg-wv">' + c.wert + (c.einheit ? '<small>' + esc(c.einheit) + '</small>' : '') + '</span>' +
            (c.zusatz ? '<span class="mg-wz">' + esc(c.zusatz) + '</span>' : '');
        }).join('<span class="mg-sep">·</span>') + '</span></div>';
    }

    // Datum im Diagramm verstecken, solange es unter der festen Achse läge -
    // sonst stünde es doppelt neben dem Datum am linken Rand.
    function datumsLabelsPruefen(){
      if (!el.svgWrap || !el.scroll) return;
      var links2 = el.scroll.scrollLeft;
      [].forEach.call(el.svgWrap.querySelectorAll('.mg-datum'), function(t){
        t.style.visibility = (parseFloat(t.getAttribute('data-x')) - links2 < Math.max(datumPlatz, TAGES_SYMBOL ? 190 : 104)) ? 'hidden' : '';
      });
    }

    function relText(h){
      if (h < 1) return Math.round(h * 60) + ' Min.';
      if (h < 36) return Math.round(h) + ' Std.';
      var t = Math.round(h / 24); return t + (t === 1 ? ' Tag' : ' Tagen');
    }
    // Knappe Form für den Jetzt-Knopf: "14 h", "3 Tage"
    function relKurz(h){
      if (h < 1) return Math.round(h * 60) + ' Min.';
      if (h < 36) return Math.round(h) + ' h';
      var t = Math.round(h / 24); return t + (t === 1 ? ' Tag' : ' Tage');
    }
    function wmoIcon(c, tag){ if (!tag && (c === 0 || c === 1)) return '🌙'; return WMO_ICON[c] || '🌤️'; }
    function melde(t){ if (el.zeit) { el.zeit.innerHTML = '<span class="mg-rel">' + esc(t) + '</span>'; el.werte.innerHTML = ''; } }

    // ---------- Webcam ----------

    function webcamLaden(){
      var cam = aktiveKamera();
      var schluessel = ort + '/' + (cam ? cam.id : '-');
      webcam = { shots: [], ort: schluessel, speicher: false };
      camWahlMalen();
      if (!SPEICHER || !cam) { webcamMarken(); anzeigen(); return; }
      fetch(SPEICHER + '/webcam?ort=' + encodeURIComponent(cam.id))
        .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(j){
          if (!j || !Array.isArray(j.shots) || webcam.ort !== schluessel) return;
          webcam.speicher = true;
          webcam.shots = j.shots.map(function(sh){
            return { i: idxFuerIso(sh.t), url: sh.url.indexOf('http') === 0 ? sh.url : SPEICHER + sh.url };
          });
          webcamMarken(); anzeigen();
        })
        .catch(function(){ webcamMarken(); anzeigen(); });
      webcamMarken();
    }

    function liveUrl(cam){
      var t = Math.floor(Date.now() / 300000);
      return cam.live + (cam.live.indexOf('?') < 0 ? '?' : '&') + 'fv=' + t;
    }

    function webcamMarken(){
      var g = document.getElementById(kid('cam-band'));
      if (!g || !geo) return;
      var s = [];
      webcam.shots.forEach(function(sh){
        if (sh.i < 0 || sh.i >= geo.n) return;
        s.push('<rect class="mg-cam-mark" x="' + (geo.x(sh.i) - 2) + '" y="' + (BAND_TAG + 3) + '" width="4" height="' + (BAND_CAM - 7) + '" rx="1"/>');
      });
      if (aktiveKamera() && idxJetzt >= 0 && idxJetzt < geo.n) {
        s.push('<rect class="mg-cam-mark is-live" x="' + (geo.x(idxJetzt) - 3) + '" y="' + (BAND_TAG + 3) + '" width="6" height="' + (BAND_CAM - 7) + '" rx="1.5"/>');
      }
      g.innerHTML = s.join('');
    }

    // Umschalter zwischen mehreren Kameras eines Orts (nur wenn es mehrere gibt)
    function camWahlMalen(){
      var box = document.getElementById(kid('camwahl')); if (!box) return;
      var liste = kamerasVon(ort), akt = aktiveKamera();
      if (liste.length < 2) { box.innerHTML = ''; box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = liste.map(function(c){
        return '<button type="button" class="mg-camtab' + (akt && c.id === akt.id ? ' is-on' : '') + '" data-id="' + esc(c.id) + '">' + esc(c.kurz || c.name.split(',')[0]) + '</button>';
      }).join('');
    }

    function webcamZeigen(f){
      if (!el.cam) return;
      var cam = aktiveKamera();
      if (!cam) { el.cam.hidden = true; return; }
      el.cam.hidden = false;

      var zukunft = f > idxJetzt + 0.5, jetztStunde = Math.abs(f - idxJetzt) <= 0.5;
      var best = null, bestD = 1e9;
      webcam.shots.forEach(function(sh){ var d = Math.abs(sh.i - f); if (d < bestD) { bestD = d; best = sh; } });
      var treffer = (best && bestD <= 0.75) ? best : null;

      var url = null, stempel = null, live = false;
      if (jetztStunde && cam.live) { url = liveUrl(cam); live = true; }
      else if (treffer) { url = treffer.url; stempel = new Date(daten.t0.getTime() + treffer.i * 3600000); }

      if (!url) {
        el.cam.classList.add('is-leer');
        el.camText.innerHTML = zukunft
          ? 'Für die Zukunft gibt es noch kein Bild – das entsteht erst, wenn die Stunde da ist.'
          : (webcam.speicher ? 'Für diese Zeit liegt kein Bild vor.'
             : 'Vergangene Stunden erscheinen hier, sobald der Bildspeicher eingerichtet ist. Das Bild der laufenden Stunde siehst du über „Jetzt“.');
        return;
      }
      el.cam.classList.remove('is-leer');
      if (camAktuell !== url) { camAktuell = url; el.camImg.src = url; }
      var quelle = cam.seite ? '<a href="' + esc(cam.seite) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(cam.quelle || 'Quelle') + ' ↗</a>' : esc(cam.quelle || '');
      el.camText.innerHTML = '<b>📷 ' + esc(cam.name) + '</b>' +
        (cam.hinweis ? ' <span class="mg-camhint">' + esc(cam.hinweis) + '</span>' : '') +
        (live ? ' <span class="mg-live">live</span>'
              : ' · ' + pad2(stempel.getDate()) + '.' + pad2(stempel.getMonth() + 1) + '. ' + pad2(stempel.getHours()) + ':' + pad2(stempel.getMinutes())) +
        (quelle ? ' · ' + quelle : '');
    }

    // ---------- Satelliten- und Regenkarte ----------

    // Achtung, zwei Zeitwelten: die Werte im Diagramm tragen die Ortszeit des
    // Urlaubsorts, gelesen als wäre es die Zeit des Geräts. Der Bildserver will
    // dagegen echte Weltzeit. Der Unterschied ist genau die Verschiebung
    // zwischen Gerät und Urlaubsort.
    // Auf volle Minuten runden: jetztDort() geht über eine Textausgabe und
    // schwankt um Sekunden - sonst verschluckt die Beschriftung eine Minute.
    function zeitVersatz(){ return Math.round((jetztDort().getTime() - Date.now()) / 60000) * 60000; }
    function ortszeitNachEcht(datum){ return new Date(datum.getTime() - zeitVersatz()); }
    function echtNachOrtszeit(datum){ return new Date(datum.getTime() + zeitVersatz()); }

    // Das neueste verfügbare Bild (echte Zeit), auf das Raster abgerundet
    function neuestesBild(){
      var ms = KARTE.schritt * 60000;
      return new Date(Math.floor((Date.now() - KARTE.verzug * 60000) / ms) * ms);
    }

    // Zu einem Zeitpunkt aus dem Diagramm das passende Bild - nie aus der Zukunft
    function kartenZeit(ortsDatum){
      var ms = KARTE.schritt * 60000;
      var t = Math.min(ortszeitNachEcht(ortsDatum).getTime(), neuestesBild().getTime());
      return new Date(Math.floor(t / ms) * ms);
    }

    function kartenUrl(zeit, mitRegen){
      var b = KARTE.bereich;
      // In Grad gerechnet wären die Bilder in die Breite gezogen; nahe am
      // Äquator ist ein Längengrad kürzer als ein Breitengrad.
      var mitte = (b.sued + b.nord) / 2;
      var breiteGrad = (b.ost - b.west) * Math.cos(mitte * Math.PI / 180);
      var hoehe = 480, breite = Math.round(hoehe * breiteGrad / (b.nord - b.sued));
      return KARTE.wms + '?service=WMS&version=1.3.0&request=GetMap&styles=' +
        '&crs=EPSG:4326&bbox=' + b.sued + ',' + b.west + ',' + b.nord + ',' + b.ost +
        '&width=' + breite + '&height=' + hoehe +
        '&layers=' + encodeURIComponent(mitRegen ? KARTE.auflage : KARTE.basis) +
        (mitRegen ? '&format=image/png&transparent=true' : '&format=image/jpeg') +
        '&time=' + zeit.toISOString().replace(/\.\d+Z$/, '.000Z');
    }

    function kartenSeitenverhaeltnis(){
      var b = KARTE.bereich;
      var mitte = (b.sued + b.nord) / 2;
      return ((b.ost - b.west) * Math.cos(mitte * Math.PI / 180)) / (b.nord - b.sued);
    }

    var filmLaeuft = false, filmUhr = null, filmIdx = 0;

    function kartenZeigen(f){
      if (!KARTE || !el.karte) return;
      var zeit = filmLaeuft ? filmZeit(filmIdx) : kartenZeit(new Date(daten.t0.getTime() + f * 3600000));
      kartenBildSetzen(zeit);
    }

    function filmZeit(i){
      return new Date(neuestesBild().getTime() - (KARTE.bilder - 1 - i) * KARTE.schritt * 60000);
    }

    var kartenAktuell = null;
    function kartenBildSetzen(zeit){
      var mitRegen = ansicht === 'regen';
      var schluessel = zeit.getTime() + '|' + mitRegen;
      if (kartenAktuell === schluessel) return;
      kartenAktuell = schluessel;
      el.kBasis.src = kartenUrl(zeit, false);
      el.kAuflage.hidden = !mitRegen;
      if (mitRegen) el.kAuflage.src = kartenUrl(zeit, true);
      var o = echtNachOrtszeit(zeit);      // beschriftet wird in Ortszeit des Urlaubsorts
      el.kText.innerHTML = '<b>' + (mitRegen ? '🌧️ Niederschlag' : '🛰️ Satellit') + '</b> · ' +
        pad2(o.getDate()) + '.' + pad2(o.getMonth() + 1) + '. ' + pad2(o.getHours()) + ':' + pad2(o.getMinutes()) +
        ' · <a href="' + esc(KARTE.link) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(KARTE.quelle) + ' ↗</a>';
    }

    function filmSchalten(){
      if (filmLaeuft) { filmStopp(); return; }
      filmLaeuft = true; filmIdx = 0;
      el.play.textContent = '⏸';
      el.play.setAttribute('aria-label', 'Film anhalten');
      el.karte.classList.add('is-film');
      filmUhr = setInterval(function(){
        filmIdx = (filmIdx + 1) % (KARTE.bilder + 3);      // am Ende kurz stehen bleiben
        kartenBildSetzen(filmZeit(Math.min(filmIdx, KARTE.bilder - 1)));
      }, 420);
      kartenBildSetzen(filmZeit(0));
    }
    function filmStopp(){
      filmLaeuft = false;
      if (filmUhr) { clearInterval(filmUhr); filmUhr = null; }
      if (el.play) { el.play.textContent = '▶'; el.play.setAttribute('aria-label', 'Film abspielen'); }
      if (el.karte) el.karte.classList.remove('is-film');
      kartenAktuell = null;
      anzeigen();
    }

    // ---------- Zeitraffer (cfg.filmLeiste) ----------
    // Der Auswahl-Strich wandert selbst durch die letzten Stunden: Datum, Werte, Tipps und
    // Bild laufen mit - bei der Webcam die gespeicherten Bilder, bei Satellit und Regen die
    // Aufnahmen von EUMETSAT. Am Ende kurz stehen bleiben, dann von vorn (Schleife).
    var TEMPO = { ruhig: 900, normal: 550, flott: 300 };
    var zf = { aktiv: false, laeuft: false, uhr: null, bilder: [], i: 0, halt: 0,
               spanne: +merkLesen('film-spanne', 2) || 2, tempo: merkLesen('film-tempo', 'normal') };
    if (!TEMPO[zf.tempo]) zf.tempo = 'normal';
    function zfSchrittweite(){        // Minuten zwischen zwei Bildern: nie mehr als gut zwei Dutzend Bilder
      if (ansicht === 'webcam') return zf.spanne <= 12 ? 30 : 60;
      return zf.spanne <= 2 ? KARTE.schritt : zf.spanne <= 12 ? 30 : 60;
    }
    // Die Bildzeitpunkte als Stellen im Diagramm
    function zfBilder(){
      var schritt = zfSchrittweite() / 60, ende;
      if (ansicht === 'webcam') ende = idxJetzt;
      else ende = idxFuer(echtNachOrtszeit(neuestesBild()));
      var anfang = ende - zf.spanne, liste = [];
      // auf volle Schritte legen (z. B. :00 und :30), das letzte Bild ist immer das neueste
      var erstes = Math.ceil((anfang - 1e-6) / schritt) * schritt;
      for (var t = erstes; t < ende - 1e-6; t += schritt) liste.push(t);
      liste.push(ende);
      zf.bilder = liste.filter(function(i){ return i >= 0; });
      zfVorladen();
    }
    function zfVorladen(){
      if (document.documentElement.getAttribute('data-datensparen') === '1') return;   // Datensparmodus: erst beim Zeigen
      zf.bilder.forEach(function(i){
        if (ansicht === 'webcam') {
          var best = null, bd = 1e9;
          webcam.shots.forEach(function(sh){ var d = Math.abs(sh.i - i); if (d < bd) { bd = d; best = sh; } });
          if (best && bd <= 0.75) { var im = new Image(); im.src = best.url; }
        } else if (KARTE) {
          var z = kartenZeit(new Date(daten.t0.getTime() + i * 3600000));
          var im2 = new Image(); im2.src = kartenUrl(z, false);
          if (ansicht === 'regen') { var im3 = new Image(); im3.src = kartenUrl(z, true); }
        }
      });
    }
    function zfSchritt(){
      if (!zf.bilder.length) return;
      if (zf.i >= zf.bilder.length) zf.i = 0;
      zentrieren(zf.bilder[zf.i], false);
      zfLeiste();
    }
    function zfTakt(){
      if (zf.halt > 0) { zf.halt--; if (!zf.halt) { zf.i = 0; zfSchritt(); } return; }
      if (zf.i >= zf.bilder.length - 1) { zf.halt = 3; return; }      // letztes Bild kurz stehen lassen
      zf.i++; zfSchritt();
    }
    function zfSpielen(){
      zf.laeuft = true;
      if (zf.uhr) clearInterval(zf.uhr);
      zf.uhr = setInterval(zfTakt, TEMPO[zf.tempo]);
      ansichtReiterMalen(); zfLeiste();
    }
    function zfPause(){
      zf.laeuft = false;
      if (zf.uhr) { clearInterval(zf.uhr); zf.uhr = null; }
      ansichtReiterMalen(); zfLeiste();
    }
    function zfSchalten(){
      if (!daten) return;
      if (zf.laeuft) { zfPause(); return; }
      if (!zf.aktiv) { zf.aktiv = true; zfBilder(); zf.i = 0; zf.halt = 0; zfSchritt(); }
      zfSpielen();
    }
    function zfBeenden(zurueckAufJetzt){
      zfPause();
      zf.aktiv = false;
      if (el.film) el.film.hidden = true;
      ansichtReiterMalen();
      if (zurueckAufJetzt) zentrieren(idxJetzt, true);
    }
    // Die schmale Leiste unter dem Bild: Fortschritt, Zeitraum, Tempo
    function zfLeiste(){
      if (!el.film) return;
      if (!zf.aktiv) { el.film.hidden = true; return; }
      var n = zf.bilder.length, i = Math.min(zf.i, n - 1);
      function uhrAn(idx){ var d = new Date(daten.t0.getTime() + idx * 3600000); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
      var anteil = n > 1 ? i / (n - 1) * 100 : 100;
      var spannen = [2, 6, 12, 24].map(function(h){
        return '<button type="button" class="mg-film-wahl' + (h === zf.spanne ? ' is-on' : '') + '" data-spanne="' + h + '">' + h + ' Std.</button>';
      }).join('');
      var tempi = ['ruhig', 'normal', 'flott'].map(function(t){
        return '<button type="button" class="mg-film-wahl' + (t === zf.tempo ? ' is-on' : '') + '" data-tempo="' + t + '">' + t + '</button>';
      }).join('');
      el.film.innerHTML =
        '<div class="mg-film-balken"><i style="width:' + anteil.toFixed(1) + '%"></i></div>' +
        '<div class="mg-film-kopf"><span><b>' + (zf.laeuft ? 'Zeitraffer' : 'Angehalten') + '</b> · ' + uhrAn(zf.bilder[0]) + ' → ' + uhrAn(zf.bilder[n - 1]) +
          ' · Bild ' + (i + 1) + ' von ' + n + '</span>' +
          '<button type="button" class="mg-film-ende" data-ende="1">✕ zurück zu jetzt</button></div>' +
        '<div class="mg-film-zeile"><span class="mg-film-was">Rückblick</span>' + spannen + '</div>' +
        '<div class="mg-film-zeile"><span class="mg-film-was">Tempo</span>' + tempi + '</div>';
      el.film.hidden = false;
    }

    // Bilder des Films vorab holen, damit er nicht ruckelt
    function filmVorladen(){
      if (!KARTE) return;
      // Datensparmodus der einbettenden Seite: Bilder erst beim Abspielen holen
      if (document.documentElement.getAttribute('data-datensparen') === '1') return;
      for (var i = 0; i < KARTE.bilder; i++) {
        var im = new Image(); im.src = kartenUrl(filmZeit(i), false);
        if (ansicht === 'regen') { var im2 = new Image(); im2.src = kartenUrl(filmZeit(i), true); }
      }
    }

    // Verteilt je nach gewählter Ansicht
    function bildZeigen(f){
      if (ansicht === 'webcam') { if (el.karte) el.karte.hidden = true; webcamZeigen(f); return; }
      if (el.cam) el.cam.hidden = true;
      if (el.karte) el.karte.hidden = false;
      kartenZeigen(f);
    }

    function ansichtSetzen(id){
      if (ansicht === id) return;
      filmStopp();
      if (zf.aktiv) { ansicht = id; merkSchreiben('ansicht', id); kartenAktuell = null; camAktuell = null; zfBilder(); ansichtReiterMalen(); zfSchritt(); return; }
      ansicht = id;
      merkSchreiben('ansicht', id);
      kartenAktuell = null; camAktuell = null;
      ansichtReiterMalen();
      anzeigen();
      if (id !== 'webcam') filmVorladen();
    }

    function ansichtReiterMalen(){
      if (!el.ansichten) return;
      el.ansichten.innerHTML = (FILM_LEISTE ? '<button type="button" class="mg-atab mg-filmknopf' + (zf.laeuft ? ' is-on' : '') + '" data-film="1" aria-label="' +
          (zf.laeuft ? 'Zeitraffer anhalten' : 'Zeitraffer abspielen') + '">' + (zf.laeuft ? '❚❚' : '▶') + '</button>' : '') +
        ANSICHTEN.map(function(a2){
        return '<button type="button" class="mg-atab' + (a2.id === ansicht ? ' is-on' : '') + '" data-id="' + a2.id + '">' +
               a2.icon + ' ' + esc(a2.name) + '</button>';
      }).join('');
    }

    // ---------- Oberfläche ----------

    var lfdNr = (einbauen.zaehler = (einbauen.zaehler || 0) + 1);
    function kid(name){ return 'mg' + lfdNr + '-' + name; }

    function aufbauen(){
      wurzel.classList.add('mg');
      wurzel.innerHTML =
        '<div class="mg-top">' +
          '<div class="mg-tabs" id="' + kid('orte') + '" role="tablist" aria-label="Ort"></div>' +
          // Wettermodell als kleines Feld "Mix ▾" rechts neben den Orten; Antippen klappt die Liste auf
          '<span class="mg-modell" id="' + kid('modelle') + '">' +
            '<button type="button" class="mg-modell-btn" id="' + kid('mbtn') + '" aria-expanded="false" aria-haspopup="listbox" title="Wettermodell wählen"></button>' +
            '<div class="mg-modell-panel" id="' + kid('mpanel') + '" role="listbox" aria-label="Wettermodell" hidden></div>' +
          '</span>' +
        '</div>' +
        // Datum, Uhrzeit und Wetterlage als Fahne oben am Auswahl-Strich; sie bleibt beim Scrollen stehen
        '<div class="mg-readout">' +
          '<div class="mg-zeit"><span id="' + kid('zeit') + '"></span><span class="mg-lage" id="' + kid('lage') + '"></span></div>' +
          // darunter die schmale Zeile mit den Werten, die im Diagramm keine Achsen-Zahl haben
          '<div class="mg-werte" id="' + kid('werte') + '"></div>' +
        '</div>' +
        '<div class="mg-wrap" id="' + kid('wrap') + '">' +
          '<div class="mg-scroll" id="' + kid('scroll') + '"><div class="mg-svgwrap" id="' + kid('svgwrap') + '"></div></div>' +
          '<div class="mg-achse" id="' + kid('achse') + '"></div>' +
          '<div class="mg-cursor" aria-hidden="true"></div>' +
          // Rand-Pfeile: erscheinen, wenn "jetzt" aus dem Bild gewischt ist, und führen zurück
          '<button type="button" class="mg-randpfeil mg-randpfeil-l" id="' + kid('rpl') + '" aria-label="Zurück zu jetzt" title="Zurück zu jetzt">' + ico('chevl') + ico('ziel') + '</button>' +
          '<button type="button" class="mg-randpfeil mg-randpfeil-r" id="' + kid('rpr') + '" aria-label="Zurück zu jetzt" title="Zurück zu jetzt">' + ico('ziel') + ico('chevr') + '</button>' +
          // Zoom: kleines − 🔍 + rechts unten (dazu Zwei-Finger-Geste und Strg+Mausrad). Der Halter haftet
          // am unteren Bildrand über der Knopfleiste, solange das Diagramm länger ist als der Bildschirm.
          '<div class="mg-ecke-halter"><div class="mg-ecke">' +
            '<button type="button" class="mg-btn" id="' + kid('zoomraus') + '" aria-label="Herauszoomen: mehr Tage zeigen" title="Mehr Tage zeigen">' + ico('minus') + '</button>' +
            '<button type="button" class="mg-ecke-lupe" id="' + kid('lupe') + '" aria-label="Vollbild: zweimal tippen" title="Zweimal tippen: Vollbild an/aus">' + ico('lupe') + '</button>' +
            '<button type="button" class="mg-btn" id="' + kid('zoomrein') + '" aria-label="Hineinzoomen: weniger Stunden zeigen" title="Genauer zeigen">' + ico('plus') + '</button>' +
          '</div></div>' +
          '<div class="mg-zoomhinweis" id="' + kid('zoomhinweis') + '" aria-live="polite"></div>' +
        '</div>' +
        // Knopfleiste direkt unter dem Diagramm: ↻ links, ‹ Jetzt › als Gruppe in der Mitte, ☰ rechts.
        // Sie haftet unten am Bildschirm, solange das Tool im Bild ist (CSS: position sticky).
        '<div class="mg-knoepfe">' +
          '<button type="button" class="mg-btn mg-btn-frisch" id="' + kid('frisch') + '" aria-label="Werte auffrischen" title="Werte neu holen">' + ico('frisch') + '</button>' +
          '<div class="mg-mitte"><div class="mg-gruppe">' +
            '<button type="button" class="mg-btn" id="' + kid('zurueck') + '" aria-label="Einen Tag zurück" title="Einen Tag zurück">' + ico('chevl') + '</button>' +
            '<button type="button" class="mg-btn mg-btn-jetzt" id="' + kid('jetzt') + '" title="Zu jetzt springen und Werte neu holen"><span class="mg-jt">Jetzt</span><span class="mg-jrel" id="' + kid('jrel') + '"></span></button>' +
            '<button type="button" class="mg-btn" id="' + kid('vor') + '" aria-label="Einen Tag vor" title="Einen Tag vor">' + ico('chevr') + '</button>' +
          '</div></div>' +
          '<span class="mg-rechts">' +
          '<button type="button" class="mg-btn mg-btn-voll" id="' + kid('voll') + '" aria-pressed="false" aria-label="Vollbild" title="Vollbild: Kopf- und Fußleiste der Seite ausblenden">' + ico('voll') + '</button>' +
          '<span class="mg-zeilenwahl">' +
            '<button type="button" class="mg-btn" id="' + kid('zbtn') + '" aria-expanded="false" aria-label="Welche Zeilen anzeigen?" title="Welche Zeilen anzeigen?">' + ico('menu') + '</button>' +
            '<div class="mg-zeilen-panel" id="' + kid('zpanel') + '" hidden><h4>Welche Zeilen?</h4></div>' +
          '</span></span>' +
        '</div>' +
        // Im Vollbild: × oben rechts am Bildschirm führt zurück
        '<button type="button" class="mg-vollbild-x" id="' + kid('vollx') + '" aria-label="Vollbild beenden" title="Vollbild beenden" hidden>' + ico('x') + '</button>' +
        (ANSICHTEN.length > 1 ? '<div class="mg-ansichten" id="' + kid('ansichten') + '" role="tablist" aria-label="Bildansicht"></div>' : '') +
        (KARTE ? '<div class="mg-karte" id="' + kid('karte') + '" hidden>' +
          '<img class="mg-k-basis" id="' + kid('kbasis') + '" alt="Satellitenbild" decoding="async">' +
          '<img class="mg-k-auflage" id="' + kid('kauflage') + '" alt="" decoding="async" hidden>' +
          (FILM_LEISTE ? '' : '<button type="button" class="mg-play" id="' + kid('play') + '" aria-label="Film abspielen">▶</button>') +
          '<div class="mg-cam-text" id="' + kid('ktext') + '"></div>' +
        '</div>' : '') +
        '<div class="mg-cam" id="' + kid('cam') + '" hidden><img id="' + kid('camimg') + '" alt="Webcam-Bild" decoding="async" referrerpolicy="no-referrer">' +
          '<div class="mg-camwahl" id="' + kid('camwahl') + '" hidden></div>' +
          '<div class="mg-cam-text" id="' + kid('camtext') + '"></div></div>' +
        (FILM_LEISTE ? '<div class="mg-film" id="' + kid('film') + '" hidden></div>' : '') +
        '<div class="mg-tipps" id="' + kid('tipps') + '" hidden></div>' +
        '<div class="mg-foot"><span>← Wischen → · Antippen holt die Stelle in die Mitte · Doppeltipp springt zu jetzt · Zwei Finger zoomen</span><span id="' + kid('quelle') + '"></span></div>';

      el.scroll  = document.getElementById(kid('scroll'));
      el.svgWrap = document.getElementById(kid('svgwrap'));
      el.achse   = document.getElementById(kid('achse'));
      el.wrap    = document.getElementById(kid('wrap'));
      el.zeit    = document.getElementById(kid('zeit'));
      el.werte   = document.getElementById(kid('werte'));
      el.cam     = document.getElementById(kid('cam'));
      el.quelle  = document.getElementById(kid('quelle'));
      el.lage    = document.getElementById(kid('lage'));
      el.tipps   = document.getElementById(kid('tipps'));
      el.ansichten = document.getElementById(kid('ansichten'));
      if (KARTE) {
        el.karte    = document.getElementById(kid('karte'));
        el.kBasis   = document.getElementById(kid('kbasis'));
        el.kAuflage = document.getElementById(kid('kauflage'));
        el.kText    = document.getElementById(kid('ktext'));
        el.play     = document.getElementById(kid('play'));
        el.karte.style.aspectRatio = kartenSeitenverhaeltnis().toFixed(3);
        if (el.play) el.play.addEventListener('click', function(ev){ ev.stopPropagation(); filmSchalten(); });
        el.kBasis.addEventListener('error', function(){
          el.kText.textContent = 'Für diesen Zeitpunkt gibt es noch kein Satellitenbild.';
        });
      }
      if (el.ansichten) {
        ansichtReiterMalen();
        el.ansichten.addEventListener('click', function(ev){
          var b2 = ev.target.closest('.mg-atab'); if (!b2) return;
          if (b2.getAttribute('data-film')) { zfSchalten(); return; }
          ansichtSetzen(b2.getAttribute('data-id'));
        });
      }
      el.camImg = document.getElementById(kid('camimg'));
      el.camText = document.getElementById(kid('camtext'));
      el.camImg.addEventListener('load', function(){
        // Ein 344 Pixel breites Kamerabild sieht auf einem breiten Bildschirm
        // matschig aus - deshalb nur so weit aufziehen, wie es verträgt.
        var w = el.camImg.naturalWidth || 0;
        el.cam.style.maxWidth = w ? Math.max(360, Math.round(w * 1.6)) + 'px' : '';
      });
      document.getElementById(kid('camwahl')).addEventListener('click', function(ev){
        var b2 = ev.target.closest('.mg-camtab'); if (!b2) return;
        merkSchreiben('cam-' + ort, b2.getAttribute('data-id'));
        camAktuell = null;
        webcamLaden();
      });
      el.camImg.addEventListener('error', function(){
        el.cam.classList.add('is-leer');
        el.camText.textContent = 'Das Kamerabild ist gerade nicht erreichbar.';
      });

      if (ORTE.length < 2) document.getElementById(kid('orte')).style.display = 'none';
      if (MODELLE.length < 2) document.getElementById(kid('modelle')).style.display = 'none';
      reiter(kid('orte'), ORTE, function(){ return ort; }, function(id){ if (zf.aktiv) zfBeenden(false); ort = id; merkSchreiben('ort', id); laden(); });
      modellWahl();
      zeilenPanel();
      sortierenImDiagramm();

      el.scroll.addEventListener('scroll', anzeigen, { passive: true });
      global.addEventListener('scroll', sichtMitte, { passive: true });
      global.addEventListener('resize', sichtMitte);
      // Wer selbst ins Diagramm greift, übernimmt - der Zeitraffer hört auf
      ['pointerdown', 'wheel', 'touchstart'].forEach(function(t){
        el.scroll.addEventListener(t, function(){ if (zf.aktiv) zfBeenden(false); }, { passive: true });
      });
      ['jetzt', 'frisch', 'zurueck', 'vor'].forEach(function(n){
        document.getElementById(kid(n)).addEventListener('pointerdown', function(){ if (zf.aktiv) zfBeenden(false); });
      });
      if (FILM_LEISTE) {
        el.film = document.getElementById(kid('film'));
        el.film.addEventListener('click', function(ev){
          var b = ev.target.closest('button'); if (!b) return;
          if (b.getAttribute('data-spanne')) { zf.spanne = +b.getAttribute('data-spanne'); merkSchreiben('film-spanne', zf.spanne); zfBilder(); zf.i = 0; zfSchritt(); }
          if (b.getAttribute('data-tempo')) { zf.tempo = b.getAttribute('data-tempo'); merkSchreiben('film-tempo', zf.tempo); if (zf.laeuft) { zfPause(); zfSpielen(); } else zfLeiste(); }
          if (b.getAttribute('data-ende')) zfBeenden(true);
        });
      }
      // Zu jetzt springen und dabei gleich neue Werte holen - vom Knopf, vom Rand-Pfeil und per Doppeltipp
      // Erst sanft hinscrollen, dann nachladen: kommen die neuen Werte mitten im
      // Scrollen an, bleibt das Diagramm sonst irgendwo auf halbem Weg stehen.
      var jetztTimer = 0;
      function zuJetzt(){
        zentrieren(idxJetzt, true);
        clearTimeout(jetztTimer);
        jetztTimer = setTimeout(function(){ jetztTimer = 0; auffrischen(false); }, document.hidden ? 0 : 650);
      }
      // Einmal tippen setzt den Strich dorthin, zweimal schnell tippen springt zu jetzt.
      // Der einfache Tipp wartet deshalb kurz, ob ein zweiter folgt.
      var tippTimer = 0;
      el.scroll.addEventListener('click', function(ev){
        if (!geo) return;
        if (tippTimer) { clearTimeout(tippTimer); tippTimer = 0; zuJetzt(); return; }
        var r = el.scroll.getBoundingClientRect();
        var idx = (ev.clientX - r.left + el.scroll.scrollLeft - geo.padL) / pxH;
        tippTimer = setTimeout(function(){ tippTimer = 0; zentrieren(idx, true); }, 280);
      });
      document.getElementById(kid('jetzt')).addEventListener('click', zuJetzt);
      document.getElementById(kid('rpl')).addEventListener('click', zuJetzt);
      document.getElementById(kid('rpr')).addEventListener('click', zuJetzt);
      document.getElementById(kid('frisch')).addEventListener('click', function(){ auffrischen(true); });

      // Vollbild: Knopf, × oben rechts, Doppeltipp auf die Lupe
      document.getElementById(kid('voll')).addEventListener('click', function(){ vollbildSetzen(!vollbild); });
      document.getElementById(kid('vollx')).addEventListener('click', function(){ vollbildSetzen(false); });
      var lupeTipp = 0;
      document.getElementById(kid('lupe')).addEventListener('click', function(){
        var jetzt = Date.now();
        if (jetzt - lupeTipp < 350) { lupeTipp = 0; vollbildSetzen(!vollbild); }
        else lupeTipp = jetzt;
      });

      // Zoom-Gesten: zwei Finger auseinander/zusammen (Handy) und Strg + Mausrad (Laptop).
      // Je Stufe genügt eine deutliche Bewegung; danach zählt der Abstand neu.
      var kneif = null;
      function fingerAbstand(ev){ var a = ev.touches[0], b = ev.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
      el.scroll.addEventListener('touchstart', function(ev){ if (ev.touches.length === 2) kneif = fingerAbstand(ev); }, { passive: true });
      el.scroll.addEventListener('touchmove', function(ev){
        if (ev.touches.length !== 2 || kneif === null) return;
        ev.preventDefault();                           // die Seite soll dabei nicht mitzoomen
        var d = fingerAbstand(ev), q = d / kneif;
        if (q > 1.12) { zoomen(-1, true); kneif = d; }
        else if (q < 0.89) { zoomen(1, true); kneif = d; }
      }, { passive: false });
      ['touchend', 'touchcancel'].forEach(function(t){ el.scroll.addEventListener(t, function(ev){ if (ev.touches.length < 2) kneif = null; }, { passive: true }); });
      var radSperre = 0;
      el.scroll.addEventListener('wheel', function(ev){
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        if (radSperre) return;
        radSperre = setTimeout(function(){ radSperre = 0; }, 250);
        zoomen(ev.deltaY > 0 ? 1 : -1, true);
      }, { passive: false });
      document.getElementById(kid('zurueck')).addEventListener('click', function(){ zentrieren(idxAusScroll() - 24, true); });
      document.getElementById(kid('vor')).addEventListener('click', function(){ zentrieren(idxAusScroll() + 24, true); });
      document.getElementById(kid('zoomraus')).addEventListener('click', function(){ zoomen(1); });
      document.getElementById(kid('zoomrein')).addEventListener('click', function(){ zoomen(-1); });

      var letzteBreite = 0;
      if (global.ResizeObserver) {
        new ResizeObserver(function(){
          var w = el.scroll.clientWidth;
          if (w > 40 && w !== letzteBreite) {
            var alt = geo ? idxAusScroll() : null;
            letzteBreite = w; zeichnen(alt === null);
            if (alt !== null) zentrieren(alt, false);
          }
        }).observe(el.scroll);
      } else {
        global.addEventListener('resize', function(){ zeichnen(false); });
      }
    }

    function reiter(id, liste, aktiv, setz){
      var box = document.getElementById(id);
      function malen(){
        box.innerHTML = liste.map(function(e){
          return '<button type="button" role="tab" class="mg-tab' + (e.id === aktiv() ? ' is-on' : '') + '" data-id="' + esc(e.id) + '"' +
            ' aria-selected="' + (e.id === aktiv()) + '"' + (e.hinweis ? ' title="' + esc(e.hinweis) + '"' : '') + '>' + esc(e.name) + '</button>';
        }).join('');
      }
      malen();
      box.addEventListener('click', function(ev){
        var b = ev.target.closest('.mg-tab'); if (!b) return;
        setz(b.getAttribute('data-id')); malen();
      });
    }

    // Vollbild an/aus: Klasse am Baustein, Knopf-Symbol, × einblenden, Seite benachrichtigen
    function vollbildSetzen(an){
      an = !!an;
      if (an === vollbild) return;
      vollbild = an;
      wurzel.classList.toggle('mg-vollbild', an);
      var b = document.getElementById(kid('voll')), x = document.getElementById(kid('vollx'));
      if (b) { b.innerHTML = ico(an ? 'vollaus' : 'voll'); b.setAttribute('aria-pressed', String(an)); b.title = an ? 'Vollbild beenden' : 'Vollbild: Kopf- und Fußleiste der Seite ausblenden'; }
      if (x) x.hidden = !an;
      if (VOLLBILD_CB) { try { VOLLBILD_CB(an); } catch(e){} }
      // Die haftende Fahne rutscht beim Umschalten nach oben - das Diagramm soll dabei an Ort und Stelle bleiben
      setTimeout(function(){ sichtMitte(); zoomKnoepfe(); }, 320);
    }

    // Wettermodell: Feld "Mix ▾" mit Aufklapp-Liste (Name, Langname, Hinweis)
    function modellWahl(){
      var btn = document.getElementById(kid('mbtn')), panel = document.getElementById(kid('mpanel'));
      if (!btn || !panel) return;
      function malen(){
        var m = modellObj();
        btn.innerHTML = esc(m.name) + ' ' + ico('chevd');
        btn.title = 'Wettermodell: ' + m.lang;
        panel.innerHTML = MODELLE.map(function(e){
          return '<button type="button" role="option" class="mg-modell-opt' + (e.id === modell ? ' is-on' : '') + '" data-id="' + esc(e.id) + '" aria-selected="' + (e.id === modell) + '">' +
            '<b>' + esc(e.name) + '</b><span>' + esc(e.lang || '') + (e.hinweis ? ' – ' + esc(e.hinweis) : '') + '</span></button>';
        }).join('');
      }
      function zu(){ panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
      malen();
      btn.addEventListener('click', function(ev){
        ev.stopPropagation();
        var auf = panel.hidden;
        panel.hidden = !auf; btn.setAttribute('aria-expanded', String(auf));
      });
      panel.addEventListener('click', function(ev){
        ev.stopPropagation();
        var b = ev.target.closest('.mg-modell-opt'); if (!b) return;
        modell = b.getAttribute('data-id'); merkSchreiben('modell', modell);
        malen(); zu(); quelleText(); laden();
      });
      document.addEventListener('click', zu);
    }

    function zeilenPanel(){
      var btn = document.getElementById(kid('zbtn')), panel = document.getElementById(kid('zpanel'));

      function malen(){
        panel.innerHTML = '<h4>Welche Zeilen? · Zum Umsortieren ziehen</h4>' +
          '<div class="mg-zliste">' + reihenfolge.map(function(id){
            var z = KATALOG[id];
            return '<div class="mg-zeile" data-id="' + id + '">' +
                   '<span class="mg-griff" aria-hidden="true">⠿</span>' +
                   '<label><input type="checkbox" data-id="' + id + '"' + (anZeilen.indexOf(id) >= 0 ? ' checked' : '') + '>' +
                   '<span class="mg-punkt" style="background:' + z.farbe + '"></span>' + esc(z.titel) + '</label></div>';
          }).join('') + '</div>';
      }
      malen();

      btn.addEventListener('click', function(ev){
        ev.stopPropagation();
        var zu = panel.hidden;
        // Die Leiste haftet unten am Bildschirm - ist dort kein Platz, klappt das Menü nach oben auf
        if (zu) {
          panel.hidden = false;                       // erst zeigen, dann messen
          var r = btn.getBoundingClientRect(), unten = (global.innerHeight || 0) - r.bottom;
          panel.classList.toggle('is-oben', unten < panel.offsetHeight + 12 && r.top > unten);
        }
        panel.hidden = !zu;
        btn.setAttribute('aria-expanded', String(zu));
      });
      panel.addEventListener('click', function(ev){ ev.stopPropagation(); });

      panel.addEventListener('change', function(ev){
        var cb = ev.target.closest('input[data-id]'); if (!cb) return;
        var id = cb.getAttribute('data-id');
        if (cb.checked) { if (anZeilen.indexOf(id) < 0) anZeilen.push(id); }
        else anZeilen = anZeilen.filter(function(x){ return x !== id; });
        if (!anZeilen.length) { anZeilen = [id]; cb.checked = true; }   // eine muss bleiben
        merkSchreiben('zeilen', anZeilen.join(','));
        neuZeichnenNachWahl();
      });

      // --- Umsortieren durch Ziehen ---
      var zieht = null;
      panel.addEventListener('pointerdown', function(ev){
        var zeile = ev.target.closest('.mg-zeile');
        if (!zeile || ev.target.closest('input')) return;       // Haken bleibt anklickbar
        var liste = panel.querySelector('.mg-zliste');
        zieht = { el: zeile, liste: liste, startY: ev.clientY, bewegt: false };
        zeile.setPointerCapture(ev.pointerId);
      });
      panel.addEventListener('pointermove', function(ev){
        if (!zieht) return;
        if (!zieht.bewegt) {
          if (Math.abs(ev.clientY - zieht.startY) < 5) return;
          zieht.bewegt = true;
          zieht.el.classList.add('is-zieht');
        }
        ev.preventDefault();
        var ziel = zielZeile(zieht.liste, zieht.el, ev.clientY);
        if (ziel === 'ende') zieht.liste.appendChild(zieht.el);
        else if (ziel) zieht.liste.insertBefore(zieht.el, ziel);
      });
      function beenden(){
        if (!zieht) return;
        var war = zieht.bewegt;
        zieht.el.classList.remove('is-zieht');
        zieht = null;
        if (!war) return;
        setzeReihenfolge([].map.call(panel.querySelectorAll('.mg-zeile'), function(d){ return d.getAttribute('data-id'); }));
        neuZeichnenNachWahl();
      }
      panel.addEventListener('pointerup', beenden);
      panel.addEventListener('pointercancel', beenden);

      document.addEventListener('click', function(){ if (!panel.hidden) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    }

    // Vor welche Zeile gehoert das gezogene Element bei dieser Hoehe?
    function zielZeile(liste, ausser, y){
      var kinder = [].filter.call(liste.children, function(k){ return k !== ausser; });
      for (var i = 0; i < kinder.length; i++) {
        var r = kinder[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return kinder[i];
      }
      return 'ende';
    }

    // Nach jeder Aenderung an Auswahl oder Reihenfolge neu zeichnen - und falls
    // eine Meereszeile dazukam, die fehlenden Daten nachholen.
    function neuZeichnenNachWahl(){
      var fehlt = sichtbareZeilen().some(function(z){
        return (z.meer && (!daten || !daten.welle.some(function(v){ return v != null; }))) ||
               (z.luft && (!daten || !daten.staub || !daten.staub.some(function(v){ return v != null; })));
      });
      if (fehlt) { cache = {}; laden({ still: true, behalten: true }); return; }
      var alt = geo ? idxAusScroll() : null;
      zeichnen(false);
      if (alt !== null) zentrieren(alt, false);
    }

    // --- Umsortieren direkt im Diagramm: lange auf eine Zeile druecken ---
    function sortierenImDiagramm(){
      var lang = null, sortiert = null, schluckeKlick = false, start = null;

      function zeileBeiY(y){
        if (!geo) return -1;
        for (var i = 0; i < geo.zeilen.length; i++) {
          var g = geo.zeilen[i];
          if (y >= g.yt && y <= g.y0 + g.h + (g.extra || 0)) return i;
        }
        return -1;
      }

      el.svgWrap.addEventListener('pointerdown', function(ev){
        var r = el.svgWrap.getBoundingClientRect();
        var i = zeileBeiY(ev.clientY - r.top);
        if (i < 0) return;
        start = { x: ev.clientX, y: ev.clientY };
        lang = setTimeout(function(){
          lang = null;
          sortiert = { von: i, nach: i, y: ev.clientY };
          el.scroll.style.overflowX = 'hidden';           // kein Wischen waehrend des Sortierens
          el.wrap.classList.add('mg-sortiert');
          markiereSortierZeile(i, i);
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch(e){} }
        }, 450);
      });

      el.svgWrap.addEventListener('pointermove', function(ev){
        // Wer wischt oder scrollt, will nicht sortieren: das lange Drücken abbrechen
        if (lang) {
          if (start && (Math.abs(ev.clientX - start.x) > 8 || Math.abs(ev.clientY - start.y) > 8)) {
            clearTimeout(lang); lang = null; start = null;
          }
          return;
        }
        if (!sortiert) return;
        ev.preventDefault();
        var r = el.svgWrap.getBoundingClientRect();
        var i = zeileBeiY(ev.clientY - r.top);
        if (i >= 0 && i !== sortiert.nach) { sortiert.nach = i; markiereSortierZeile(sortiert.von, i); }
      });

      function loslassen(){
        start = null;
        if (lang) { clearTimeout(lang); lang = null; return; }
        if (!sortiert) return;
        var s2 = sortiert; sortiert = null;
        el.scroll.style.overflowX = '';
        el.wrap.classList.remove('mg-sortiert');
        schluckeKlick = true;
        setTimeout(function(){ schluckeKlick = false; }, 60);
        if (s2.von === s2.nach) { zeichnen(false); return; }
        var sicht = sichtbareZeilen().map(function(z){ return z.id; });
        var id = sicht[s2.von];
        var neueSicht = sicht.slice(); neueSicht.splice(s2.von, 1); neueSicht.splice(s2.nach, 0, id);
        // unsichtbare Zeilen behalten ihren Platz relativ zum Rest
        var neu = [], k = 0;
        reihenfolge.forEach(function(x){ neu.push(anZeilen.indexOf(x) >= 0 ? neueSicht[k++] : x); });
        setzeReihenfolge(neu);
        neuZeichnenNachWahl();
      }
      el.svgWrap.addEventListener('pointerup', loslassen);
      el.svgWrap.addEventListener('pointercancel', loslassen);
      el.scroll.addEventListener('click', function(ev){
        if (schluckeKlick || sortiert) { ev.stopPropagation(); ev.preventDefault(); }
      }, true);
    }

    // Hebt die gepackte Zeile hervor und zeigt, wo sie landen wuerde
    function markiereSortierZeile(von, nach){
      var svg = el.svgWrap.querySelector('svg');
      if (!svg || !geo) return;
      var alt = svg.querySelector('#' + kid('sortband'));
      if (alt) alt.parentNode.removeChild(alt);
      var g = geo.zeilen[von], z = geo.zeilen[nach];
      if (!g || !z) return;
      var ns = 'http://www.w3.org/2000/svg';
      var grp = document.createElementNS(ns, 'g');
      grp.setAttribute('id', kid('sortband'));
      var h = (g.y0 + g.h + (g.extra || 0)) - g.yt;
      var r1 = document.createElementNS(ns, 'rect');
      r1.setAttribute('class', 'mg-sortpack');
      r1.setAttribute('x', 0); r1.setAttribute('y', g.yt);
      r1.setAttribute('width', geo.breite); r1.setAttribute('height', h);
      grp.appendChild(r1);
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('class', 'mg-sortziel');
      var yZiel = nach <= von ? z.yt : z.y0 + z.h + (z.extra || 0);
      l.setAttribute('x1', 0); l.setAttribute('x2', geo.breite);
      l.setAttribute('y1', yZiel); l.setAttribute('y2', yZiel);
      grp.appendChild(l);
      svg.appendChild(grp);
    }

    // Werte neu holen. behalten=true laesst die gewaehlte Stelle stehen.
    function auffrischen(behalten){
      cache = {};
      laden({ still: true, behalten: behalten !== false });
    }

    // Die Bilder kommen jede halbe Stunde kurz nach Minute 5 und 35 herein (so
    // steht der Auslöser beim Bildspeicher). Kurz danach frischen wir von selbst
    // auf, damit das neue Bild und die neuen Werte ohne Zutun erscheinen.
    var auffrischUhr = null;
    function naechsteAuffrischung(){
      if (auffrischUhr) clearTimeout(auffrischUhr);
      var jetzt = new Date();
      var ziel = new Date(jetzt.getTime());
      ziel.setSeconds(0, 0);
      ziel.setMinutes(BILD_MINUTE);
      while (ziel <= jetzt) ziel.setTime(ziel.getTime() + 30 * 60000);
      auffrischUhr = setTimeout(function(){
        auffrischen(true);
        naechsteAuffrischung();           // fuer den Fall, dass nachLaden nicht durchkommt
      }, Math.max(20000, ziel - jetzt));
    }

    function quelleText(){
      if (!el.quelle) return;
      var t = 'Open-Meteo · ' + modellObj().lang;
      if (braucheMeer()) t += ' · Meer & Tide: Open-Meteo Marine';
      if (braucheStaub()) t += ' · Saharastaub: Open-Meteo Luftqualität (CAMS)';
      if (daten && daten.uvErsatz) t += ' · UV aus der besten Mischung';
      t += ' · Sonne: Sonnenkraft (direkte Strahlung zu klarem Himmel)';
      el.quelle.textContent = t;
    }

    aufbauen();
    quelleText();
    laden();

    // Kommt die Seite nach laengerer Zeit zurueck in den Vordergrund, koennen
    // Stunden vergangen sein - dann gleich auffrischen.
    var zuletztGesehen = Date.now();
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) { zuletztGesehen = Date.now(); filmStopp(); if (zf.aktiv) zfPause(); return; }
      var pause = Date.now() - zuletztGesehen;
      if (pause > 2 * 3600000) auffrischen(false);          // lange weg gewesen: wieder bei "jetzt" anfangen
      else if (pause > 10 * 60000) auffrischen(true);       // kurz weg: Stelle behalten, Werte auffrischen
      else if (daten) { idxJetzt = idxFuer(jetztDort()); camAktuell = null; anzeigen(); }
      naechsteAuffrischung();
    });
    // Jetzt-Linie und Live-Kamerabild alle fuenf Minuten nachziehen; die Werte
    // selbst frischt naechsteAuffrischung() zur vollen Stunde auf.
    var uhr = setInterval(function(){ if (daten) { idxJetzt = idxFuer(jetztDort()); camAktuell = null; anzeigen(); } }, 5 * 60000);

    return {
      neu: function(){ cache = {}; laden(); },
      vollbild: function(an){ vollbildSetzen(an); },
      zeichnen: function(){ zeichnen(false); },
      zeigeOrt: function(id){ if (ORTE.some(function(o){ return o.id === id; })) { ort = id; merkSchreiben('ort', id); laden(); } },
      auffrischen: function(){ auffrischen(true); },
      abbauen: function(){ clearInterval(uhr); if (auffrischUhr) clearTimeout(auffrischUhr); filmStopp(); if (zf.uhr) clearInterval(zf.uhr); wurzel.innerHTML = ''; wurzel.classList.remove('mg'); }
    };
  }

  global.Meteogramm = { einbauen: einbauen, zeilen: KATALOG, modelle: MODELLE_STANDARD };

})(window);
