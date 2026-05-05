// ============================================================
// Parallel — interactive latitude line over a world map
// ============================================================

(function () {
  'use strict';

  // ---- State ----
  const _urlLat = parseFloat(new URLSearchParams(window.location.search).get('lat'));
  let currentLat = (!isNaN(_urlLat) && _urlLat >= -85 && _urlLat <= 85) ? _urlLat : 42.36;
  let tolerance = 0.5;             // ± degrees considered "on the same latitude"
  let isDraggingLine = false;
  // updateUI gets reassigned later to also push to the globe view.
  let updateUI;

  // ---- URL state ----
  let _urlTimer;
  function pushURL(lat) {
    clearTimeout(_urlTimer);
    _urlTimer = setTimeout(() => {
      const url = new URL(window.location);
      url.searchParams.set('lat', lat.toFixed(2));
      history.replaceState(null, '', url.toString());
    }, 400);
  }

  // ---- Map setup ----
  const map = L.map('map', {
    center: [currentLat, _urlLat ? 0 : -10],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false,
    worldCopyJump: true,
    preferCanvas: false,
    attributionControl: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelDebounceTime: 40,
    wheelPxPerZoomLevel: 80,
    inertia: true,
  });

  // Open-source neutral cartography (CartoDB Voyager, no labels variant for cleaner look would also work)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // ---- Latitude line ----
  // We draw a long polyline spanning multiple world copies so it appears infinite.
  function lineCoords(lat) {
    return [
      [lat, -540],
      [lat, -360],
      [lat, -180],
      [lat, 0],
      [lat, 180],
      [lat, 360],
      [lat, 540],
    ];
  }

  // Glow under-line (wider, soft)
  const glowLine = L.polyline(lineCoords(currentLat), {
    className: 'lat-line-glow',
    interactive: false,
  }).addTo(map);

  // Invisible thick hit-area for easy grabbing (non-interactive so map can pan freely)
  const shadowLine = L.polyline(lineCoords(currentLat), {
    className: 'lat-line-shadow',
    interactive: false,
  }).addTo(map);

  // Visible thin line (non-interactive so map can pan freely)
  const mainLine = L.polyline(lineCoords(currentLat), {
    className: 'lat-line',
    interactive: false,
  }).addTo(map);

  function setLineLatitude(lat) {
    const coords = lineCoords(lat);
    glowLine.setLatLngs(coords);
    shadowLine.setLatLngs(coords);
    mainLine.setLatLngs(coords);
  }

  // ---- City pin markers (Leaflet) ----
  let cityMarkers = [];
  function clearCityMarkers() {
    cityMarkers.forEach(m => map.removeLayer(m));
    cityMarkers = [];
  }

  function makeCityIcon(city, highlighted) {
    const html = `
      <div class="city-pin-inner">
        <div class="city-pin-dot"></div>
        <div class="city-pin-label">
          ${escapeHtml(city.name)}<small>${city.lat.toFixed(2)}°</small>
        </div>
      </div>`;
    return L.divIcon({
      className: `city-pin${highlighted ? ' highlighted' : ''}`,
      html,
      iconSize: null,
      iconAnchor: [4, 0],
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---- Find matching cities ----
  function getMatchingCities(lat, tol) {
    return window.CITIES
      .map(c => ({ ...c, delta: Math.abs(c.lat - lat) }))
      .filter(c => c.delta <= tol)
      .sort((a, b) => a.delta - b.delta);
  }

  // ---- DOM refs ----
  const latInput = document.getElementById('latInput');
  const latHemi = document.getElementById('latHemi');
  const dmsReadout = document.getElementById('dmsReadout');
  const cityCount = document.getElementById('cityCount');
  const cityList = document.getElementById('cityList');
  const latTitle = document.getElementById('latTitle');
  const tolSlider = document.getElementById('tolSlider');
  const tolValue = document.getElementById('tolValue');
  const handleLabel = document.getElementById('handleLabel');
  const latHandle = document.getElementById('latHandle');
  const zoomReadout = document.getElementById('zoomReadout');
  const sunriseTimeEl = document.getElementById('sunriseTime');
  const sunsetTimeEl = document.getElementById('sunsetTime');
  const daylightDurationEl = document.getElementById('daylightDuration');
  const sunTimesEl = document.getElementById('sunTimes');

  // ---- Formatting helpers ----
  function toDMS(lat) {
    const abs = Math.abs(lat);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = Math.round((mFloat - m) * 60);
    const hemi = lat >= 0 ? 'N' : 'S';
    return `${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″ ${hemi}`;
  }

  function formatLat(lat) {
    const abs = Math.abs(lat);
    return `${abs.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  }

  // ---- Sunrise / sunset calculation ----
  // We express sunrise/sunset as hours-before/after LOCAL NOON rather than clock
  // time, because clock time varies by longitude across a parallel — only the
  // duration and the offset from noon are truly identical everywhere on the line.
  function getSunTimes(lat) {
    const now = new Date();
    const N = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const declDeg = -23.45 * Math.cos((360 / 365 * (N + 10)) * Math.PI / 180);
    const latRad = lat * Math.PI / 180;
    const declRad = declDeg * Math.PI / 180;
    const cosH = -Math.tan(latRad) * Math.tan(declRad);
    if (cosH <= -1) return { kind: 'midnight_sun' };
    if (cosH >= 1)  return { kind: 'polar_night' };
    const H = Math.acos(cosH) * 180 / Math.PI; // hour angle in degrees
    const offsetHr = H / 15;                   // hours before/after solar noon
    return {
      kind: 'normal',
      offsetHr,
      daylightMin: Math.round(offsetHr * 2 * 60),
    };
  }

  function fmtOffset(hr) {
    const h = Math.floor(hr);
    const m = Math.round((hr - h) * 60);
    return m > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${h}h`;
  }

  function updateSunCard(lat) {
    const s = getSunTimes(lat);
    if (s.kind === 'midnight_sun') {
      sunTimesEl.innerHTML = '<span class="sun-special">Midnight sun — no sunset today</span>';
    } else if (s.kind === 'polar_night') {
      sunTimesEl.innerHTML = '<span class="sun-special">Polar night — no sunrise today</span>';
    } else {
      const totalH = Math.floor(s.daylightMin / 60);
      const totalM = s.daylightMin % 60;
      const dayStr = totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`;
      const off = fmtOffset(s.offsetHr);
      sunTimesEl.innerHTML = `
        <span class="sun-item"><em class="sun-icon">↑</em> ${off} before noon</span>
        <span class="sun-sep">·</span>
        <span class="sun-item"><em class="sun-icon">↓</em> ${off} after noon</span>
        <span class="sun-duration">${dayStr} daylight</span>`;
    }
  }

  // ---- Update the entire UI for a given latitude ----
  let lastRenderedLat = null;
  let lastRenderedZoom = null;
  function _updateUIImpl(lat, opts = {}) {
    const { fromInput = false, skipMarkers = false } = opts;
    currentLat = clamp(lat, -85, 85);

    // Latitude readouts
    if (!fromInput) latInput.value = currentLat.toFixed(2);
    latHemi.textContent = currentLat >= 0 ? 'North' : 'South';
    dmsReadout.textContent = toDMS(currentLat);
    latTitle.textContent = formatLat(currentLat);
    handleLabel.textContent = formatLat(currentLat);

    // Move the line
    setLineLatitude(currentLat);

    // Move the handle (right edge, vertical position from map projection)
    const point = map.latLngToContainerPoint([currentLat, 0]);
    latHandle.style.top = `${point.y}px`;

    // Update cities
    const matches = getMatchingCities(currentLat, tolerance);
    cityCount.textContent = matches.length;
    renderCityList(matches);

    if (!skipMarkers) {
      // Only re-create markers when latitude changed materially (avoids thrash on pure pan)
      const latRounded = Math.round(currentLat * 100) / 100;
      if (latRounded !== lastRenderedLat) {
        renderCityMarkers(matches);
        lastRenderedLat = latRounded;
      }
    }

    updateSunCard(currentLat);
    pushURL(currentLat);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Now bind the public updateUI symbol to the impl. Later setup wraps this.
  updateUI = _updateUIImpl;

  // ============================================================
  // Search: city name OR latitude number
  // ============================================================
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchResults = document.getElementById('searchResults');
  const searchCard = searchInput.closest('.search-card');

  let activeIdx = -1;
  let lastResults = [];

  function highlightMatch(name, q) {
    if (!q) return escapeHtml(name);
    const lower = name.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(name);
    return escapeHtml(name.slice(0, idx)) +
      '<mark>' + escapeHtml(name.slice(idx, idx + q.length)) + '</mark>' +
      escapeHtml(name.slice(idx + q.length));
  }

  // ---- Nominatim geocoder (async fallback for cities not in dataset) ----
  let _nominatimTimer;
  let _nominatimQuery = '';

  async function fetchNominatim(q) {
    if (q.length < 2) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&featuretype=city&accept-language=en`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'Parallel-LatitudeApp/1.0' } });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.slice(0, 4).map(r => ({
        type: 'nominatim',
        name: r.display_name.split(',')[0].trim(),
        country: r.display_name.split(',').slice(-1)[0].trim(),
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        pop: 0,
      }));
    } catch {
      return [];
    }
  }

  function appendNominatimResults(nominatimHits, existingResults) {
    if (!nominatimHits.length) return;
    // Re-check query is still active
    if (_nominatimQuery !== searchInput.value.trim()) return;
    const sep = document.createElement('div');
    sep.style.cssText = 'padding: 6px 16px; font-family: JetBrains Mono, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-faint); border-top: 1px solid var(--rule); background: var(--paper-dim);';
    sep.textContent = 'Online results';
    searchResults.appendChild(sep);

    nominatimHits.forEach(r => {
      const i = existingResults.length;
      existingResults.push({ type: 'city', city: { name: r.name, country: r.country, lat: r.lat, lon: r.lon, pop: 0 } });
      const row = document.createElement('div');
      row.className = 'sr-row';
      row.dataset.idx = i;
      row.innerHTML = `
        <div>
          <div class="sr-name">${escapeHtml(r.name)}</div>
          <div class="sr-country">${escapeHtml(r.country)}</div>
        </div>
        <div class="sr-lat">${r.lat.toFixed(2)}°<br/><b>lat</b></div>`;
      row.addEventListener('mouseenter', () => { activeIdx = i; updateActiveRow(); });
      row.addEventListener('click', () => chooseResult(existingResults[i]));
      searchResults.appendChild(row);
    });
    lastResults = existingResults;
  }

  function runSearch(q) {
    q = q.trim();
    searchCard.classList.toggle('has-text', q.length > 0);
    if (!q) {
      searchResults.classList.remove('open');
      searchResults.innerHTML = '';
      lastResults = [];
      _nominatimQuery = '';
      return;
    }
    // Numeric? treat as latitude
    const num = parseFloat(q);
    const isNum = !isNaN(num) && /^-?\d+(\.\d+)?°?\s*[nNsS]?$/.test(q);
    let html = '';
    let results = [];

    if (isNum) {
      let lat = num;
      // Honor N/S suffix
      if (/[sS]\s*$/.test(q)) lat = -Math.abs(lat);
      lat = clamp(lat, -85, 85);
      results.push({ type: 'lat', lat });
      html += `
        <div class="sr-row sr-special" data-idx="0">
          <div class="sr-name">Go to <em>${lat.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}</em></div>
          <div class="sr-lat">parallel</div>
        </div>`;
    }

    // City matches (substring, case-insensitive)
    const ql = q.toLowerCase();
    const cityMatches = window.CITIES
      .filter(c => c.name.toLowerCase().includes(ql) || c.country.toLowerCase().includes(ql))
      .sort((a, b) => {
        // Prefer name-prefix matches, then by population
        const ap = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return (b.pop || 0) - (a.pop || 0);
      })
      .slice(0, 8);

    cityMatches.forEach(c => {
      const i = results.length;
      results.push({ type: 'city', city: c });
      html += `
        <div class="sr-row" data-idx="${i}">
          <div>
            <div class="sr-name">${highlightMatch(c.name, q)}</div>
            <div class="sr-country">${escapeHtml(c.country)}</div>
          </div>
          <div class="sr-lat">${c.lat.toFixed(2)}°<br/><b>lat</b></div>
        </div>`;
    });

    if (results.length === 0) {
      html = '<div class="sr-empty">No matches — trying online search…</div>';
    }

    lastResults = results;
    searchResults.innerHTML = html;
    searchResults.classList.add('open');
    activeIdx = results.length > 0 ? 0 : -1;
    updateActiveRow();

    searchResults.querySelectorAll('.sr-row').forEach(row => {
      row.addEventListener('mouseenter', () => {
        activeIdx = parseInt(row.dataset.idx, 10);
        updateActiveRow();
      });
      row.addEventListener('click', () => {
        const i = parseInt(row.dataset.idx, 10);
        chooseResult(results[i]);
      });
    });

    // Nominatim fallback: fire after 600ms if query is non-numeric and results are sparse
    clearTimeout(_nominatimTimer);
    if (!isNum && q.length >= 2 && cityMatches.length < 3) {
      _nominatimQuery = q;
      _nominatimTimer = setTimeout(async () => {
        const hits = await fetchNominatim(q);
        appendNominatimResults(hits, lastResults);
      }, 600);
    }
  }

  function updateActiveRow() {
    searchResults.querySelectorAll('.sr-row').forEach((r, i) => {
      r.classList.toggle('active', i === activeIdx);
    });
  }

  function chooseResult(r) {
    if (!r) return;
    if (r.type === 'lat') {
      searchInput.value = '';
      searchCard.classList.remove('has-text');
      searchResults.classList.remove('open');
      goToLatLon(r.lat, /* keep current map center longitude */ null);
    } else if (r.type === 'city') {
      searchInput.value = '';
      searchCard.classList.remove('has-text');
      searchResults.classList.remove('open');
      goToLatLon(r.city.lat, r.city.lon);
    }
  }

  function goToLatLon(lat, lon) {
    if (currentView === 'map') {
      const targetLon = lon == null ? map.getCenter().lng : lon;
      map.flyTo([lat, targetLon], Math.max(map.getZoom(), 5), { duration: 0.9 });
    } else if (window.ParallelGlobe) {
      if (lon != null) window.ParallelGlobe.flyToLongitude(lon);
    }
    updateUI(lat);
  }

  searchInput.addEventListener('input', () => runSearch(searchInput.value));
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      activeIdx = Math.min(lastResults.length - 1, activeIdx + 1);
      updateActiveRow();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      activeIdx = Math.max(0, activeIdx - 1);
      updateActiveRow();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (lastResults[activeIdx]) chooseResult(lastResults[activeIdx]);
      else {
        // raw enter with no results — try parsing as number
        const num = parseFloat(searchInput.value);
        if (!isNaN(num)) goToLatLon(clamp(num, -85, 85), null);
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      searchInput.blur();
      searchResults.classList.remove('open');
    }
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchCard.classList.remove('has-text');
    searchResults.classList.remove('open');
    searchInput.focus();
  });
  document.addEventListener('click', (e) => {
    if (!searchCard.contains(e.target)) {
      searchResults.classList.remove('open');
    }
  });

  // ============================================================
  // View toggle (Map / Globe)
  // ============================================================
  let currentView = 'map';
  document.body.classList.add('view-map');

  const spaceAudio = new Audio('space-ambience.aac');
  spaceAudio.loop = true;
  spaceAudio.volume = 0.18;

  document.querySelectorAll('.vt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (v === currentView) return;
      currentView = v;
      document.querySelectorAll('.vt-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.body.classList.toggle('view-map', v === 'map');
      document.body.classList.toggle('view-globe', v === 'globe');
      if (v === 'map') {
        setTimeout(() => map.invalidateSize(), 50);
        spaceAudio.pause();
      } else if (window.ParallelGlobe) {
        window.ParallelGlobe.onShow();
        // Push current state to globe
        window.ParallelGlobe.setLatitude(currentLat);
        window.ParallelGlobe.setCities(getMatchingCities(currentLat, tolerance));
        spaceAudio.play().catch(() => {});
      }
    });
  });

  // Hook updateUI to also push to globe
  const _origUpdateUI = updateUI;
  updateUI = function (lat, opts) {
    _origUpdateUI(lat, opts);
    if (window.ParallelGlobe) {
      window.ParallelGlobe.setLatitude(currentLat);
      window.ParallelGlobe.setCities(getMatchingCities(currentLat, tolerance));
    }
  };

  // Expose for globe.js lat drag
  window._parallelSetLat = (lat) => updateUI(lat);

  function renderCityList(matches) {
    if (matches.length === 0) {
      cityList.innerHTML = `
        <div class="cp-empty">
          No major cities on this parallel.
          <small>TRY A DIFFERENT LATITUDE</small>
        </div>`;
      return;
    }
    cityList.innerHTML = matches.map(c => `
      <div class="city-row" data-lat="${c.lat}" data-lon="${c.lon}">
        <div>
          <div class="city-name">${escapeHtml(c.name)}</div>
          <div class="city-country">${escapeHtml(c.country)}</div>
        </div>
        <div class="city-meta">
          ${c.lat.toFixed(2)}°<br/>
          <span class="city-delta">Δ ${c.delta.toFixed(2)}°</span>
        </div>
      </div>
    `).join('');

    // Click to fly to city
    cityList.querySelectorAll('.city-row').forEach(row => {
      row.addEventListener('click', () => {
        const lat = parseFloat(row.dataset.lat);
        const lon = parseFloat(row.dataset.lon);
        // Fly there, set latitude to exactly the city's parallel
        map.flyTo([lat, lon], Math.max(map.getZoom(), 5), { duration: 0.9 });
        updateUI(lat);
      });
    });
  }

  // Return the subset of matches to actually place as map markers, scaled to zoom.
  function getMarkersToShow(matches) {
    const z = map.getZoom();
    const cap = z >= 8 ? 100 : z >= 5 ? 50 : 15;

    // Always guarantee the most prominent cities show at any zoom (avoids empty map)
    const byPop = [...matches].sort((a, b) => (b.pop || 0) - (a.pop || 0));
    const topGuaranteed = byPop.slice(0, Math.min(10, cap));

    if (z < 5) {
      // World view — only top cities, no clutter
      return topGuaranteed;
    }

    // Regional / local view — add viewport cities above a population threshold
    const popMin = z >= 9 ? 0 : z >= 7 ? 50000 : 200000;
    const bounds = map.getBounds().pad(0.4);
    const inView = matches.filter(c =>
      (c.pop || 0) >= popMin && (
        bounds.contains([c.lat, c.lon]) ||
        bounds.contains([c.lat, c.lon + 360]) ||
        bounds.contains([c.lat, c.lon - 360])
      )
    );

    const merged = [...new Map([...topGuaranteed, ...inView].map(c => [c.name, c])).values()];
    return merged.sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, cap);
  }

  function renderCityMarkers(matches) {
    clearCityMarkers();
    getMarkersToShow(matches).forEach(c => {
      const marker = L.marker([c.lat, c.lon], {
        icon: makeCityIcon(c, c.delta < 0.15),
        interactive: true,
        keyboard: false,
        riseOnHover: true,
      });
      marker.on('click', () => {
        map.flyTo([c.lat, c.lon], Math.max(map.getZoom(), 7), { duration: 0.7 });
        updateUI(c.lat);
      });
      marker.addTo(map);
      cityMarkers.push(marker);
    });
  }

  // ============================================================
  // Drag the latitude line
  // ============================================================
  function startLineDrag(e) {
    if (isDraggingLine) return;
    isDraggingLine = true;
    document.getElementById('map').classList.add('dragging-line');
    map.dragging.disable();
    map.scrollWheelZoom.disable();

    const moveHandler = (ev) => {
      const point = ev.touches
        ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
        : { x: ev.clientX, y: ev.clientY };
      const mapRect = document.getElementById('map').getBoundingClientRect();
      const containerPoint = L.point(point.x - mapRect.left, point.y - mapRect.top);
      const latlng = map.containerPointToLatLng(containerPoint);
      updateUI(latlng.lat);
      ev.preventDefault();
    };

    const endHandler = () => {
      isDraggingLine = false;
      document.getElementById('map').classList.remove('dragging-line');
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', endHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', endHandler);

    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
  }

  // Drag from the right-edge handle — always vertical intent, commit immediately.
  latHandle.addEventListener('mousedown', startLineDrag);
  latHandle.addEventListener('touchstart', startLineDrag, { passive: false });

  // ---- Proximity drag: click ON the line to drag latitude, anywhere else pans ----
  const LINE_HIT_PX = 10; // ± pixels from the line considered "on the line"
  const mapEl = document.getElementById('map');

  function isNearLine(clientY) {
    const mapRect = mapEl.getBoundingClientRect();
    const containerY = clientY - mapRect.top;
    const lineScreenY = map.latLngToContainerPoint([currentLat, 0]).y;
    return Math.abs(containerY - lineScreenY) <= LINE_HIT_PX;
  }

  // Change cursor to ↕ when hovering near the line
  mapEl.addEventListener('mousemove', (e) => {
    if (isDraggingLine) return;
    mapEl.style.cursor = isNearLine(e.clientY) ? 'ns-resize' : '';
  });

  // Capture-phase mousedown fires before Leaflet's drag handler.
  // If the click is near the line, grab it for latitude drag.
  mapEl.addEventListener('mousedown', (e) => {
    if (isNearLine(e.clientY)) {
      e.stopPropagation(); // prevent Leaflet from starting a pan
      startLineDrag(e);
    }
  }, { capture: true });

  // Touch equivalent
  mapEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && isNearLine(e.touches[0].clientY)) {
      e.stopPropagation();
      startLineDrag(e);
    }
  }, { capture: true, passive: false });

  // Safety: if window loses focus mid-drag, re-enable map controls
  window.addEventListener('blur', () => {
    if (isDraggingLine) {
      isDraggingLine = false;
      document.getElementById('map').classList.remove('dragging-line');
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    }
  });

  // ============================================================
  // Latitude input
  // ============================================================
  latInput.addEventListener('input', () => {
    const v = parseFloat(latInput.value);
    if (!isNaN(v)) {
      updateUI(v, { fromInput: true });
    }
  });
  latInput.addEventListener('blur', () => {
    updateUI(currentLat); // re-format
  });

  // ============================================================
  // Tolerance slider
  // ============================================================
  tolSlider.addEventListener('input', () => {
    tolerance = parseFloat(tolSlider.value);
    tolValue.textContent = tolerance.toFixed(1);
    lastRenderedLat = null; // force marker refresh
    updateUI(currentLat);
  });

  // ============================================================
  // Zoom controls
  // ============================================================
  document.getElementById('zoomIn').addEventListener('click', () => {
    map.zoomIn();
  });
  document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut();
  });

  // ============================================================
  // Map events: keep handle aligned during pan/zoom
  // ============================================================
  function syncHandlePosition() {
    const point = map.latLngToContainerPoint([currentLat, 0]);
    latHandle.style.top = `${point.y}px`;
    zoomReadout.textContent = `z ${map.getZoom().toFixed(1).replace(/\.0$/, '')}`;
  }
  map.on('move zoom', syncHandlePosition);
  map.on('moveend zoomend', () => {
    syncHandlePosition();
    // Re-render markers when zoom level changes (viewport and population filter both change)
    const z = Math.floor(map.getZoom());
    if (z !== lastRenderedZoom) {
      lastRenderedZoom = z;
      const matches = getMatchingCities(currentLat, tolerance);
      renderCityMarkers(matches);
    }
  });

  // ============================================================
  // Keyboard nudge + clickable nudge buttons
  // ============================================================
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === latInput) return;
    const step = e.shiftKey ? 5 : (e.altKey ? 0.05 : 0.5);
    if (e.key === 'ArrowUp') {
      updateUI(currentLat + step);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      updateUI(currentLat - step);
      e.preventDefault();
    }
  });

  document.getElementById('nudgeUp')?.addEventListener('click', () => updateUI(currentLat + 0.5));
  document.getElementById('nudgeDown')?.addEventListener('click', () => updateUI(currentLat - 0.5));

  // ============================================================
  // Init
  // ============================================================
  updateUI(currentLat);
  // After map fully sized, sync handle
  setTimeout(syncHandlePosition, 50);

  // Re-sync handle on window resize
  window.addEventListener('resize', () => {
    map.invalidateSize();
    syncHandlePosition();
  });
})();
