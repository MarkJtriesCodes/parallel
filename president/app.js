/* ============================================================
   MAKE ME PRESIDENT — UI
   ============================================================ */
(function () {
  'use strict';

  const values = {};
  LEVERS.forEach(l => { values[l.id] = l.base; });
  let horizon = 4;

  /* ---------- URL hash sharing ---------- */
  function loadHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const obj = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (obj.y) horizon = Math.max(1, Math.min(10, obj.y));
      if (obj.v) for (const k in obj.v) {
        const l = LEVER_MAP[k];
        if (l) values[k] = Math.max(l.min, Math.min(l.max, +obj.v[k]));
      }
    } catch (e) { /* ignore malformed hashes */ }
  }
  function saveHash() {
    const v = {};
    LEVERS.forEach(l => { if (values[l.id] !== l.base) v[l.id] = values[l.id]; });
    const payload = { y: horizon, v };
    history.replaceState(null, '', Object.keys(v).length || horizon !== 4
      ? '#' + encodeURIComponent(JSON.stringify(payload)) : location.pathname);
  }

  /* ---------- formatting ---------- */
  function fmtVal(l, v) {
    if (l.toggle) return l.toggle[v];
    if (l.toggle3) return l.toggle3[v + 1];
    const s = (l.step < 1 && Math.abs(v) < 100) ? v.toFixed(l.step < 0.1 ? 2 : 1) : Math.round(v).toLocaleString();
    if (l.unit === '$') return '$' + s;
    if (l.unit === '$k') return '$' + s + 'k';
    if (l.unit === '$/mo') return '$' + s + '/mo';
    if (l.unit === '$/ton') return '$' + s + '/ton';
    if (l.unit === '$B/yr') return '$' + s + 'B/yr';
    if (l.unit === '$T') return (v >= 0 ? '+' : '') + s + '$T';
    if (l.unit === '%' || l.unit === '% APR' || l.unit === '% units' || l.unit === '% GDP' || l.unit === 'pp') {
      const sign = (l.base === 0 && v > 0) ? '+' : '';
      return sign + s + (l.unit === '% GDP' ? '% GDP' : l.unit === 'pp' ? 'pp' : '%');
    }
    if (l.unit === 'M/yr') return s + 'M/yr';
    if (l.unit === 'k units/yr') return s + 'k/yr';
    if (l.unit === 'wks') return s + ' wks';
    if (l.unit === 'bps') return s + ' bps';
    if (l.unit === '') return (v > 0 ? '+' : '') + s;
    return s + ' ' + l.unit;
  }
  const fmt = {
    pct: v => v.toFixed(1) + '%',
    pct2: v => v.toFixed(2) + '%',
    usdK: v => '$' + Math.round(v).toLocaleString() + 'k',
    idx: v => Math.round(v).toLocaleString(),
    usd: v => '$' + v.toFixed(2),
  };
  function delta(v, base, unit, invert) {
    const d = v - base;
    const good = invert ? d < 0 : d > 0;
    const cls = Math.abs(d) < 0.005 ? 'neutral' : (good ? 'good' : 'bad');
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    const body = unit === '%' ? Math.abs(d).toFixed(1) + 'pp'
      : unit === 'k' ? '$' + Math.abs(Math.round(d * 1000)).toLocaleString()
      : Math.abs(d).toFixed(1);
    return `<span class="delta ${cls}">${sign}${body}</span>`;
  }

  /* ---------- build lever sidebar ---------- */
  function buildSidebar() {
    const aside = document.getElementById('levers');
    CATEGORIES.forEach((cat, ci) => {
      const det = document.createElement('details');
      det.className = 'cat';
      det.open = ci === 0;
      const catLevers = LEVERS.filter(l => l.cat === cat.id);
      det.innerHTML = `<summary>${cat.icon} ${cat.name} <span class="count" id="count-${cat.id}"></span></summary>`;
      catLevers.forEach(l => {
        const row = document.createElement('div');
        row.className = 'lever';
        row.id = 'lever-' + l.id;
        row.innerHTML = `
          <div class="lever-head">
            <button class="info-btn" data-id="${l.id}" title="What the evidence says">ⓘ</button>
            <span class="lever-name">${l.name}</span>
            <span class="lever-val" id="val-${l.id}">${fmtVal(l, values[l.id])}</span>
          </div>
          <input type="range" min="${l.min}" max="${l.max}" step="${l.step}" value="${values[l.id]}" data-id="${l.id}">
          <div class="lever-info hidden" id="info-${l.id}">
            <p>${l.desc}</p>
            <p class="ev"><strong>Evidence:</strong> ${l.evidence}</p>
          </div>`;
        det.appendChild(row);
      });
      aside.appendChild(det);
    });

    aside.addEventListener('input', e => {
      if (e.target.type !== 'range') return;
      const id = e.target.dataset.id;
      values[id] = parseFloat(e.target.value);
      document.getElementById('val-' + id).textContent = fmtVal(LEVER_MAP[id], values[id]);
      scheduleRun();
    });
    aside.addEventListener('click', e => {
      const btn = e.target.closest('.info-btn');
      if (!btn) return;
      document.getElementById('info-' + btn.dataset.id).classList.toggle('hidden');
    });
  }

  function refreshSidebar() {
    LEVERS.forEach(l => {
      const slider = document.querySelector(`input[data-id="${l.id}"]`);
      if (slider) slider.value = values[l.id];
      const val = document.getElementById('val-' + l.id);
      if (val) val.textContent = fmtVal(l, values[l.id]);
      const row = document.getElementById('lever-' + l.id);
      if (row) row.classList.toggle('changed', values[l.id] !== l.base);
      if (l.needs) {
        let ok = true;
        for (const k in l.needs) if (values[k] !== l.needs[k]) ok = false;
        if (row) row.classList.toggle('disabled', !ok);
      }
    });
    CATEGORIES.forEach(c => {
      const n = LEVERS.filter(l => l.cat === c.id && values[l.id] !== l.base).length;
      const el = document.getElementById('count-' + c.id);
      if (el) el.textContent = n ? `· ${n} changed` : '';
    });
  }

  /* ---------- charts ---------- */
  const CHARTS = [
    { key: 'gdpGrowth',   title: 'Real GDP growth',      fmt: fmt.pct,  unit: '%' },
    { key: 'unemployment',title: 'Unemployment rate',    fmt: fmt.pct,  unit: '%' },
    { key: 'inflation',   title: 'Inflation (CPI)',      fmt: fmt.pct,  unit: '%' },
    { key: 'deficit',     title: 'Federal deficit',      fmt: fmt.pct,  unit: '% of GDP' },
    { key: 'debt',        title: 'Debt held by public',  fmt: fmt.pct,  unit: '% of GDP' },
    { key: 'mortgage',    title: '30-yr mortgage rate',  fmt: fmt.pct2, unit: '%' },
    { key: 'homePrice',   title: 'Median home price',    fmt: fmt.usdK, unit: '$k' },
    { key: 'rentIndex',   title: 'Rent index',           fmt: fmt.idx,  unit: 'start = 100' },
    { key: 'realIncome',  title: 'Real median income',   fmt: fmt.usdK, unit: '$k' },
    { key: 'stockIndex',  title: 'Stock market',         fmt: fmt.idx,  unit: 'start = 100' },
    { key: 'dollarIndex', title: 'US dollar',            fmt: fmt.idx,  unit: 'start = 100' },
    { key: 'gasPrice',    title: 'Gasoline price',       fmt: fmt.usd,  unit: '$/gal' },
    { key: 'poverty',     title: 'Poverty rate',         fmt: fmt.pct,  unit: '%' },
    { key: 'gini',        title: 'Inequality (Gini ×100)', fmt: fmt.idx, unit: '' },
    { key: 'fragility',   title: 'Financial fragility',  fmt: fmt.idx,  unit: '0–100 index' },
  ];

  function buildCharts() {
    const grid = document.getElementById('charts');
    CHARTS.forEach(c => {
      const card = document.createElement('div');
      card.className = 'chart-card';
      card.innerHTML = `<h3>${c.title} <span class="chart-unit">${c.unit}</span></h3><canvas id="chart-${c.key}"></canvas>`;
      grid.appendChild(card);
    });
  }

  function drawChart(canvas, cfg) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const padL = 44, padR = 10, padT = 8, padB = 20;
    const all = cfg.mid.concat(cfg.lo, cfg.hi, cfg.base);
    let min = Math.min(...all), max = Math.max(...all);
    if (max - min < 0.6) { const m = (max + min) / 2; min = m - 0.4; max = m + 0.4; }
    const range = max - min; min -= range * 0.1; max += range * 0.1;
    const n = cfg.mid.length;
    const x = i => padL + (W - padL - padR) * (i / (n - 1));
    const yv = v => padT + (H - padT - padB) * (1 - (v - min) / (max - min));

    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,.9)';
    ctx.strokeStyle = 'rgba(148,163,184,.15)';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = min + (max - min) * i / ticks;
      const y = yv(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(cfg.tickFmt(v), padL - 5, y + 3);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      if (n > 6 && i % 2 === 1) continue;
      ctx.fillText(i === 0 ? 'now' : 'yr ' + i, x(i), H - 6);
    }

    // uncertainty band
    ctx.beginPath();
    for (let i = 0; i < n; i++) i === 0 ? ctx.moveTo(x(i), yv(cfg.hi[i])) : ctx.lineTo(x(i), yv(cfg.hi[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), yv(cfg.lo[i]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(96,165,250,.16)';
    ctx.fill();

    // baseline (do-nothing) dashed
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(148,163,184,.75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) i === 0 ? ctx.moveTo(x(i), yv(cfg.base[i])) : ctx.lineTo(x(i), yv(cfg.base[i]));
    ctx.stroke();
    ctx.setLineDash([]);

    // central path
    ctx.beginPath();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < n; i++) i === 0 ? ctx.moveTo(x(i), yv(cfg.mid[i])) : ctx.lineTo(x(i), yv(cfg.mid[i]));
    ctx.stroke();
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.arc(x(n - 1), yv(cfg.mid[n - 1]), 3, 0, 7); ctx.fill();
  }

  /* ---------- KPI cards ---------- */
  const KPIS = [
    { key: 'gdpGrowth', label: 'GDP growth (avg)', avg: true, f: fmt.pct, invert: false },
    { key: 'unemployment', label: 'Unemployment', f: fmt.pct, invert: true },
    { key: 'inflation', label: 'Inflation', f: fmt.pct, invert: true },
    { key: 'deficit', label: 'Deficit / GDP', f: fmt.pct, invert: true },
    { key: 'debt', label: 'Debt / GDP', f: fmt.pct, invert: true },
    { key: 'realIncome', label: 'Median income', f: fmt.usdK, invert: false, unit: 'k' },
    { key: 'homePrice', label: 'Median home', f: fmt.usdK, invert: null, unit: 'k' },
    { key: 'stockIndex', label: 'Stocks', f: fmt.idx, invert: false },
    { key: 'poverty', label: 'Poverty', f: fmt.pct, invert: true },
    { key: 'fragility', label: 'Fragility', f: fmt.idx, invert: true },
  ];

  function renderKpis(mid, base) {
    const el = document.getElementById('kpis');
    el.innerHTML = KPIS.map(k => {
      let v, bv;
      if (k.avg) {
        v = mid[k.key].slice(1).reduce((a, b) => a + b, 0) / (mid[k.key].length - 1);
        bv = base[k.key].slice(1).reduce((a, b) => a + b, 0) / (base[k.key].length - 1);
      } else {
        v = mid[k.key][mid[k.key].length - 1];
        bv = base[k.key][base[k.key].length - 1];
      }
      const d = k.invert === null
        ? `<span class="delta neutral">${(v - bv >= 0 ? '+' : '−') + (k.unit === 'k' ? '$' + Math.abs(Math.round((v - bv) * 1000)).toLocaleString() : Math.abs(v - bv).toFixed(1))}</span>`
        : delta(v, bv, k.unit === 'k' ? 'k' : '%', k.invert);
      return `<div class="kpi"><div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${k.f(v)}</div>
        <div class="kpi-delta">${d} vs baseline</div></div>`;
    }).join('');
  }

  /* ---------- grade & narrative ---------- */
  function computeGrade(mid, base) {
    const last = a => a[a.length - 1];
    const incomeG = (last(mid.realIncome) / mid.realIncome[0] - 1) * 100 / horizon;
    const baseIncomeG = (last(base.realIncome) / base.realIncome[0] - 1) * 100 / horizon;
    let score = 55;
    score += (incomeG - baseIncomeG) * 14;
    score -= Math.max(0, last(mid.unemployment) - 4.5) * 6;
    score -= Math.max(0, last(mid.inflation) - 3) * 4.5;
    score += Math.max(0, 2.5 - last(mid.inflation)) * -1; // deflation not rewarded
    score -= Math.max(0, last(mid.inflation) < 0 ? -last(mid.inflation) * 5 : 0);
    score -= (last(mid.poverty) - last(base.poverty)) * 4;
    score -= Math.max(0, last(mid.debt) - last(base.debt)) * 0.35;
    score -= Math.max(0, last(mid.fragility) - 50) * 0.45;
    score += Math.max(0, (last(base.homePrice) - last(mid.homePrice)) / base.homePrice[0]) * 25; // affordability
    score = Math.max(0, Math.min(100, score));
    const grades = [[92,'A+'],[85,'A'],[78,'A-'],[71,'B+'],[64,'B'],[57,'B-'],[50,'C+'],[43,'C'],[36,'C-'],[28,'D'],[0,'F']];
    const g = grades.find(x => score >= x[0]);
    return { score: Math.round(score), grade: g[1] };
  }

  function narrative(mid, base) {
    const last = a => a[a.length - 1];
    const p = [];
    const yrs = horizon === 1 ? 'one year' : horizon + ' years';
    const dIncome = last(mid.realIncome) - last(base.realIncome);
    const dU = last(mid.unemployment) - last(base.unemployment);
    const dInfl = last(mid.inflation) - last(base.inflation);
    const dDebt = last(mid.debt) - last(base.debt);
    const dHome = (last(mid.homePrice) - last(base.homePrice)) / last(base.homePrice) * 100;
    const dPov = last(mid.poverty) - last(base.poverty);

    const changed = LEVERS.filter(l => values[l.id] !== l.base).length;
    if (!changed) {
      return `<p>You changed nothing. After ${yrs}, the economy drifts along its baseline: growth near 2%, unemployment near 4%, inflation settling toward 2%, and debt grinding upward on autopilot. History will remember you as… fine.</p>`;
    }

    p.push(`After ${yrs} of your presidency (central estimate): real median income is <strong>${dIncome >= 0 ? 'up' : 'down'} $${Math.abs(Math.round(dIncome * 1000)).toLocaleString()}</strong> vs. doing nothing, unemployment is <strong>${last(mid.unemployment).toFixed(1)}%</strong> (${dU >= 0 ? '+' : ''}${dU.toFixed(1)}pp vs. baseline), and inflation is running at <strong>${last(mid.inflation).toFixed(1)}%</strong>.`);

    if (last(mid.inflation) > 15) p.push(`⚠️ You have an <strong>inflation emergency</strong> — at ${last(mid.inflation).toFixed(0)}%, prices are doubling every ${Math.max(1, Math.round(72 / last(mid.inflation)))} years and the dollar is in retreat. This is the well-documented endgame of the choices you made on money.`);
    else if (last(mid.inflation) > 6) p.push(`⚠️ Inflation at ${last(mid.inflation).toFixed(1)}% is eating wage gains; expect it to dominate the midterms.`);
    if (last(mid.inflation) < 0) p.push(`⚠️ Prices are falling — deflation raises real debt burdens and historically accompanies weak demand.`);
    if (last(mid.unemployment) > 7) p.push(`⚠️ Unemployment at ${last(mid.unemployment).toFixed(1)}% means roughly ${(Math.round((last(mid.unemployment) - 4.2) * 1.7))} million more people out of work than when you took office.`);
    if (last(mid.fragility) > 65) p.push(`⚠️ The financial system is <strong>flashing red</strong> (fragility ${Math.round(last(mid.fragility))}/100). The model prices this as higher borrowing spreads and a growth drag — in the real world it shows up suddenly, as a crisis.`);
    if (dDebt > 8) p.push(`Debt is on a visibly steeper path (+${dDebt.toFixed(0)}pp of GDP vs. baseline) — bond markets noticed, and long rates with them.`);
    if (dDebt < -4) p.push(`You bent the debt curve down (${dDebt.toFixed(0)}pp of GDP vs. baseline), which eased long-term interest rates.`);
    if (Math.abs(dHome) > 2) p.push(`Housing: the median home is ${Math.abs(dHome).toFixed(0)}% ${dHome > 0 ? 'more' : 'less'} expensive than it would have been — ${dHome > 0 ? 'sellers cheer, first-time buyers do not' : 'a win for buyers, felt as lost wealth by owners'}.`);
    if (dPov < -0.5) p.push(`Poverty is ${Math.abs(dPov).toFixed(1)}pp lower than baseline — roughly ${(Math.abs(dPov) * 3.4).toFixed(1)} million people.`);
    if (dPov > 0.5) p.push(`Poverty is ${dPov.toFixed(1)}pp higher than baseline — roughly ${(dPov * 3.4).toFixed(1)} million more people below the line.`);

    const drivers = topDrivers(values, 5);
    if (drivers.length) {
      p.push(`<strong>Biggest forces in your economy:</strong> ` + drivers.map(d =>
        `${d.lever.name} (${fmtVal(d.lever, values[d.lever.id])})`).join(' · '));
    }
    return p.map(s => `<p>${s}</p>`).join('');
  }

  /* ---------- schools-of-thought leaderboard ---------- */
  const LB_COLS = [
    { key: 'score',   label: 'Verdict',          better: 'high',   fmt: r => `<span class="grade-cell ${r.score >= 64 ? 'g-good' : r.score >= 43 ? 'g-mid' : 'g-bad'}">${r.grade}</span> <span style="color:var(--muted)">${r.score}</span>` },
    { key: 'growth',  label: 'GDP growth (avg)', better: 'high',   fmt: r => r.growth.toFixed(1) + '%' },
    { key: 'unemp',   label: 'Unemployment',     better: 'low',    fmt: r => r.unemp.toFixed(1) + '%' },
    { key: 'infl',    label: 'Inflation',        better: 'target', fmt: r => r.infl.toFixed(1) + '%' },
    { key: 'income',  label: 'Real income Δ',    better: 'high',   fmt: r => (r.income >= 0 ? '+$' : '−$') + Math.abs(Math.round(r.income)).toLocaleString() },
    { key: 'poverty', label: 'Poverty',          better: 'low',    fmt: r => r.poverty.toFixed(1) + '%' },
    { key: 'debt',    label: 'Debt / GDP',       better: 'low',    fmt: r => r.debt.toFixed(0) + '%' },
  ];
  let lbSort = { key: 'score', dir: -1 };
  let schoolCache = { horizon: -1, rows: null };

  function metricsFrom(sim, base) {
    const last = a => a[a.length - 1];
    const g = computeGrade(sim, base);
    return {
      score: g.score, grade: g.grade,
      growth: sim.gdpGrowth.slice(1).reduce((a, b) => a + b, 0) / (sim.gdpGrowth.length - 1),
      unemp: last(sim.unemployment),
      infl: last(sim.inflation),
      income: (last(sim.realIncome) - sim.realIncome[0]) * 1000,
      poverty: last(sim.poverty),
      debt: last(sim.debt),
    };
  }

  function sortVal(row, col) {
    return col.better === 'target' ? Math.abs(row.infl - 2) : row[col.key];
  }

  function renderLeaderboard(youMid, base) {
    if (schoolCache.horizon !== horizon) {
      schoolCache.rows = SCHOOLS.map(s => {
        const sv = {};
        LEVERS.forEach(l => { sv[l.id] = l.base; });
        Object.assign(sv, s.values);
        return { school: s, ...metricsFrom(simulate(sv, horizon, 1), base) };
      });
      schoolCache.horizon = horizon;
    }
    const changedCount = LEVERS.filter(l => values[l.id] !== l.base).length;
    const youRow = {
      school: { id: '__you', name: 'You', icon: '🫵', blurb: changedCount ? `Your current sliders (${changedCount} lever${changedCount > 1 ? 's' : ''} changed).` : 'Your current sliders — identical to Status Quo until you change something.' },
      ...metricsFrom(youMid, base), you: true,
    };
    const rows = schoolCache.rows.concat([youRow]);
    const col = LB_COLS.find(c => c.key === lbSort.key) || LB_COLS[0];
    rows.sort((a, b) => (sortVal(a, col) - sortVal(b, col)) * lbSort.dir);

    const best = {};
    LB_COLS.forEach(c => {
      const dir = c.better === 'high' ? -1 : 1;
      best[c.key] = rows.slice().sort((a, b) => (sortVal(a, c) - sortVal(b, c)) * dir)[0];
    });

    const table = document.getElementById('lb');
    table.innerHTML = `<thead><tr><th>#</th><th>School</th>${LB_COLS.map(c =>
      `<th data-key="${c.key}" class="${c.key === lbSort.key ? 'sorted' : ''}" title="Click to sort">${c.label}${c.key === lbSort.key ? (lbSort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, i) => `
        <tr class="${r.you ? 'you' : ''}" data-school="${r.school.id}" ${r.you ? '' : 'title="Click to load this school\'s full platform"'}>
          <td>${i + 1}</td>
          <td><span class="lb-school">${r.school.icon} ${r.school.name}</span><span class="lb-blurb">${r.school.blurb}</span></td>
          ${LB_COLS.map(c => `<td class="${best[c.key] === r ? 'best' : ''}">${c.fmt(r)}</td>`).join('')}
        </tr>`).join('')}</tbody>`;
  }

  function initLeaderboard() {
    const table = document.getElementById('lb');
    table.addEventListener('click', e => {
      const th = e.target.closest('th[data-key]');
      if (th) {
        const col = LB_COLS.find(c => c.key === th.dataset.key);
        if (lbSort.key === col.key) lbSort.dir *= -1;
        else lbSort = { key: col.key, dir: col.better === 'high' ? -1 : 1 };
        scheduleRun();
        return;
      }
      const tr = e.target.closest('tr[data-school]');
      if (!tr || tr.dataset.school === '__you') return;
      const school = SCHOOLS.find(s => s.id === tr.dataset.school);
      if (!school) return;
      LEVERS.forEach(l => { values[l.id] = l.base; });
      Object.assign(values, school.values);
      document.getElementById('presets').value = 'reset';
      scheduleRun();
    });
  }

  /* ---------- run & render ---------- */
  let baseCache = null, baseCacheYears = -1, rafId = null;

  function scheduleRun() {
    refreshSidebar();
    saveHash();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(run);
  }

  function run() {
    rafId = null;
    if (baseCacheYears !== horizon) {
      const bv = {};
      LEVERS.forEach(l => { bv[l.id] = l.base; });
      baseCache = simulate(bv, horizon, 1);
      baseCacheYears = horizon;
      schoolCache.horizon = -1; // horizon changed: recompute school runs
    }
    const { mid, band } = runAll(values, horizon);
    renderKpis(mid, baseCache);
    renderLeaderboard(mid, baseCache);
    const g = computeGrade(mid, baseCache);
    const gradeEl = document.getElementById('grade');
    gradeEl.textContent = g.grade;
    gradeEl.className = 'grade ' + (g.score >= 64 ? 'g-good' : g.score >= 43 ? 'g-mid' : 'g-bad');
    document.getElementById('grade-score').textContent = g.score + '/100';
    document.getElementById('narrative').innerHTML = narrative(mid, baseCache);
    CHARTS.forEach(c => {
      drawChart(document.getElementById('chart-' + c.key), {
        mid: mid[c.key], lo: band[c.key].lo, hi: band[c.key].hi,
        base: baseCache[c.key], tickFmt: c.fmt,
      });
    });
  }

  /* ---------- controls ---------- */
  function buildControls() {
    const yearsEl = document.getElementById('years');
    [1, 2, 3, 4, 6, 8, 10].forEach(y => {
      const b = document.createElement('button');
      b.textContent = y;
      b.className = 'yr-btn' + (y === horizon ? ' active' : '');
      b.onclick = () => {
        horizon = y;
        document.querySelectorAll('.yr-btn').forEach(x => x.classList.toggle('active', +x.textContent === y));
        scheduleRun();
      };
      yearsEl.appendChild(b);
    });

    const presetEl = document.getElementById('presets');
    for (const key in PRESETS) {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = PRESETS[key].name;
      presetEl.appendChild(opt);
    }
    presetEl.onchange = () => {
      const p = PRESETS[presetEl.value];
      if (!p) return;
      LEVERS.forEach(l => { values[l.id] = l.base; });
      Object.assign(values, p.values);
      scheduleRun();
    };

    document.getElementById('reset').onclick = () => {
      LEVERS.forEach(l => { values[l.id] = l.base; });
      presetEl.value = 'reset';
      scheduleRun();
    };

    document.getElementById('share').onclick = () => {
      saveHash();
      navigator.clipboard.writeText(location.href).then(() => {
        const btn = document.getElementById('share');
        const old = btn.textContent;
        btn.textContent = '✓ Link copied';
        setTimeout(() => { btn.textContent = old; }, 1500);
      });
    };

    const modal = document.getElementById('method-modal');
    document.getElementById('method-btn').onclick = () => modal.showModal();
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    window.addEventListener('resize', () => scheduleRun());
    document.querySelectorAll('.yr-btn').forEach(x => x.classList.toggle('active', +x.textContent === horizon));
  }

  /* ---------- init ---------- */
  loadHash();
  buildSidebar();
  buildCharts();
  buildControls();
  initLeaderboard();
  scheduleRun();
})();
