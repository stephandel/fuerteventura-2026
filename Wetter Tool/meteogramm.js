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
    sonne:   { titel:'Sonnenschein', kurz:'Sonne', einheit:'min', art:'balken', feld:'sonne', farbe:'#e6c245',
               min:0, max:60, ticks:[0,30,60], vorher:true, icon:'☀️', tagesinfo:true,
               fmt:function(v){ return Math.round(v) + ' min'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: 'min' }; } },
    temp:    { titel:'Temperatur', einheit:'°C', art:'linie', feld:'temp', feld2:'gefuehlt', farbe:'#ef8a5c',
               extrema:'tag', icon:'🌡️',
               fmt:function(v, v2){ return Math.round(v) + '°' + (v2 != null ? ' (gefühlt ' + Math.round(v2) + '°)' : ''); },
               zelle:function(v, v2){ return { wert: Math.round(v), einheit: '°', zusatz: v2 != null ? 'gefühlt ' + Math.round(v2) + '°' : '' }; } },
    wind:    { titel:'Wind', einheit:'km/h', art:'balken', feld:'wind', feld2:'boe', farbe:'#7fb3d9',
               min:0, icon:'💨', pfeile:'windrichtung',
               fmt:function(v, v2){ return Math.round(v) + (v2 != null ? ' (Böen ' + Math.round(v2) + ')' : '') + ' km/h'; },
               zelle:function(v, v2, d, i){
                 var zu = v2 != null ? 'Böen ' + Math.round(v2) : '';
                 if (d && d.windrichtung[i] != null) zu += (zu ? ' · ' : '') + HIMMEL[Math.round(d.windrichtung[i] / 45) % 8];
                 return { wert: Math.round(v), einheit: 'km/h', zusatz: zu };
               } },
    regen:   { titel:'Niederschlag', kurz:'Regen', einheit:'mm; Wahrsch. %', art:'balken', feld:'regen_mm', feld2:null, farbe:'#4f8fd0',
               min:0, vorher:true, icon:'💧', prozentlinie:'regen_pct',
               fmt:function(v){ return dez(v, 1) + ' mm'; },
               zelle:function(v, v2, d, i){
                 return { wert: dez(v, 1), einheit: 'mm',
                          zusatz: (d && d.regen_pct[i] != null) ? Math.round(d.regen_pct[i]) + ' % Wahrsch.' : '' };
               } },
    uv:      { titel:'UV-Index', kurz:'UV', einheit:'', art:'balken', feld:'uv', farbe:'#d98032',
               min:0, ticks:[0,4,8], icon:'🔆', farbskala:'uv',
               fmt:function(v){ return dez(v, 1) + ' (' + uvText(v) + ')'; },
               zelle:function(v){ return { wert: dez(v, 1), einheit: '', zusatz: uvText(v) }; } },
    feuchte: { titel:'Rel. Luftfeuchte', kurz:'Feuchte', einheit:'%', art:'linie', feld:'feuchte', farbe:'#68c8e0',
               min:0, max:100, ticks:[0,50,100], icon:'💦',
               fmt:function(v){ return Math.round(v) + ' %'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: '%' }; } },
    wolken:  { titel:'Bewölkung', einheit:'%', art:'balken', feld:'wolken', farbe:'#9aa7b4',
               min:0, max:100, ticks:[0,50,100], icon:'☁️',
               fmt:function(v){ return Math.round(v) + ' %'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: '%', zusatz: v < 15 ? 'wolkenlos' : v < 50 ? 'heiter' : v < 85 ? 'wolkig' : 'bedeckt' }; } },
    druck:   { titel:'Luftdruck', einheit:'hPa', art:'linie', feld:'druck', farbe:'#c3a6d8',
               icon:'🧭', fmt:function(v){ return Math.round(v) + ' hPa'; },
               zelle:function(v){ return { wert: Math.round(v), einheit: 'hPa' }; } },
    welle:   { titel:'Wellen', einheit:'m', art:'linie', feld:'welle', farbe:'#6fc9b8',
               min:0, meer:true, icon:'🌊', fmt:function(v){ return dez(v, 1) + ' m'; },
               zelle:function(v){ return { wert: dez(v, 1), einheit: 'm' }; } },
    tide:    { titel:'Tide', einheit:'m', art:'linie', feld:'tide', farbe:'#4bc4cb',
               glatt:true, extrema:'tide', meer:true, icon:'🌊',
               fmt:function(v){ return (v > 0 ? '+' : '') + dez(v, 1) + ' m'; },
               zelle:function(v, v2, d, i, steigt){ return { wert: (v > 0 ? '+' : '') + dez(v, 1), einheit: 'm', zusatz: steigt == null ? '' : (steigt ? 'steigt' : 'fällt') }; } }
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

  // ---------- Der Baustein ----------

  function einbauen(cfg) {
    cfg = cfg || {};
    var wurzel = typeof cfg.ziel === 'string' ? document.querySelector(cfg.ziel) : cfg.ziel;
    if (!wurzel) { console.warn('Meteogramm: Ziel nicht gefunden'); return null; }

    var ORTE = cfg.orte && cfg.orte.length ? cfg.orte : [{ id:'ort', name:'Ort', lat:52.52, lon:13.405 }];
    var MODELLE = cfg.modelle && cfg.modelle.length ? cfg.modelle : MODELLE_STANDARD;
    var KAMERAS = cfg.kameras || {};
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

    // Welche Zeilen stehen zur Verfügung, in welcher Reihenfolge
    var ANGEBOT = (cfg.zeilen && cfg.zeilen.length ? cfg.zeilen : ZEILEN_STANDARD)
      .filter(function(id){ return KATALOG[id]; });
    var STANDARD_AN = cfg.zeilenStandard && cfg.zeilenStandard.length
      ? cfg.zeilenStandard.filter(function(id){ return ANGEBOT.indexOf(id) >= 0; })
      : ANGEBOT.slice();

    // Maße
    var BAND_TAG = 22, BAND_CAM = 16, TITEL_H = 22, BAND_UNTEN = 24, TAGESINFO_H = 34;
    var ZEILE_H_SCHMAL = 72, ZEILE_H_BREIT = 92, PXH_BREIT = 24;

    var el = {}, daten = null, cache = {}, geo = null;
    var pxH = 26, idxJetzt = 0, sammler = 0, camAktuell = null;
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

    function braucheMeer(){ return sichtbareZeilen().some(function(z){ return z.meer; }); }

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
        'wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day';
      var urlW = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
        '&hourly=' + stunden + '&daily=sunrise,sunset&past_days=' + TAGE_VORHER +
        '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz + '&models=' + m.id;
      var meerLat = (o.meer && o.meer.lat) || o.lat, meerLon = (o.meer && o.meer.lon) || o.lon;
      var urlM = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + meerLat + '&longitude=' + meerLon +
        '&hourly=sea_level_height_msl,wave_height,sea_surface_temperature&past_days=' + TAGE_VORHER +
        '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz;

      var hole = [ fetch(urlW).then(function(r){ return r.json(); }) ];
      hole.push(braucheMeer() ? fetch(urlM).then(function(r){ return r.json(); }).catch(function(){ return null; })
                              : Promise.resolve(null));

      Promise.all(hole).then(function(res){
        var w = res[0];
        if (!w || !w.hourly || !w.hourly.time) throw new Error('leer');
        // Nicht jedes Modell rechnet den UV-Index. Fehlt er, holen wir ihn
        // einzeln aus der besten Mischung - sonst bliebe die Zeile leer.
        var uvLeer = !w.hourly.uv_index || w.hourly.uv_index.every(function(v){ return v == null; });
        if (!uvLeer) return [w, res[1], null];
        var urlU = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
          '&hourly=uv_index&past_days=' + TAGE_VORHER + '&forecast_days=' + TAGE_VORAUS + '&timezone=' + tz;
        return fetch(urlU).then(function(r){ return r.json(); })
          .then(function(u){ return [w, res[1], u]; })
          .catch(function(){ return [w, res[1], null]; });
      }).then(function(alles){
        daten = aufbereiten(alles[0], alles[1], alles[2]);
        cache[key] = { at: Date.now(), daten: daten };
        nachLaden(opts);
      }).catch(function(e){
        if (global.console && console.warn) console.warn('Meteogramm:', e);
        ladeAnzeige(false);
        if (!opts.still) melde('Wetterdaten gerade nicht erreichbar – bitte später noch einmal versuchen.');
      });
    }

    function aufbereiten(w, mm, uvExtra){
      var H = w.hourly, n = H.time.length;
      var d = { zeit: H.time, t0: new Date(H.time[0]), uvErsatz: false,
                sonne:[], temp:[], gefuehlt:[], wind:[], boe:[], windrichtung:[],
                regen_mm:[], regen_pct:[], uv:[], feuchte:[], wolken:[], druck:[],
                code:[], tag:[], welle:[], tide:[], wasser:[], sonnenauf:[], sonnenunter:[] };
      var uvQuelle = H.uv_index;
      if (uvExtra && uvExtra.hourly && uvExtra.hourly.uv_index) {
        var kU = {}; uvExtra.hourly.time.forEach(function(t, i){ kU[t] = uvExtra.hourly.uv_index[i]; });
        uvQuelle = H.time.map(function(t){ return kU[t] != null ? kU[t] : null; });
        d.uvErsatz = true;
      }
      function nimm(feld, i){ return H[feld] ? H[feld][i] : null; }
      for (var i = 0; i < n; i++) {
        d.sonne.push(nimm('sunshine_duration', i) == null ? null : H.sunshine_duration[i] / 60);
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
      if (w.daily) { d.sonnenauf = w.daily.sunrise || []; d.sonnenunter = w.daily.sunset || []; }
      d.tage = tageBauen(d);
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
      (d.sonnenunter || []).forEach(function(iso){ if (karte[iso.slice(0,10)]) karte[iso.slice(0,10)].unter = iso.slice(11,16); });
      return tage;
    }

    function idxFuer(dt){ return (dt.getTime() - daten.t0.getTime()) / 3600000; }
    function idxFuerIso(iso){ return idxFuer(new Date(iso)); }

    function nachLaden(opts){
      opts = opts || {};
      quelleText();                       // erst jetzt ist klar, woher der UV-Wert kommt
      var alt = (opts.behalten && geo) ? idxAusScroll() : null;
      idxJetzt = idxFuer(jetztDort());
      camAktuell = null;                  // Kamerabild neu holen, nicht aus dem Zwischenspeicher
      zeichnen(alt === null);
      if (alt !== null) zentrieren(alt, false);
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
      if (hi === lo) hi = lo + 1;
      var ticks = z.ticks;
      if (!ticks) {
        if (z.id === 'temp') { ticks = []; for (var t = lo + 1; t <= hi - 1; t += (hi - lo > 12 ? 4 : 2)) ticks.push(t); }
        else if (z.id === 'tide') ticks = [lo, 0, hi];
        else ticks = [lo, (lo + hi) / 2, hi];
      }
      return { lo: lo, hi: hi, ticks: ticks };
    }

    function zeichnen(zentrierJetzt){
      if (!daten || !el.scroll) return;
      var W = el.scroll.clientWidth;
      if (W < 40) return;                        // gerade nicht sichtbar
      var schmal = W < 560;
      pxH = schmal ? Math.max(18, Math.min(40, Math.floor(W / 26))) : PXH_BREIT;
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
      for (var i2 = 0; i2 < n; i2++) {
        var iso = daten.zeit[i2], hh = parseInt(iso.slice(11, 13), 10);
        if (hh % 6 !== 0) continue;
        var istTag = hh === 0;
        s.push('<line class="' + (istTag ? 'mg-tag' : 'mg-grid') + '" x1="' + x(i2) + '" y1="' + BAND_TAG + '" x2="' + x(i2) + '" y2="' + plotUnten + '"/>');
        s.push('<text class="mg-std" x="' + x(i2) + '" y="' + (hoehe - 7) + '" text-anchor="middle">' + iso.slice(11, 16) + '</text>');
        if (istTag) {
          var dt = new Date(iso);
          var lab = (dt.toDateString() === heuteStr) ? 'Heute' : WOCHENTAG[dt.getDay()] + ' ' + pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '.';
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
          var txt = (g.z.id === 'welle' || g.z.id === 'tide' || g.z.id === 'regen') ? dez(t, 1) : Math.round(t);
          a.push('<div class="mg-ax-tick" style="top:' + ty + 'px">' + txt + '</div>');
        });
      });
      a.push('<div class="mg-ax-datum" id="' + kid('ax-datum') + '" style="top:0;height:' + BAND_TAG + 'px"></div>');
      el.achse.innerHTML = a.join('');
      el.achse.style.height = hoehe + 'px';

      webcamMarken();
      if (zentrierJetzt) zentrieren(idxJetzt, false); else anzeigen();
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
          var farbe = z.farbskala === 'uv' ? uvFarbe(F[i]) : z.farbe;
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
        var R = daten[z.pfeile], schritt = pxH < 22 ? 3 : 2;
        for (var q = 0; q < n; q += schritt) {
          if (R[q] == null) continue;
          var py = g.y0 + g.h - 7, px = x(q);
          s.push('<g class="mg-pfeil" transform="translate(' + px.toFixed(1) + ' ' + py + ') rotate(' + ((R[q] + 180) % 360) + ')">' +
                 '<path d="M0 -5 L3 4 L0 2 L-3 4 Z" fill="' + z.farbe + '" opacity="0.85"/></g>');
        }
      }

      // Sonnenauf- und -untergang in das Titelband der Sonnenzeile
      if (z.id === 'sonne') {
        (daten.sonnenauf || []).forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↑ ' + iso.slice(11, 16) + '</text>'); });
        (daten.sonnenunter || []).forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↓ ' + iso.slice(11, 16) + '</text>'); });
      }

      if (z.extrema === 'tag') {
        tagesExtrema(F).forEach(function(e){
          s.push('<circle cx="' + x(e.i) + '" cy="' + g.yv(e.v) + '" r="3" fill="' + z.farbe + '"/>');
          s.push('<text class="mg-mark" x="' + x(e.i) + '" y="' + (e.hoch ? g.yv(e.v) - 7 : g.yv(e.v) + 14) + '" text-anchor="middle">' + (e.hoch ? '↑ ' : '↓ ') + Math.round(e.v) + '°</text>');
        });
      }
      if (z.extrema === 'tide') {
        tideExtrema(F).forEach(function(e){
          s.push('<circle cx="' + x(e.i) + '" cy="' + g.yv(e.v) + '" r="3.5" fill="' + z.farbe + '"/>');
          var dt = new Date(daten.t0.getTime() + e.i * 3600000);
          s.push('<text class="mg-mark" x="' + x(e.i) + '" y="' + (e.hoch ? g.yv(e.v) - 8 : g.yv(e.v) + 15) + '" text-anchor="middle">' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + '</text>');
        });
      }

      // Tages-Fußzeile unter der Sonnenzeile
      if (z.tagesinfo && g.extra) {
        var basis = g.y0 + g.h;
        daten.tage.forEach(function(t){
          var mitte = x((t.von + t.bis) / 2);
          if (t.bis - t.von < 6) return;                 // angeschnittene Tage weglassen
          var stunden = t.sonneMin / 60;
          s.push('<text class="mg-tagesinfo-stark" x="' + mitte + '" y="' + (basis + 15) + '" text-anchor="middle">☀ ' + dez(stunden, 1) + ' h</text>');
          var unten = (t.auf && t.unter ? t.auf + ' – ' + t.unter : '') + (t.uvMax != null ? '  ·  UV ' + Math.round(t.uvMax) : '');
          if (unten) s.push('<text class="mg-tagesinfo" x="' + mitte + '" y="' + (basis + 28) + '" text-anchor="middle">' + unten + '</text>');
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
        out.push({ i: i + shift, v: b - 0.25 * (a - c) * shift, hoch: hoch });
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

        var links = Math.max(0, Math.min(geo.n - 1, f - el.scroll.clientWidth / 2 / pxH + 0.5));
        var dtL = new Date(daten.t0.getTime() + Math.floor(links) * 3600000);
        // Datum im Diagramm verstecken, solange es unter der festen Achse läge -
        // sonst stünde es doppelt neben dem Datum am linken Rand.
        var links2 = el.scroll.scrollLeft;
        [].forEach.call(el.svgWrap.querySelectorAll('.mg-datum'), function(t){
          t.style.visibility = (parseFloat(t.getAttribute('data-x')) - links2 < 104) ? 'hidden' : '';
        });

        var axd = document.getElementById(kid('ax-datum'));
        if (axd) axd.textContent = (dtL.toDateString() === jetztDort().toDateString())
          ? 'Heute' : WOCHENTAG[dtL.getDay()] + ' ' + pad2(dtL.getDate()) + '.' + pad2(dtL.getMonth() + 1) + '.';

        var iR = Math.max(0, Math.min(geo.n - 1, Math.round(f)));
        var code = daten.code[iR];
        el.lage.innerHTML = code != null
          ? '<span class="mg-lage-i">' + wmoIcon(code, daten.tag[iR]) + '</span>' + esc(WMO_TEXT[code] || '')
          : '';

        var zellen = sichtbareZeilen().map(function(z){
          var w = wertBei(z, f);
          if (w.v == null) return '';
          var steigt = null;
          if (z.id === 'tide') { var w2 = wertBei(z, Math.min(geo.n - 1, f + 1)); steigt = w2.v != null ? w2.v > w.v : null; }
          var c = z.zelle ? z.zelle(w.v, w.v2, daten, iR, steigt) : { wert: z.fmt(w.v, w.v2), einheit: '' };
          return zelleHtml(z.kurz || z.titel, c, z.farbe);
        });
        if (daten.wasser[iR] != null) {
          zellen.push(zelleHtml('Wasser', { wert: Math.round(daten.wasser[iR]), einheit: '°' }, '#3fa9c9'));
        }
        el.werte.innerHTML = zellen.join('');
        bildZeigen(f);
      }, 16);
    }

    function zelleHtml(titel, c, farbe){
      return '<div class="mg-wert" style="--c:' + farbe + '">' +
        '<span class="mg-wl">' + esc(titel) + '</span>' +
        '<span class="mg-wv">' + c.wert + (c.einheit ? '<small>' + esc(c.einheit) + '</small>' : '') + '</span>' +
        '<span class="mg-wz">' + esc(c.zusatz || '') + '</span></div>';
    }

    function relText(h){
      if (h < 1) return Math.round(h * 60) + ' Min.';
      if (h < 36) return Math.round(h) + ' Std.';
      var t = Math.round(h / 24); return t + (t === 1 ? ' Tag' : ' Tagen');
    }
    function wmoIcon(c, tag){ if (!tag && (c === 0 || c === 1)) return '🌙'; return WMO_ICON[c] || '🌤️'; }
    function melde(t){ if (el.zeit) { el.zeit.innerHTML = '<span class="mg-rel">' + esc(t) + '</span>'; el.werte.innerHTML = ''; } }

    // ---------- Webcam ----------

    function webcamLaden(){
      var o = ortObj();
      webcam = { shots: [], ort: o.id, speicher: false };
      if (!SPEICHER) { webcamMarken(); anzeigen(); return; }
      fetch(SPEICHER + '/webcam?ort=' + encodeURIComponent(o.id))
        .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(j){
          if (!j || !Array.isArray(j.shots) || webcam.ort !== o.id) return;
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
        s.push('<rect class="mg-cam-mark" x="' + (geo.x(sh.i) - 3) + '" y="' + (BAND_TAG + 3) + '" width="6" height="' + (BAND_CAM - 7) + '" rx="1.5"/>');
      });
      if (KAMERAS[ort] && idxJetzt >= 0 && idxJetzt < geo.n) {
        s.push('<rect class="mg-cam-mark is-live" x="' + (geo.x(idxJetzt) - 3) + '" y="' + (BAND_TAG + 3) + '" width="6" height="' + (BAND_CAM - 7) + '" rx="1.5"/>');
      }
      g.innerHTML = s.join('');
    }

    function webcamZeigen(f){
      if (!el.cam) return;
      var cam = KAMERAS[ort];
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
          : (webcam.speicher ? 'Für diese Stunde liegt kein Bild vor.'
             : 'Vergangene Stunden erscheinen hier, sobald der Bildspeicher eingerichtet ist. Das Bild der laufenden Stunde siehst du über „Jetzt zentrieren“.');
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

    // Bilder des Films vorab holen, damit er nicht ruckelt
    function filmVorladen(){
      if (!KARTE) return;
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
      ansicht = id;
      merkSchreiben('ansicht', id);
      kartenAktuell = null; camAktuell = null;
      ansichtReiterMalen();
      anzeigen();
      if (id !== 'webcam') filmVorladen();
    }

    function ansichtReiterMalen(){
      if (!el.ansichten) return;
      el.ansichten.innerHTML = ANSICHTEN.map(function(a2){
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
          '<div class="mg-tabs mg-tabs-modell" id="' + kid('modelle') + '" role="tablist" aria-label="Wettermodell"></div>' +
        '</div>' +
        '<div class="mg-head">' +
          '<div class="mg-readout">' +
            '<div class="mg-zeit" id="' + kid('zeit') + '"></div>' +
            '<div class="mg-lage" id="' + kid('lage') + '"></div>' +
          '</div>' +
          '<div class="mg-knoepfe">' +
            '<button type="button" class="mg-btn" id="' + kid('zurueck') + '" aria-label="Einen Tag zurück">‹</button>' +
            '<button type="button" class="mg-btn mg-btn-jetzt" id="' + kid('jetzt') + '">Jetzt zentrieren</button>' +
            '<button type="button" class="mg-btn" id="' + kid('vor') + '" aria-label="Einen Tag vor">›</button>' +
            '<button type="button" class="mg-btn mg-btn-frisch" id="' + kid('frisch') + '" aria-label="Werte auffrischen" title="Werte neu holen">↻</button>' +
            '<span class="mg-zeilenwahl">' +
              '<button type="button" class="mg-btn" id="' + kid('zbtn') + '" aria-expanded="false" title="Welche Zeilen anzeigen?">☰</button>' +
              '<div class="mg-zeilen-panel" id="' + kid('zpanel') + '" hidden><h4>Welche Zeilen?</h4></div>' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="mg-werte" id="' + kid('werte') + '"></div>' +
        (ANSICHTEN.length > 1 ? '<div class="mg-ansichten" id="' + kid('ansichten') + '" role="tablist" aria-label="Bildansicht"></div>' : '') +
        (KARTE ? '<div class="mg-karte" id="' + kid('karte') + '" hidden>' +
          '<img class="mg-k-basis" id="' + kid('kbasis') + '" alt="Satellitenbild" decoding="async">' +
          '<img class="mg-k-auflage" id="' + kid('kauflage') + '" alt="" decoding="async" hidden>' +
          '<button type="button" class="mg-play" id="' + kid('play') + '" aria-label="Film abspielen">▶</button>' +
          '<div class="mg-cam-text" id="' + kid('ktext') + '"></div>' +
        '</div>' : '') +
        '<div class="mg-cam" id="' + kid('cam') + '" hidden><img id="' + kid('camimg') + '" alt="Webcam-Bild" decoding="async" referrerpolicy="no-referrer"><div class="mg-cam-text" id="' + kid('camtext') + '"></div></div>' +
        '<div class="mg-wrap" id="' + kid('wrap') + '">' +
          '<div class="mg-scroll" id="' + kid('scroll') + '"><div class="mg-svgwrap" id="' + kid('svgwrap') + '"></div></div>' +
          '<div class="mg-achse" id="' + kid('achse') + '"></div>' +
          '<div class="mg-cursor" aria-hidden="true"></div>' +
        '</div>' +
        '<div class="mg-foot"><span>← Wischen → · Auswahl in der Mitte · Antippen holt die Stelle in die Mitte</span><span id="' + kid('quelle') + '"></span></div>';

      el.scroll  = document.getElementById(kid('scroll'));
      el.svgWrap = document.getElementById(kid('svgwrap'));
      el.achse   = document.getElementById(kid('achse'));
      el.wrap    = document.getElementById(kid('wrap'));
      el.zeit    = document.getElementById(kid('zeit'));
      el.werte   = document.getElementById(kid('werte'));
      el.cam     = document.getElementById(kid('cam'));
      el.quelle  = document.getElementById(kid('quelle'));
      el.lage    = document.getElementById(kid('lage'));
      el.ansichten = document.getElementById(kid('ansichten'));
      if (KARTE) {
        el.karte    = document.getElementById(kid('karte'));
        el.kBasis   = document.getElementById(kid('kbasis'));
        el.kAuflage = document.getElementById(kid('kauflage'));
        el.kText    = document.getElementById(kid('ktext'));
        el.play     = document.getElementById(kid('play'));
        el.karte.style.aspectRatio = kartenSeitenverhaeltnis().toFixed(3);
        el.play.addEventListener('click', function(ev){ ev.stopPropagation(); filmSchalten(); });
        el.kBasis.addEventListener('error', function(){
          el.kText.textContent = 'Für diesen Zeitpunkt gibt es noch kein Satellitenbild.';
        });
      }
      if (el.ansichten) {
        ansichtReiterMalen();
        el.ansichten.addEventListener('click', function(ev){
          var b2 = ev.target.closest('.mg-atab'); if (!b2) return;
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
      el.camImg.addEventListener('error', function(){
        el.cam.classList.add('is-leer');
        el.camText.textContent = 'Das Kamerabild ist gerade nicht erreichbar.';
      });

      if (ORTE.length < 2) document.getElementById(kid('orte')).style.display = 'none';
      if (MODELLE.length < 2) document.getElementById(kid('modelle')).style.display = 'none';
      reiter(kid('orte'), ORTE, function(){ return ort; }, function(id){ ort = id; merkSchreiben('ort', id); laden(); });
      reiter(kid('modelle'), MODELLE, function(){ return modell; }, function(id){ modell = id; merkSchreiben('modell', id); quelleText(); laden(); });
      zeilenPanel();
      sortierenImDiagramm();

      el.scroll.addEventListener('scroll', anzeigen, { passive: true });
      el.scroll.addEventListener('click', function(ev){
        if (!geo) return;
        var r = el.scroll.getBoundingClientRect();
        zentrieren((ev.clientX - r.left + el.scroll.scrollLeft - geo.padL) / pxH, true);
      });
      document.getElementById(kid('jetzt')).addEventListener('click', function(){
        zentrieren(idxJetzt, true);
        auffrischen(false);               // beim Sprung auf "jetzt" gleich neue Werte holen
      });
      document.getElementById(kid('frisch')).addEventListener('click', function(){ auffrischen(true); });
      document.getElementById(kid('zurueck')).addEventListener('click', function(){ zentrieren(idxAusScroll() - 24, true); });
      document.getElementById(kid('vor')).addEventListener('click', function(){ zentrieren(idxAusScroll() + 24, true); });

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
        return z.meer && (!daten || !daten.welle.some(function(v){ return v != null; }));
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

    // Die Bilder kommen jede volle Stunde kurz nach Minute 5 herein (so steht
    // der Auslöser beim Bildspeicher). Kurz danach frischen wir von selbst auf,
    // damit das neue Bild und die neuen Werte ohne Zutun erscheinen.
    var auffrischUhr = null;
    function naechsteAuffrischung(){
      if (auffrischUhr) clearTimeout(auffrischUhr);
      var jetzt = new Date();
      var ziel = new Date(jetzt.getTime());
      ziel.setSeconds(0, 0);
      ziel.setMinutes(BILD_MINUTE);
      if (ziel <= jetzt) ziel.setTime(ziel.getTime() + 3600000);
      auffrischUhr = setTimeout(function(){
        auffrischen(true);
        naechsteAuffrischung();           // fuer den Fall, dass nachLaden nicht durchkommt
      }, Math.max(20000, ziel - jetzt));
    }

    function quelleText(){
      if (!el.quelle) return;
      var t = 'Open-Meteo · ' + modellObj().lang;
      if (braucheMeer()) t += ' · Meer & Tide: Open-Meteo Marine';
      if (daten && daten.uvErsatz) t += ' · UV aus der besten Mischung';
      el.quelle.textContent = t;
    }

    aufbauen();
    quelleText();
    laden();

    // Kommt die Seite nach laengerer Zeit zurueck in den Vordergrund, koennen
    // Stunden vergangen sein - dann gleich auffrischen.
    var zuletztGesehen = Date.now();
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) { zuletztGesehen = Date.now(); filmStopp(); return; }
      if (Date.now() - zuletztGesehen > 10 * 60000) auffrischen(true);
      else if (daten) { idxJetzt = idxFuer(jetztDort()); camAktuell = null; anzeigen(); }
      naechsteAuffrischung();
    });
    // Jetzt-Linie und Live-Kamerabild alle fuenf Minuten nachziehen; die Werte
    // selbst frischt naechsteAuffrischung() zur vollen Stunde auf.
    var uhr = setInterval(function(){ if (daten) { idxJetzt = idxFuer(jetztDort()); camAktuell = null; anzeigen(); } }, 5 * 60000);

    return {
      neu: function(){ cache = {}; laden(); },
      zeichnen: function(){ zeichnen(false); },
      zeigeOrt: function(id){ if (ORTE.some(function(o){ return o.id === id; })) { ort = id; merkSchreiben('ort', id); laden(); } },
      auffrischen: function(){ auffrischen(true); },
      abbauen: function(){ clearInterval(uhr); if (auffrischUhr) clearTimeout(auffrischUhr); filmStopp(); wurzel.innerHTML = ''; wurzel.classList.remove('mg'); }
    };
  }

  global.Meteogramm = { einbauen: einbauen, zeilen: KATALOG, modelle: MODELLE_STANDARD };

})(window);
