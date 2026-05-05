// ============================================================
// Parallel — Globe view (Three.js)
// Renders a slowly-rotating Earth sphere with a highlighted
// latitude ring and city markers on that ring.
// ============================================================

(function () {
  'use strict';

  const canvas = document.getElementById('globe');
  if (!canvas || typeof THREE === 'undefined') return;

  // ---- Scene basics ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f1e8);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 5.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---- Lighting ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.0);
  sun.position.set(5, 3, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xc8a988, 0.35);
  rim.position.set(-4, -1, -3);
  scene.add(rim);

  // ============================================================
  // Earth — procedural texture drawn from country geojson would
  // be ideal; instead we use a public-domain NASA Blue Marble
  // tile (low-res for fast load), tinted to match the paper feel.
  // We try a reliable Three.js example texture as primary.
  // ============================================================
  const EARTH_TEXTURE_URLS = [
    'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  ];

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const EARTH_RADIUS = 1.5;

  // Placeholder material until texture loads (subtle paper-toned sphere)
  const placeholderMat = new THREE.MeshPhongMaterial({
    color: 0xc7bfa9,
    specular: 0x222222,
    shininess: 8,
  });
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 96, 96),
    placeholderMat
  );
  earthGroup.add(earthMesh);

  // Atmosphere halo
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
        gl_FragColor = vec4(0.95, 0.55, 0.42, 1.0) * intensity;
      }`,
  });
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 64, 64),
    atmoMat
  );
  scene.add(atmosphere);

  // Texture loader with fallback
  const texLoader = new THREE.TextureLoader();
  texLoader.crossOrigin = 'anonymous';
  function tryLoadEarth(idx) {
    if (idx >= EARTH_TEXTURE_URLS.length) return;
    texLoader.load(
      EARTH_TEXTURE_URLS[idx],
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        earthMesh.material = new THREE.MeshPhongMaterial({
          map: tex,
          specular: 0x111111,
          shininess: 10,
        });
        earthMesh.material.needsUpdate = true;
      },
      undefined,
      () => tryLoadEarth(idx + 1)
    );
  }
  tryLoadEarth(0);

  // ============================================================
  // Latitude ring (highlighted parallel)
  // ============================================================
  function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function buildRingGeometry(lat, radius, segments = 256) {
    const phi = (90 - lat) * Math.PI / 180;
    const ringR = radius * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const positions = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      positions.push(ringR * Math.cos(t), y, ringR * Math.sin(t));
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }

  // Two stacked rings: a glow (thicker, transparent) and the crisp line.
  // For "thick lines" we use TubeGeometry around a CatmullRomCurve3.
  function buildRingTube(lat, radius, tubeRadius) {
    const phi = (90 - lat) * Math.PI / 180;
    const ringR = radius * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const points = [];
    const segs = 200;
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      points.push(new THREE.Vector3(ringR * Math.cos(t), y, ringR * Math.sin(t)));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, segs, tubeRadius, 8, true);
  }

  const ringRadius = EARTH_RADIUS * 1.005;

  // Main crisp ring
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xe85d3a),
    transparent: true,
    opacity: 0.95,
  });
  let ringMesh = new THREE.Mesh(buildRingTube(0, ringRadius, 0.008), ringMat);
  earthGroup.add(ringMesh);

  // Glow ring
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff7a55),
    transparent: true,
    opacity: 0.18,
  });
  let ringGlow = new THREE.Mesh(buildRingTube(0, ringRadius, 0.025), glowMat);
  earthGroup.add(ringGlow);

  // Invisible anchor point tracking the ring center — used to position the lat drag handle.
  let currentGlobeLat = 0;
  const ringCenterObj = new THREE.Object3D();
  earthGroup.add(ringCenterObj);

  function setRingLatitude(lat) {
    const newRing = buildRingTube(lat, ringRadius, 0.008);
    const newGlow = buildRingTube(lat, ringRadius, 0.025);
    ringMesh.geometry.dispose();
    ringGlow.geometry.dispose();
    ringMesh.geometry = newRing;
    ringGlow.geometry = newGlow;
    // Keep ringCenterObj at the ring's local Y so we can project it to screen
    const phi = (90 - lat) * Math.PI / 180;
    ringCenterObj.position.set(0, ringRadius * Math.cos(phi), 0);
    currentGlobeLat = lat;
  }

  // ============================================================
  // City markers on the ring (3D dots + DOM labels)
  // ============================================================
  const markerGroup = new THREE.Group();
  earthGroup.add(markerGroup);

  // Container for HTML labels overlaying the canvas
  const labelLayer = document.createElement('div');
  labelLayer.style.cssText = `
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 50;
  `;
  // Wrap canvas in a positioned parent so label layer can overlay.
  // pointer-events:none so the wrapper never blocks map interactions in map view.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute; inset:0; pointer-events:none;';
  canvas.parentNode.insertBefore(wrap, canvas);
  wrap.appendChild(canvas);
  wrap.appendChild(labelLayer);
  // Restore canvas pointer events (overridden by parent none)
  canvas.style.pointerEvents = 'auto';

  let cityEntries = []; // {city, dotMesh, labelEl}

  function clearCityMarkers() {
    cityEntries.forEach(e => {
      markerGroup.remove(e.dotMesh);
      e.dotMesh.geometry.dispose();
      e.dotMesh.material.dispose();
      if (e.labelEl && e.labelEl.parentNode) e.labelEl.parentNode.removeChild(e.labelEl);
    });
    cityEntries = [];
  }

  function setCityMarkers(cities) {
    clearCityMarkers();
    const dotGeom = new THREE.SphereGeometry(0.018, 16, 16);
    cities.forEach(city => {
      // Place dot ON the city's actual latitude (its real position),
      // but the user is shown how that aligns to the highlighted ring.
      const pos = latLonToVec3(city.lat, city.lon, EARTH_RADIUS * 1.012);
      const mat = new THREE.MeshBasicMaterial({ color: 0xe85d3a });
      const dot = new THREE.Mesh(dotGeom, mat);
      dot.position.copy(pos);
      markerGroup.add(dot);

      const label = document.createElement('div');
      label.className = 'globe-city-label';
      label.innerHTML = `<span class="g-dot"></span><span class="g-name">${escapeHtml(city.name)}</span>`;
      labelLayer.appendChild(label);

      cityEntries.push({ city, dotMesh: dot, labelEl: label });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Inject label CSS once
  const labelStyle = document.createElement('style');
  labelStyle.textContent = `
    .globe-city-label {
      position: absolute;
      transform: translate(8px, -50%);
      font-family: 'Instrument Serif', serif;
      font-size: 14px;
      color: #1a1a1a;
      background: rgba(245, 241, 232, 0.92);
      padding: 1px 7px;
      border-radius: 3px;
      border: 1px solid #d8d2c2;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      transition: opacity 0.2s;
    }
    .globe-city-label .g-dot {
      display: inline-block;
      width: 5px; height: 5px;
      background: #e85d3a;
      border-radius: 50%;
      margin-right: 5px;
      transform: translateY(-1px);
    }
    .globe-city-label.hidden { opacity: 0; }
  `;
  document.head.appendChild(labelStyle);

  // ============================================================
  // Globe latitude drag handle
  // ============================================================
  const globeLatHandle = document.getElementById('globeLatHandle');
  const globeLatLabel = document.getElementById('globeLatLabel');

  // Project a ring-center point (given lat) to canvas screen Y.
  function ringScreenY(lat) {
    const phi = (90 - lat) * Math.PI / 180;
    const localPt = new THREE.Vector3(0, ringRadius * Math.cos(phi), 0);
    earthGroup.localToWorld(localPt);
    const proj = localPt.project(camera);
    return (-proj.y * 0.5 + 0.5) * canvas.clientHeight;
  }

  function updateLatHandlePosition() {
    if (!globeLatHandle) return;
    const sy = ringScreenY(currentGlobeLat);
    globeLatHandle.style.top = `${sy}px`;
    if (globeLatLabel) {
      const abs = Math.abs(currentGlobeLat);
      globeLatLabel.textContent = `${abs.toFixed(2)}°${currentGlobeLat >= 0 ? 'N' : 'S'}`;
    }
  }

  if (globeLatHandle) {
    let latDragActive = false;
    let latDragStartY = 0;
    let latDragStartLat = 0;
    let pxPerDeg = 3; // will be computed at drag start

    globeLatHandle.addEventListener('mousedown', (e) => {
      latDragActive = true;
      latDragStartY = e.clientY;
      latDragStartLat = currentGlobeLat;
      // Compute pixel-per-degree at current lat by comparing two projected ring positions
      const sy0 = ringScreenY(currentGlobeLat);
      const sy1 = ringScreenY(currentGlobeLat + 1);
      pxPerDeg = Math.max(1, sy0 - sy1); // moving north → smaller screenY
      e.preventDefault();
      e.stopPropagation();
    });
    globeLatHandle.addEventListener('touchstart', (e) => {
      latDragActive = true;
      latDragStartY = e.touches[0].clientY;
      latDragStartLat = currentGlobeLat;
      const sy0 = ringScreenY(currentGlobeLat);
      const sy1 = ringScreenY(currentGlobeLat + 1);
      pxPerDeg = Math.max(1, sy0 - sy1);
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
      if (!latDragActive) return;
      const dy = e.clientY - latDragStartY;
      const newLat = Math.max(-85, Math.min(85, latDragStartLat - dy / pxPerDeg));
      window._parallelSetLat?.(newLat);
    });
    window.addEventListener('touchmove', (e) => {
      if (!latDragActive) return;
      const dy = e.touches[0].clientY - latDragStartY;
      const newLat = Math.max(-85, Math.min(85, latDragStartLat - dy / pxPerDeg));
      window._parallelSetLat?.(newLat);
    }, { passive: false });
    window.addEventListener('mouseup', () => { latDragActive = false; });
    window.addEventListener('touchend', () => { latDragActive = false; });
  }

  // ============================================================
  // Rotation: slow auto-spin + click-drag to rotate
  // ============================================================
  let autoRotate = true;
  let yaw = 0;     // around Y
  let pitch = 0.15; // tilt
  let dragVx = 0, dragVy = 0;
  let isDragging = false;
  let lastX = 0, lastY = 0;

  function pointerDown(e) {
    isDragging = true;
    autoRotate = false;
    if (arBtn) arBtn.classList.remove('active');
    clearTimeout(window.__pgResume);
    const p = e.touches ? e.touches[0] : e;
    lastX = p.clientX; lastY = p.clientY;
    canvas.style.cursor = 'grabbing';
  }
  function pointerMove(e) {
    if (!isDragging) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - lastX;
    const dy = p.clientY - lastY;
    lastX = p.clientX; lastY = p.clientY;
    yaw   += dx * 0.005;
    pitch += dy * 0.005;
    pitch = Math.max(-1.0, Math.min(1.0, pitch));
    dragVx = dx * 0.005;
    dragVy = dy * 0.005;
    e.preventDefault();
  }
  function pointerUp() {
    if (!isDragging) return; // only process if we actually dragged the globe
    isDragging = false;
    canvas.style.cursor = 'grab';
    clearTimeout(window.__pgResume);
    window.__pgResume = setTimeout(() => {
      autoRotate = true;
      if (arBtn) arBtn.classList.add('active');
    }, 2500);
  }
  canvas.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('touchstart', pointerDown, { passive: false });
  window.addEventListener('touchmove', pointerMove, { passive: false });
  window.addEventListener('touchend', pointerUp);
  canvas.style.cursor = 'grab';

  // Wheel zoom (camera dolly)
  canvas.addEventListener('wheel', (e) => {
    const delta = e.deltaY * 0.002;
    camera.position.z = Math.max(1.8, Math.min(8.0, camera.position.z + delta));
    e.preventDefault();
  }, { passive: false });

  // ============================================================
  // Project markers to screen each frame — with collision culling
  // ============================================================
  const tmpVec = new THREE.Vector3();
  const LABEL_W = 120, LABEL_H = 22; // approx rendered label size in px

  function updateLabels() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Project every entry and tag whether it's on the back of the globe.
    // Correct test: dot(cityWorldPos, cameraPos) < 0 means city is on far side.
    const projected = cityEntries.map(e => {
      e.dotMesh.getWorldPosition(tmpVec);
      const proj = tmpVec.clone().project(camera);
      const x = (proj.x * 0.5 + 0.5) * w;
      const y = (-proj.y * 0.5 + 0.5) * h;
      const behind = proj.z > 1 || tmpVec.dot(camera.position) < 0;
      return { e, x, y, behind, pop: e.city.pop || 0 };
    });

    // Greedy label placement: process highest-pop cities first to give them priority
    const sorted = [...projected].sort((a, b) => b.pop - a.pop);
    const placed = []; // array of {x1,y1,x2,y2} bounding boxes

    sorted.forEach(item => {
      // Always hide dots on far side
      item.e.dotMesh.visible = !item.behind;

      if (item.behind) {
        item.e.labelEl.classList.add('hidden');
        return;
      }

      // Label box: offset 10px right of the projected dot
      const lx1 = item.x + 10, ly1 = item.y - LABEL_H / 2;
      const lx2 = lx1 + LABEL_W, ly2 = ly1 + LABEL_H;

      const overlaps = placed.some(r =>
        lx1 < r.x2 && lx2 > r.x1 && ly1 < r.y2 && ly2 > r.y1
      );

      item.e.labelEl.style.left = `${item.x}px`;
      item.e.labelEl.style.top  = `${item.y}px`;

      if (!overlaps) {
        item.e.labelEl.classList.remove('hidden');
        placed.push({ x1: lx1, y1: ly1, x2: lx2, y2: ly2 });
      } else {
        item.e.labelEl.classList.add('hidden');
      }
    });
  }

  // ============================================================
  // Animate
  // ============================================================
  function animate() {
    if (autoRotate && !isDragging) {
      yaw += 0.0012; // slow turn
    }
    earthGroup.rotation.y = yaw;
    earthGroup.rotation.x = pitch;
    atmosphere.rotation.y = yaw;
    atmosphere.rotation.x = pitch;

    updateLabels();
    updateLatHandlePosition();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  resize();
  animate();

  // Recompute size whenever globe becomes visible
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ============================================================
  // Globe zoom buttons
  // ============================================================
  document.getElementById('globeZoomIn')?.addEventListener('click', () => {
    camera.position.z = Math.max(1.8, camera.position.z - 0.5);
  });
  document.getElementById('globeZoomOut')?.addEventListener('click', () => {
    camera.position.z = Math.min(8.0, camera.position.z + 0.5);
  });

  // ============================================================
  // Auto-rotate toggle button
  // ============================================================
  const arBtn = document.getElementById('autoRotateToggle');
  if (arBtn) {
    arBtn.addEventListener('click', () => {
      autoRotate = !autoRotate;
      arBtn.classList.toggle('active', autoRotate);
      if (autoRotate) clearTimeout(window.__pgResume);
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  window.ParallelGlobe = {
    setLatitude(lat) { setRingLatitude(lat); },
    setCities(cities) { setCityMarkers(cities); },
    onShow() {
      resize();
    },
    pauseAutoRotate() {
      autoRotate = false;
      if (arBtn) arBtn.classList.remove('active');
    },
    resumeAutoRotate() {
      autoRotate = true;
      if (arBtn) arBtn.classList.add('active');
    },
    // Smoothly rotate to bring a given lon (and current latitude) to face camera
    flyToLongitude(lon) {
      autoRotate = false;
      const targetYaw = -((lon + 180) * Math.PI / 180) + Math.PI;
      // Normalize current yaw
      const TAU = Math.PI * 2;
      let cur = yaw % TAU;
      let tgt = targetYaw % TAU;
      let diff = tgt - cur;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      const dest = yaw + diff;
      const start = yaw;
      const t0 = performance.now();
      const dur = 900;
      function step() {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; // easeInOutQuad
        yaw = start + (dest - start) * e;
        if (t < 1) requestAnimationFrame(step);
        else {
          clearTimeout(window.__pgResume);
          window.__pgResume = setTimeout(() => { autoRotate = true; }, 2500);
        }
      }
      step();
    },
  };
})();
