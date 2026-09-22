// Meteogramm für die Wetterseite: mehrere Diagramme übereinander mit einer
// gemeinsamen Zeitachse (Sonnenschein, Temperatur, Wind, Regen, Wellen, Tide).
// Die Auswahl-Linie steht fest in der Mitte - man wischt die Zeit darunter
// hindurch; oben stehen Datum, Uhrzeit und alle Werte an dieser Stelle.
// Daten: Open-Meteo (Wetter + Meer), kein Schlüssel nötig. Zeichnet selbst
// als SVG, ohne fremde Bibliothek.
(function(){
  'use strict';

  var ORTE = [
    { id:'corralejo', name:'Corralejo',  lat:28.7297, lon:-13.8672, meer:{ lat:28.7297, lon:-13.8672 } },
    { id:'cotillo',   name:'El Cotillo', lat:28.6855, lon:-14.0110, meer:{ lat:28.69,   lon:-14.03   } },
    { id:'sotavento', name:'Sotavento',  lat:28.1560, lon:-14.2275, meer:{ lat:28.145,  lon:-14.21   } }
  ];

  // Webcams je Ort. Das aktuelle Bild holt die Seite direkt beim Betreiber -
  // dafür braucht es nichts weiter. Die vergangenen Stunden kommen aus dem
  // eigenen Bildspeicher (Worker), sobald der eingerichtet ist.
  // Geprüft am 23.09.2026: beide Kameras liefern echte Live-Bilder.
  var KAMERAS = {
    corralejo: {
      name: 'Grandes Playas, Corralejo',
      live: 'https://cdn.skylinewebcams.com/live6086.jpg',
      quelle: 'SkylineWebcams',
      seite: 'https://www.skylinewebcams.com/en/webcam/espana/canarias/corralejo/grandes-playas-corralejo.html'
    },
    sotavento: {
      name: 'Sotavento, Playa Barca',
      live: 'https://i.ytimg.com/vi/8CxYZ4tPTmo/maxresdefault_live.jpg',
      quelle: 'René Egli · YouTube',
      seite: 'https://www.youtube.com/watch?v=8CxYZ4tPTmo'
    },
    // Für El Cotillo gibt es keine Kamera, die ihr Bild frei herausgibt -
    // die dortigen Kameras stecken hinter Bezahlschranken. Ersatzweise die
    // nächstgelegene Kamera, deutlich als solche beschriftet.
    cotillo: {
      name: 'Grandes Playas, Corralejo',
      hinweis: 'nächstgelegene freie Kamera – für El Cotillo selbst gibt es keine',
      live: 'https://cdn.skylinewebcams.com/live6086.jpg',
      quelle: 'SkylineWebcams',
      seite: 'https://www.skylinewebcams.com/en/webcam/espana/canarias/corralejo/grandes-playas-corralejo.html'
    }
  };
  var MODELLE = [
    { id:'best_match',    name:'Mix',   lang:'Beste Mischung', hinweis:'Open-Meteo nimmt je Region das passendste Modell' },
    { id:'ecmwf_ifs025',  name:'ECMWF', lang:'ECMWF (Europa)', hinweis:'Europäisches Wetterzentrum – meist das treffsicherste Modell für die Kanaren' },
    { id:'icon_seamless', name:'ICON',  lang:'ICON (DWD)',     hinweis:'Deutscher Wetterdienst, reicht nur 7 Tage voraus' },
    { id:'gfs_seamless',  name:'GFS',   lang:'GFS (USA)',      hinweis:'US-Wetterdienst NOAA, grobes Raster' }
  ];

  // Die Zeilen des Diagramms, von oben nach unten.
  var ZEILEN = [
    { id:'sonne', titel:'Sonnenschein', einheit:'min / Std.', art:'balken', farbe:'#e6c245', feld:'sonne', min:0, max:60, ticks:[0,30,60], vorher:true, icon:'☀️', fmt:function(v){ return Math.round(v) + ' min'; } },
    { id:'temp',  titel:'Temperatur',   einheit:'°C',         art:'linie',  farbe:'#ef8a5c', feld:'temp', extrema:'tag', icon:'🌡️', fmt:function(v){ return Math.round(v) + '°'; } },
    { id:'wind',  titel:'Wind',         einheit:'km/h',       art:'balken', farbe:'#7fb3d9', feld:'wind', feld2:'boe', min:0, icon:'💨', fmt:function(v, v2){ return Math.round(v) + (v2 != null ? ' (Böen ' + Math.round(v2) + ')' : '') + ' km/h'; } },
    { id:'regen', titel:'Regen',        einheit:'%',          art:'balken', farbe:'#4f8fd0', feld:'regen', min:0, max:100, ticks:[0,50,100], vorher:true, icon:'💧', fmt:function(v){ return Math.round(v) + ' %'; } },
    { id:'welle', titel:'Wellen',       einheit:'m',          art:'linie',  farbe:'#6fc9b8', feld:'welle', min:0, icon:'🌊', fmt:function(v){ return dez(v, 1) + ' m'; } },
    { id:'tide',  titel:'Tide',         einheit:'m',          art:'linie',  farbe:'var(--teal)', feld:'tide', glatt:true, extrema:'tide', icon:'🌊', fmt:function(v){ return (v > 0 ? '+' : '') + dez(v, 1) + ' m'; } }
  ];

  var BAND_OBEN = 26, BAND_CAM = 18, TITEL_H = 22, BAND_UNTEN = 24;
  var ZEILE_H_SCHMAL = 72;    // Zeilenhöhe auf dem Handy
  var ZEILE_H_BREIT  = 92;    // ... und auf dem Laptop, wo mehr Platz ist
  var PXH_BREIT = 24;         // Pixel je Stunde auf dem Laptop (fest, sonst wird es flach)
  var TAGE_VORHER = 1, TAGE_VORAUS = 8;
  var WOCHENTAG = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  // Adresse des Bildspeichers - erst beim Abruf lesen, damit sie sich zum Testen
  // auch nachtraeglich setzen laesst.
  function webcamBasis(){ return window.FUERTE_WEBCAM_URL || 'https://fuerte-sync.stephanhandel.workers.dev'; }

  var el = {};                // Elemente der Oberfläche
  var daten = null;           // aufbereitete Stundenwerte
  var cache = {};             // je Ort+Modell, 15 Minuten gültig
  var pxH = 26;               // Pixel je Stunde
  var geo = null;             // Zeilen-Geometrie der letzten Zeichnung
  var idxJetzt = 0;           // Stundenindex von "jetzt"
  var webcam = { shots: [], demo: false, ort: null };
  var ort = lsGet('fuerte-mg-ort', 'corralejo');
  var modell = lsGet('fuerte-mg-modell', 'best_match');
  var rafReadout = 0;           // laufender Sammel-Timer für die Anzeige

  function lsGet(k, fb){ try { var v = localStorage.getItem(k); return v === null ? fb : v; } catch(e){ return fb; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function dez(v, n){ return v == null ? '–' : v.toFixed(n).replace('.', ','); }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function ortObj(){ return ORTE.filter(function(o){ return o.id === ort; })[0] || ORTE[0]; }
  function modellObj(){ return MODELLE.filter(function(m){ return m.id === modell; })[0] || MODELLE[0]; }

  // "Jetzt" als Uhrzeit auf Fuerteventura - egal, wo das Gerät steht.
  function jetztKanarisch(){
    try { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Atlantic/Canary' })); }
    catch(e){ return new Date(); }
  }

  // ---------- Daten holen ----------
  function laden(){
    var o = ortObj(), m = modellObj();
    var key = o.id + '|' + m.id;
    var c = cache[key];
    if (c && Date.now() - c.at < 15 * 60000) { daten = c.daten; nachLaden(); return; }
    status('Lade ' + o.name + ' · ' + m.lang + ' …');
    var urlW = 'https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
      '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,sunshine_duration,weather_code,is_day' +
      '&daily=sunrise,sunset&past_days=' + TAGE_VORHER + '&forecast_days=' + TAGE_VORAUS +
      '&timezone=Atlantic%2FCanary&models=' + m.id;
    var urlM = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + o.meer.lat + '&longitude=' + o.meer.lon +
      '&hourly=sea_level_height_msl,wave_height,sea_surface_temperature&past_days=' + TAGE_VORHER +
      '&forecast_days=' + TAGE_VORAUS + '&timezone=Atlantic%2FCanary';
    Promise.all([
      fetch(urlW).then(function(r){ return r.json(); }),
      fetch(urlM).then(function(r){ return r.json(); }).catch(function(){ return null; })
    ]).then(function(res){
      var w = res[0], mm = res[1];
      if (!w || !w.hourly || !w.hourly.time) throw new Error('leer');
      daten = aufbereiten(w, mm);
      cache[key] = { at: Date.now(), daten: daten };
      nachLaden();
    }).catch(function(){
      status('Wetterdaten gerade nicht erreichbar – bitte später noch einmal versuchen.');
    });
  }

  function aufbereiten(w, mm){
    var H = w.hourly, n = H.time.length;
    var d = { zeit: H.time, sonne: [], temp: [], wind: [], boe: [], regen: [], code: [], tag: [], welle: [], tide: [], wasser: [], sonnenauf: [], sonnenunter: [] };
    for (var i = 0; i < n; i++) {
      d.sonne.push(H.sunshine_duration[i] == null ? null : H.sunshine_duration[i] / 60);
      d.temp.push(H.temperature_2m[i]);
      d.wind.push(H.wind_speed_10m[i]);
      d.boe.push(H.wind_gusts_10m ? H.wind_gusts_10m[i] : null);
      d.regen.push(H.precipitation_probability ? H.precipitation_probability[i] : null);
      d.code.push(H.weather_code ? H.weather_code[i] : null);
      d.tag.push(H.is_day ? H.is_day[i] : 1);
    }
    // Meereswerte auf dieselben Stunden legen (gleiche Zeitzone, gleicher Start)
    var M = mm && mm.hourly ? mm.hourly : null;
    var mIdx = {};
    if (M) for (var k = 0; k < M.time.length; k++) mIdx[M.time[k]] = k;
    for (var j = 0; j < n; j++) {
      var mi = M ? mIdx[H.time[j]] : undefined;
      d.welle.push(mi == null ? null : M.wave_height[mi]);
      d.tide.push(mi == null ? null : M.sea_level_height_msl[mi]);
      d.wasser.push(mi == null ? null : M.sea_surface_temperature[mi]);
    }
    if (w.daily) { d.sonnenauf = w.daily.sunrise || []; d.sonnenunter = w.daily.sunset || []; }
    d.t0 = new Date(H.time[0]);
    return d;
  }

  // Stundenindex (mit Nachkommastellen) für einen Zeitpunkt in Ortszeit
  function idxFuer(dt){ return (dt.getTime() - daten.t0.getTime()) / 3600000; }
  function idxFuerIso(iso){ return idxFuer(new Date(iso)); }

  function nachLaden(){
    idxJetzt = idxFuer(jetztKanarisch());
    zeichnen(true);
    webcamLaden();
  }

  // ---------- Zeichnen ----------
  function skala(z){
    var vals = daten[z.feld].filter(function(v){ return v != null; });
    if (z.feld2) vals = vals.concat(daten[z.feld2].filter(function(v){ return v != null; }));
    var lo = z.min != null ? z.min : Math.min.apply(null, vals);
    var hi = z.max != null ? z.max : Math.max.apply(null, vals);
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (z.id === 'temp') { lo = Math.floor(lo / 2) * 2 - 1; hi = Math.ceil(hi / 2) * 2 + 1; }
    if (z.id === 'wind') { hi = Math.max(30, Math.ceil(hi / 10) * 10); }
    if (z.id === 'welle') { hi = Math.max(1, Math.ceil(hi * 2) / 2); }
    if (z.id === 'tide') { var a = Math.max(Math.abs(lo), Math.abs(hi), 0.5); a = Math.ceil(a * 2) / 2; lo = -a; hi = a; }
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
    if (W < 40) return;                       // Seite gerade nicht sichtbar
    // Auf dem Handy bleibt alles kompakt. Auf dem Laptop wären 40 Pixel je Stunde
    // zu viel - die Kurven zögen sich flach in die Breite. Dort lieber engere
    // Stunden und dafür höhere Zeilen.
    var schmal = W < 560;
    pxH = schmal ? Math.max(18, Math.min(40, Math.floor(W / 26))) : PXH_BREIT;
    var zeileH = schmal ? ZEILE_H_SCHMAL : ZEILE_H_BREIT;
    var n = daten.zeit.length;
    var padL = Math.ceil(W / 2), padR = Math.ceil(W / 2);
    var breite = padL + (n - 1) * pxH + padR;
    var x = function(i){ return padL + i * pxH; };

    // Geometrie der Zeilen
    var y = BAND_OBEN + BAND_CAM, zeilen = [];
    ZEILEN.forEach(function(z){
      var s = skala(z);
      var g = { z: z, s: s, y0: y + TITEL_H, h: zeileH, yt: y };
      g.yv = function(v){ return g.y0 + g.h - (v - s.lo) / (s.hi - s.lo) * g.h; };
      zeilen.push(g);
      y += TITEL_H + zeileH;
    });
    var hoehe = y + BAND_UNTEN;
    geo = { zeilen: zeilen, padL: padL, hoehe: hoehe, breite: breite, x: x, n: n };

    var s = [];
    s.push('<svg class="mg-svg" width="' + breite + '" height="' + hoehe + '" viewBox="0 0 ' + breite + ' ' + hoehe + '">');

    // Nacht leicht abdunkeln - über alle Zeilen
    var nachtStart = null;
    for (var i = 0; i <= n; i++) {
      var istNacht = i < n && !daten.tag[i];
      if (istNacht && nachtStart === null) nachtStart = i;
      if (!istNacht && nachtStart !== null) {
        s.push('<rect class="mg-nacht" x="' + (x(nachtStart) - pxH / 2) + '" y="' + (BAND_OBEN + BAND_CAM) + '" width="' + ((i - nachtStart) * pxH) + '" height="' + (hoehe - BAND_OBEN - BAND_CAM - BAND_UNTEN) + '"/>');
        nachtStart = null;
      }
    }

    // Zeilenhintergrund, Titel-Band, Gitter
    zeilen.forEach(function(g){
      s.push('<rect class="mg-titelband" x="0" y="' + g.yt + '" width="' + breite + '" height="' + TITEL_H + '"/>');
      g.s.ticks.forEach(function(t){
        var yy = g.yv(t);
        s.push('<line class="mg-grid" x1="' + x(0) + '" y1="' + yy + '" x2="' + x(n - 1) + '" y2="' + yy + '"/>');
      });
    });

    // Senkrechte Linien: alle 6 Stunden fein, Tagesgrenzen kräftig, Datum oben, Uhrzeit unten
    for (var i2 = 0; i2 < n; i2++) {
      var iso = daten.zeit[i2], hh = parseInt(iso.slice(11, 13), 10);
      if (hh % 6 !== 0) continue;
      var istTag = hh === 0;
      s.push('<line class="' + (istTag ? 'mg-tag' : 'mg-grid') + '" x1="' + x(i2) + '" y1="' + (BAND_OBEN) + '" x2="' + x(i2) + '" y2="' + (hoehe - BAND_UNTEN) + '"/>');
      s.push('<text class="mg-std" x="' + x(i2) + '" y="' + (hoehe - 7) + '" text-anchor="middle">' + iso.slice(11, 16) + '</text>');
      if (istTag) {
        var dt = new Date(iso);
        var heute = jetztKanarisch();
        var lab = (dt.toDateString() === heute.toDateString()) ? 'Heute' : WOCHENTAG[dt.getDay()] + ' ' + pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '.';
        s.push('<text class="mg-datum" x="' + (x(i2) + 6) + '" y="17">' + lab + '</text>');
      }
    }

    // Die Zeilen selbst
    zeilen.forEach(function(g){
      var z = g.z, F = daten[z.feld];
      if (z.art === 'balken') {
        var F2 = z.feld2 ? daten[z.feld2] : null;
        for (var i3 = 0; i3 < n; i3++) {
          if (F[i3] == null) continue;
          // Summenwerte (Sonne, Regen) gelten für die Stunde davor
          var bx = z.vorher ? x(i3) - pxH + 1 : x(i3) - pxH / 2 + 1, bw = pxH - 2;
          if (F2 && F2[i3] != null) {
            var y2 = g.yv(Math.min(F2[i3], g.s.hi));
            s.push('<rect class="mg-balken2" x="' + bx + '" y="' + y2 + '" width="' + bw + '" height="' + (g.y0 + g.h - y2) + '" fill="' + z.farbe + '"/>');
          }
          var y1 = g.yv(Math.min(F[i3], g.s.hi));
          s.push('<rect class="mg-balken" x="' + bx + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, g.y0 + g.h - y1) + '" fill="' + z.farbe + '"/>');
        }
      } else {
        var pts = [];
        for (var i4 = 0; i4 < n; i4++) if (F[i4] != null) pts.push([x(i4), g.yv(F[i4])]);
        if (pts.length > 1) {
          var pfad = z.glatt ? glattPfad(pts) : pts.map(function(p, k){ return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
          var unten = g.y0 + g.h;
          s.push('<path class="mg-flaeche" d="' + pfad + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + unten + ' L' + pts[0][0].toFixed(1) + ' ' + unten + ' Z" fill="' + z.farbe + '"/>');
          s.push('<path class="mg-linie" d="' + pfad + '" stroke="' + z.farbe + '"/>');
        }
      }
      // Beschriftungen: Sonnenauf-/untergang, Tageshoch/-tief, Hoch-/Niedrigwasser
      if (z.id === 'sonne') {
        daten.sonnenauf.forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↑ ' + iso.slice(11, 16) + '</text>'); });
        daten.sonnenunter.forEach(function(iso){ var xi = idxFuerIso(iso); if (xi >= 0 && xi < n) s.push('<text class="mg-sonne" x="' + x(xi) + '" y="' + (g.yt + 15) + '" text-anchor="middle">↓ ' + iso.slice(11, 16) + '</text>'); });
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
          var dt2 = new Date(daten.t0.getTime() + e.i * 3600000);
          s.push('<text class="mg-mark" x="' + x(e.i) + '" y="' + (e.hoch ? g.yv(e.v) - 8 : g.yv(e.v) + 15) + '" text-anchor="middle">' + pad2(dt2.getHours()) + ':' + pad2(dt2.getMinutes()) + '</text>');
        });
      }
    });

    // Webcam-Markierungen (Stunden, für die es ein Bild gibt)
    s.push('<g id="mg-cam-band"></g>');

    // Jetzt-Linie
    if (idxJetzt >= 0 && idxJetzt < n) {
      s.push('<line class="mg-jetzt" x1="' + x(idxJetzt) + '" y1="' + BAND_OBEN + '" x2="' + x(idxJetzt) + '" y2="' + (hoehe - BAND_UNTEN) + '"/>');
      // Die Datumsangaben stehen ebenfalls oben - bei Mitternacht wuerde sich
      // beides ueberlagern, dann reicht die Linie allein.
      if (Math.min(idxJetzt % 24, 24 - (idxJetzt % 24)) > 2.5) {
        s.push('<text class="mg-jetzt-t" x="' + (x(idxJetzt) + 4) + '" y="17">Jetzt</text>');
      }
    }
    s.push('</svg>');
    el.svgWrap.innerHTML = s.join('');
    el.svgWrap.style.height = hoehe + 'px';
    el.wrap.style.height = hoehe + 'px';

    // Achse links: Zeilentitel + Skalenwerte
    var a = [];
    zeilen.forEach(function(g){
      a.push('<div class="mg-ax-titel" style="top:' + g.yt + 'px;height:' + TITEL_H + 'px"><span class="mg-ax-punkt" style="background:' + g.z.farbe + '"></span>' + g.z.titel + ' <small>· ' + g.z.einheit + '</small></div>');
      g.s.ticks.forEach(function(t){
        var ty = Math.max(g.y0, Math.min(g.y0 + g.h - 14, g.yv(t) - 7));
        a.push('<div class="mg-ax-tick" style="top:' + ty + 'px">' + (g.z.id === 'welle' || g.z.id === 'tide' ? dez(t, 1) : Math.round(t)) + '</div>');
      });
    });
    a.push('<div class="mg-ax-datum" id="mg-ax-datum" style="top:0;height:' + BAND_OBEN + 'px"></div>');
    el.achse.innerHTML = a.join('');
    el.achse.style.height = hoehe + 'px';

    webcamMarken();
    if (zentrierJetzt) zentrieren(idxJetzt, false);
    else readout();
  }

  // Weiche Kurve durch alle Punkte (Catmull-Rom als Bezier)
  function glattPfad(p){
    var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
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
      var a = F[i - 1], b = F[i], c = F[i + 1];
      if (a == null || b == null || c == null) continue;
      var hoch = b >= a && b >= c && (b > a || b > c), tief = b <= a && b <= c && (b < a || b < c);
      if (!hoch && !tief) continue;
      var denom = a - 2 * b + c, shift = denom === 0 ? 0 : 0.5 * (a - c) / denom;
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
    try { el.scroll.scrollTo({ left: idx * pxH, behavior: weich ? 'smooth' : 'auto' }); }
    catch(e){ el.scroll.scrollLeft = idx * pxH; }
    readout();
  }

  function wertBei(z, f){
    var F = daten[z.feld], n = F.length;
    if (z.art === 'balken') {
      var i = z.vorher ? Math.ceil(f) : Math.round(f);
      i = Math.max(0, Math.min(n - 1, i));
      return { v: F[i], v2: z.feld2 ? daten[z.feld2][i] : null };
    }
    var i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1), t = f - i0;
    if (F[i0] == null || F[i1] == null) return { v: F[i0] != null ? F[i0] : F[i1] };
    return { v: F[i0] + (F[i1] - F[i0]) * t };
  }

  function readout(){
    if (!daten || !geo) return;
    if (rafReadout) return;
    // Kurz sammeln statt bei jedem Scroll-Pixel neu zu rechnen (kein
    // requestAnimationFrame: das steht still, solange der Tab im Hintergrund ist)
    rafReadout = setTimeout(function(){
      rafReadout = 0;
      var f = Math.max(0, Math.min(geo.n - 1, idxAusScroll()));
      var dt = new Date(daten.t0.getTime() + f * 3600000);
      var kopf = pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '. · ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
      var diff = f - idxJetzt;
      var rel = Math.abs(diff) < 0.5 ? 'jetzt' : (diff < 0 ? 'vor ' : 'in ') + relText(Math.abs(diff));
      el.zeit.innerHTML = '<b>' + kopf + '</b> <span class="mg-rel">' + rel + '</span>';
      // Datum der Stunde am linken Rand - bleibt beim Wischen stehen
      var links = Math.max(0, Math.min(geo.n - 1, f - el.scroll.clientWidth / 2 / pxH + 0.5));
      var dtL = new Date(daten.t0.getTime() + Math.floor(links) * 3600000);
      var axd = document.getElementById('mg-ax-datum');
      if (axd) axd.textContent = (dtL.toDateString() === jetztKanarisch().toDateString()) ? 'Heute' : WOCHENTAG[dtL.getDay()] + ' ' + pad2(dtL.getDate()) + '.' + pad2(dtL.getMonth() + 1) + '.';
      var chips = ZEILEN.map(function(z){
        var w = wertBei(z, f);
        if (w.v == null) return '';
        var icon = z.icon;
        if (z.id === 'tide') { var w2 = wertBei(z, Math.min(geo.n - 1, f + 1)); icon = w2.v != null && w2.v > w.v ? '🔼 Tide' : '🔽 Tide'; }
        return '<span class="mg-chip" style="--c:' + z.farbe + '"><i></i>' + icon + ' ' + z.fmt(w.v, w.v2) + '</span>';
      });
      var code = daten.code[Math.round(f)];
      var wetter = code != null ? '<span class="mg-chip">' + wmoIcon(code, daten.tag[Math.round(f)]) + ' ' + wmoText(code) + '</span>' : '';
      var wasser = daten.wasser[Math.round(f)];
      if (wasser != null) chips.push('<span class="mg-chip"><i style="background:#3fa9c9"></i>🏊 Wasser ' + Math.round(wasser) + '°</span>');
      el.werte.innerHTML = wetter + chips.join('');
      webcamZeigen(f);
    }, 16);
  }

  function relText(h){
    if (h < 1) return Math.round(h * 60) + ' Min.';
    if (h < 36) return Math.round(h) + ' Std.';
    var t = Math.round(h / 24); return t + (t === 1 ? ' Tag' : ' Tagen');
  }

  var WMO_ICON = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
  var WMO_TEXT = {0:'klar',1:'überwiegend klar',2:'teils bewölkt',3:'bedeckt',45:'Nebel',48:'Nebel',51:'Nieselregen',53:'Nieselregen',55:'Nieselregen',61:'leichter Regen',63:'Regen',65:'starker Regen',80:'Schauer',81:'Schauer',82:'kräftige Schauer',95:'Gewitter',96:'Gewitter',99:'Gewitter'};
  function wmoIcon(c, tag){ if (!tag && (c === 0 || c === 1)) return '🌙'; return WMO_ICON[c] || '🌤️'; }
  function wmoText(c){ return WMO_TEXT[c] || ''; }

  function status(t){ if (el.zeit) { el.zeit.innerHTML = '<span class="mg-rel">' + t + '</span>'; el.werte.innerHTML = ''; } }

  // ---------- Webcam-Bilder ----------
  // Zwei Quellen: das Bild der laufenden Stunde holt die Seite direkt beim
  // Kamerabetreiber (geht immer, ohne Einrichtung). Die vergangenen Stunden
  // liegen im eigenen Bildspeicher und kommen über den Worker - solange der
  // nicht eingerichtet ist, bleibt die Vergangenheit eben leer.
  function webcamLaden(){
    var o = ortObj();
    webcam = { shots: [], ort: o.id, speicher: false };
    fetch(webcamBasis() + '/webcam?ort=' + o.id)
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(j){
        if (!j || !Array.isArray(j.shots)) throw new Error('leer');
        if (webcam.ort !== o.id) return;                 // inzwischen umgeschaltet
        webcam.speicher = true;
        webcam.shots = j.shots.map(function(sh){
          return { i: idxFuerIso(sh.t), t: sh.t, url: sh.url.indexOf('http') === 0 ? sh.url : webcamBasis() + sh.url };
        });
        webcamMarken(); readout();
      })
      .catch(function(){ webcamMarken(); readout(); });
    webcamMarken();
  }

  // Adresse des Live-Bildes, alle 5 Minuten neu - sonst zeigt der Browser
  // ewig das zuerst geladene Bild.
  function liveUrl(cam){
    var t = Math.floor(Date.now() / 300000);
    return cam.live + (cam.live.indexOf('?') < 0 ? '?' : '&') + 'fv=' + t;
  }

  function webcamMarken(){
    var g = document.getElementById('mg-cam-band');
    if (!g || !geo) return;
    var s = [];
    webcam.shots.forEach(function(sh){
      if (sh.i < 0 || sh.i >= geo.n) return;
      s.push('<rect class="mg-cam-mark" x="' + (geo.x(sh.i) - 3) + '" y="' + (BAND_OBEN + 4) + '" width="6" height="' + (BAND_CAM - 8) + '" rx="1.5"/>');
    });
    // Das Live-Bild der laufenden Stunde als eigene Marke
    if (KAMERAS[ort] && idxJetzt >= 0 && idxJetzt < geo.n) {
      s.push('<rect class="mg-cam-mark is-live" x="' + (geo.x(idxJetzt) - 3) + '" y="' + (BAND_OBEN + 4) + '" width="6" height="' + (BAND_CAM - 8) + '" rx="1.5"/>');
    }
    g.innerHTML = s.join('');
  }

  var camAktuell = null;
  function webcamZeigen(f){
    if (!el.cam) return;
    var cam = KAMERAS[ort];
    if (!cam) { el.cam.hidden = true; return; }
    el.cam.hidden = false;

    var zukunft = f > idxJetzt + 0.5;
    var jetztStunde = Math.abs(f - idxJetzt) <= 0.5;

    // Gespeichertes Bild für die gewählte Stunde suchen
    var best = null, bestD = 1e9;
    webcam.shots.forEach(function(sh){ var d = Math.abs(sh.i - f); if (d < bestD) { bestD = d; best = sh; } });
    var treffer = best && bestD <= 0.75 ? best : null;

    var url = null, stempel = null, live = false;
    if (jetztStunde) { url = liveUrl(cam); live = true; }
    else if (treffer) { url = treffer.url; stempel = new Date(daten.t0.getTime() + treffer.i * 3600000); }

    if (!url) {
      el.cam.classList.add('is-leer');
      el.camText.innerHTML = zukunft
        ? 'Für die Zukunft gibt es noch kein Bild – das entsteht erst, wenn die Stunde da ist.'
        : (webcam.speicher
            ? 'Für diese Stunde liegt kein Bild vor.'
            : 'Vergangene Stunden erscheinen hier, sobald der Bildspeicher eingerichtet ist. Das Bild der laufenden Stunde siehst du über „Jetzt zentrieren“.');
      return;
    }
    el.cam.classList.remove('is-leer');
    if (camAktuell !== url) { camAktuell = url; el.camImg.src = url; }

    var quelle = cam.seite
      ? '<a href="' + cam.seite + '" target="_blank" rel="noopener" style="color:inherit">' + cam.quelle + ' ↗</a>'
      : cam.quelle;
    el.camText.innerHTML = '<b>📷 ' + cam.name + '</b>' +
      (cam.hinweis ? ' <span class="mg-camhint">' + cam.hinweis + '</span>' : '') +
      (live ? ' <span class="mg-live">live</span>'
            : ' · ' + pad2(stempel.getDate()) + '.' + pad2(stempel.getMonth() + 1) + '. ' + pad2(stempel.getHours()) + ':' + pad2(stempel.getMinutes())) +
      ' · ' + quelle;
  }

  // ---------- Oberfläche ----------
  function aufbauen(wurzel){
    wurzel.innerHTML =
      '<div class="mg-top">' +
        '<div class="mg-tabs" id="mg-orte" role="tablist" aria-label="Ort"></div>' +
        '<div class="mg-tabs mg-tabs-modell" id="mg-modelle" role="tablist" aria-label="Wettermodell"></div>' +
      '</div>' +
      '<div class="mg-head">' +
        '<div class="mg-readout"><div class="mg-zeit" id="mg-zeit"></div><div class="mg-werte" id="mg-werte"></div></div>' +
        '<div class="mg-knoepfe">' +
          '<button type="button" class="mg-btn" id="mg-zurueck" aria-label="Einen Tag zurück">‹</button>' +
          '<button type="button" class="mg-btn mg-btn-jetzt" id="mg-jetzt">Jetzt zentrieren</button>' +
          '<button type="button" class="mg-btn" id="mg-vor" aria-label="Einen Tag vor">›</button>' +
        '</div>' +
      '</div>' +
      '<div class="mg-cam" id="mg-cam" hidden><img id="mg-cam-img" alt="Webcam-Bild" decoding="async" referrerpolicy="no-referrer"><div class="mg-cam-text" id="mg-cam-text"></div></div>' +
      '<div class="mg-wrap" id="mg-wrap">' +
        '<div class="mg-scroll" id="mg-scroll"><div class="mg-svgwrap" id="mg-svgwrap"></div></div>' +
        '<div class="mg-achse" id="mg-achse"></div>' +
        '<div class="mg-cursor" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="mg-foot"><span>← Wischen → · Auswahl in der Mitte · Antippen holt die Stelle in die Mitte</span><span id="mg-quelle"></span></div>';
    el.scroll = document.getElementById('mg-scroll');
    el.svgWrap = document.getElementById('mg-svgwrap');
    el.achse = document.getElementById('mg-achse');
    el.wrap = document.getElementById('mg-wrap');
    el.zeit = document.getElementById('mg-zeit');
    el.werte = document.getElementById('mg-werte');
    el.cam = document.getElementById('mg-cam');
    el.camImg = document.getElementById('mg-cam-img');
    el.camText = document.getElementById('mg-cam-text');
    el.camImg.addEventListener('load', function(){
      // Ein 344 Pixel breites Kamerabild sieht auf einem breiten Bildschirm
      // matschig aus - deshalb nur so weit aufziehen, wie es vertraegt.
      var w = el.camImg.naturalWidth || 0;
      el.cam.style.maxWidth = w ? Math.max(360, Math.round(w * 1.6)) + 'px' : '';
    });
    el.camImg.addEventListener('error', function(){
      el.cam.classList.add('is-leer');
      el.camText.textContent = 'Das Kamerabild ist gerade nicht erreichbar.';
    });
    el.quelle = document.getElementById('mg-quelle');

    tabs('mg-orte', ORTE, function(o){ return o.id; }, function(o){ return o.name; }, function(){ return ort; }, function(id){ ort = id; lsSet('fuerte-mg-ort', id); laden(); });
    tabs('mg-modelle', MODELLE, function(m){ return m.id; }, function(m){ return m.name; }, function(){ return modell; }, function(id){ modell = id; lsSet('fuerte-mg-modell', id); laden(); });

    el.scroll.addEventListener('scroll', readout, { passive: true });
    el.scroll.addEventListener('click', function(ev){
      if (!geo) return;
      var r = el.scroll.getBoundingClientRect();
      var xi = (ev.clientX - r.left + el.scroll.scrollLeft - geo.padL) / pxH;
      zentrieren(xi, true);
    });
    document.getElementById('mg-jetzt').addEventListener('click', function(){ zentrieren(idxJetzt, true); });
    document.getElementById('mg-zurueck').addEventListener('click', function(){ zentrieren(idxAusScroll() - 24, true); });
    document.getElementById('mg-vor').addEventListener('click', function(){ zentrieren(idxAusScroll() + 24, true); });

    // Neu zeichnen, wenn die Seite sichtbar wird oder sich die Breite ändert
    var letzteBreite = 0;
    if (window.ResizeObserver) {
      new ResizeObserver(function(){
        var w = el.scroll.clientWidth;
        if (w > 40 && w !== letzteBreite) {
          var alt = geo ? idxAusScroll() : null;
          letzteBreite = w; zeichnen(alt === null);
          if (alt !== null) zentrieren(alt, false);
        }
      }).observe(el.scroll);
    } else {
      window.addEventListener('resize', function(){ zeichnen(false); });
    }
  }

  function tabs(id, liste, key, name, aktiv, setz){
    var box = document.getElementById(id);
    function malen(){
      box.innerHTML = liste.map(function(e){
        var k = key(e);
        return '<button type="button" role="tab" class="mg-tab' + (k === aktiv() ? ' is-on' : '') + '" data-id="' + k + '" aria-selected="' + (k === aktiv()) + '"' + (e.hinweis ? ' title="' + e.hinweis + '"' : '') + '>' + name(e) + '</button>';
      }).join('');
    }
    malen();
    box.addEventListener('click', function(ev){
      var b = ev.target.closest('.mg-tab'); if (!b) return;
      setz(b.getAttribute('data-id')); malen();
      if (el.quelle) quelleText();
    });
  }

  function quelleText(){
    var m = modellObj();
    el.quelle.textContent = 'Open-Meteo · ' + m.lang + ' · Meer & Tide: Open-Meteo Marine';
  }

  function init(){
    var wurzel = document.getElementById('meteogramm');
    if (!wurzel) return;
    aufbauen(wurzel);
    quelleText();
    laden();
    // Jede Viertelstunde die Jetzt-Linie nachziehen, jede Stunde neue Daten
    setInterval(function(){ if (daten) { idxJetzt = idxFuer(jetztKanarisch()); camAktuell = null; readout(); } }, 5 * 60000);
    setInterval(function(){ cache = {}; laden(); }, 60 * 60000);
  }

  window.Meteogramm = { init: init, neu: function(){ cache = {}; laden(); }, zeichnen: function(){ zeichnen(false); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
