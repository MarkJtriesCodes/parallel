/* ============================================================
   MAKE ME PRESIDENT — simulation engine
   ------------------------------------------------------------
   Annual model, up to 10 years. Core mechanisms, all standard:
   - Okun's law (unemployment ↔ output gap, coefficient ≈ 0.45)
   - Expectations-augmented Phillips curve (slope ≈ 0.3)
   - Taylor-rule Fed reaction when the Fed is independent
   - CBO-style fiscal multipliers, larger with slack, offset by Fed
   - Debt dynamics: d' = d·(r−g) + primary deficit
   - Laubach-style crowding out (~2.5bp on 10-yr per pp of debt/GDP)
   For each run the engine is evaluated 3x — with every lever's
   [small, central, large] effect sizes — and the band shown is
   the min/max envelope across the three.
   ============================================================ */

const BASELINE = {
  potentialGrowth: 2.0,   // % — CBO estimate of potential real GDP growth
  gap: 0.0,               // % output gap
  inflation: 2.7,         // % CPI
  expected: 2.4,          // % anchored expectations
  fedFunds: 4.0,          // %
  tenYear: 4.3,           // %
  avgDebtRate: 3.4,       // % average rate on outstanding debt
  mortgage: 6.4,          // % 30-yr fixed (Freddie Mac PMMS ballpark)
  unemployment: 4.2,      // % (BLS)
  naturalU: 4.2,
  debt: 100,              // % GDP, debt held by public (CBO)
  primaryDeficit: 3.0,    // % GDP (total ≈ 6.3 incl. interest)
  homePrice: 420,         // $k median existing home (NAR ballpark)
  rentIndex: 100,
  stockIndex: 100,
  dollarIndex: 100,
  gasPrice: 3.15,         // $/gal (EIA ballpark)
  realIncome: 83,         // $k real median household income (Census)
  poverty: 11.0,          // % official rate
  gini: 48.0,             // Gini x100
  fragility: 25,          // 0-100 heuristic index
};

/* phase-in profiles: fraction of total effect present in year y (1-indexed) */
const PROFILES = {
  ramp2: [0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ramp4: [0.25, 0.5, 0.75, 1, 1, 1, 1, 1, 1, 1],
  ramp8: [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1, 1],
  pulse: [0.5, 0.85, 1, 1, 1, 1, 1, 1, 1, 1],       // cumulative for one-time level effects
  pulseFast: [0.7, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

const CHANNEL_PROFILE = {
  demand: 'flat', supply: 'ramp4', supplySlow: 'ramp8', infl: 'pulse',
  deficit: 'flat', laborForce: 'flat', structUnemp: 'ramp2', wages: 'pulse',
  housingSupply: 'ramp2', housingDemand: 'pulse', rentDirect: 'pulse',
  mortgageSpread: 'flat', creditSpread: 'flat', stockLevel: 'pulseFast',
  dollarLevel: 'pulseFast', energy: 'pulseFast', poverty: 'ramp2',
  ineq: 'ramp2', frag: 'ramp2',
};

function cumChannel(totals, ch, y) {
  const prof = PROFILES[CHANNEL_PROFILE[ch] || 'flat'];
  return (totals[ch] || 0) * prof[Math.min(y, prof.length) - 1];
}

/* Aggregate all levers' channel totals for effect-size index b (0/1/2) */
function aggregateChannels(values, b) {
  const totals = {};
  for (const lever of LEVERS) {
    if (lever.needs) {
      let ok = true;
      for (const k in lever.needs) if (values[k] !== lever.needs[k]) ok = false;
      if (!ok) continue;
    }
    const fx = lever.fx(values[lever.id]);
    for (const ch in fx) {
      totals[ch] = (totals[ch] || 0) + fx[ch][b];
    }
  }
  return totals;
}

function simulate(values, years, b) {
  const T = aggregateChannels(values, b);
  const s = { ...BASELINE };
  const fedIndependent = values.fedIndep >= 1;
  const target = fedIndependent ? values.inflTarget : 2;
  const qe = values.qe || 0;

  const out = { years: [0] };
  const series = ['gdpGrowth','unemployment','inflation','fedFunds','tenYear','mortgage',
    'deficit','debt','homePrice','rentIndex','stockIndex','dollarIndex','gasPrice',
    'realIncome','poverty','gini','fragility'];
  for (const k of series) out[k] = [];
  out.gdpGrowth.push(2.0); out.unemployment.push(s.unemployment);
  out.inflation.push(s.inflation); out.fedFunds.push(s.fedFunds);
  out.tenYear.push(s.tenYear); out.mortgage.push(s.mortgage);
  out.deficit.push(s.primaryDeficit + s.avgDebtRate * s.debt / 100);
  out.debt.push(s.debt); out.homePrice.push(s.homePrice);
  out.rentIndex.push(s.rentIndex); out.stockIndex.push(s.stockIndex);
  out.dollarIndex.push(s.dollarIndex); out.gasPrice.push(s.gasPrice);
  out.realIncome.push(s.realIncome); out.poverty.push(s.poverty);
  out.gini.push(s.gini); out.fragility.push(s.fragility);

  let prevDemandContrib = 0, prevRateGap = 0, prevSupplyCum = 0, prevInflCum = 0;
  let prevWageCum = 0, prevHDCum = 0, prevRentCum = 0, prevStockCum = 0;
  let prevDollarCum = 0, prevEnergyCum = 0, expected = s.expected;
  let exchRateDrift = 0;

  for (let y = 1; y <= years; y++) {
    out.years.push(y);

    /* --- fragility (computed early: feeds spreads & growth) --- */
    let frag = BASELINE.fragility + cumChannel(T, 'frag', y)
      + Math.max(0, s.debt - 120) * 0.25
      + Math.max(0, s.inflation - 5) * 2;
    if (!fedIndependent) frag += 5;
    frag = Math.max(0, Math.min(100, frag));
    const fragPremium = Math.max(0, frag - 55) * 0.03;   // pp added to spreads
    const fragDrag = Math.max(0, frag - 55) * 0.045;     // pp off growth

    /* --- potential output --- */
    const laborFlow = cumChannel(T, 'laborForce', y);    // % LF added this year
    const supplyCum = cumChannel(T, 'supply', y) + cumChannel(T, 'supplySlow', y);
    const supplyContrib = supplyCum - prevSupplyCum;
    prevSupplyCum = supplyCum;
    const potential = BASELINE.potentialGrowth + supplyContrib + 0.65 * laborFlow;

    /* --- demand impulse (multiplier depends on slack & Fed offset) --- */
    const D = cumChannel(T, 'demand', y);
    let mult = Math.max(0.5, Math.min(1.5, 0.7 + Math.max(0, -s.gap) * 0.25));
    if (fedIndependent && s.inflation > target + 0.7) mult *= 0.65;  // Fed leans against
    const demandContrib = (y === 1 ? D * mult : 0.25 * prevDemandContrib);
    prevDemandContrib = y === 1 ? D * mult : prevDemandContrib * 0.25;

    /* --- monetary stance effect (from last year's gap between Taylor & actual) --- */
    const monetaryContrib = 0.30 * prevRateGap;

    /* --- growth, gap, unemployment --- */
    const highInflDrag = Math.max(0, s.inflation - 5) * 0.08;
    let gdpGrowth = potential + demandContrib + monetaryContrib - fragDrag - highInflDrag;
    s.gap = 0.72 * s.gap + demandContrib + monetaryContrib - fragDrag - highInflDrag;
    const structU = cumChannel(T, 'structUnemp', y);
    let u = BASELINE.naturalU + structU - 0.45 * s.gap + Math.max(0, -laborFlow) * 0.15;
    u = Math.max(2.0, Math.min(25, u));

    /* --- inflation --- */
    const inflDirect = cumChannel(T, 'infl', y) - prevInflCum;
    prevInflCum = cumChannel(T, 'infl', y);
    // monetized deficits keep pushing prices every year, not just at first
    const monetizePersist = (values.monetize || 0) * (b === 0 ? 0.04 : b === 1 ? 0.08 : 0.15);
    const energyCum = cumChannel(T, 'energy', y);
    const energyPush = (energyCum - prevEnergyCum) * 0.035;
    prevEnergyCum = energyCum;
    const dollarCum = cumChannel(T, 'dollarLevel', y);
    const dollarPush = -(dollarCum - prevDollarCum) * 0.03;
    prevDollarCum = dollarCum;

    let infl = 0.55 * s.inflation + 0.45 * expected + 0.30 * s.gap
      + inflDirect + (y > 1 ? monetizePersist : 0) + energyPush + dollarPush;
    infl = Math.max(-3, Math.min(60, infl));

    /* expectations: anchored under independence, adaptive without it */
    const anchor = fedIndependent ? 0.15 : 0.45;
    expected = (1 - anchor) * ((1 - 0.15) * expected + 0.15 * target) + anchor * infl;
    if (fedIndependent) expected = 0.85 * expected + 0.15 * target;

    /* --- policy rate --- */
    const taylor = Math.max(0, 1.0 + infl + 0.5 * (infl - target) + 0.5 * s.gap);
    let ff;
    if (fedIndependent) {
      ff = s.fedFunds + 0.6 * (taylor - s.fedFunds);
    } else {
      ff = values.ffOverride;
    }
    ff = Math.max(0, Math.min(30, ff));
    prevRateGap = Math.max(-4, Math.min(4, taylor - ff)) * (fedIndependent ? 0.15 : 1.0);
    // under independence the Fed tracks Taylor so the residual gap barely stimulates

    /* --- long rates, mortgage --- */
    const qeAdj = -qe * (b === 0 ? 0.15 : b === 1 ? 0.25 : 0.40);
    const tenYear = Math.max(0.3,
      0.60 * ff + 1.55 + 0.025 * (s.debt - 100) + 0.35 * Math.max(0, expected - 2)
      + qeAdj + fragPremium + cumChannel(T, 'creditSpread', y) * 0.3);
    const mortgage = Math.max(1,
      tenYear + 1.7 + cumChannel(T, 'mortgageSpread', y) + cumChannel(T, 'creditSpread', y) * 0.4
      + fragPremium * 0.5);

    /* --- fiscal --- */
    const cyclical = 0.4 * (u - 4.2) - 0.15 * s.gap;
    const primary = BASELINE.primaryDeficit + cumChannel(T, 'deficit', y) + cyclical;
    s.avgDebtRate += 0.20 * (tenYear - s.avgDebtRate);
    const interest = s.avgDebtRate * s.debt / 100;
    const deficit = primary + interest;
    const nominalG = gdpGrowth + infl;
    s.debt = Math.max(0, s.debt * (1 + (s.avgDebtRate - nominalG) / 100) + primary);

    /* --- housing --- */
    const supplyFlow = cumChannel(T, 'housingSupply', y);   // % of stock per yr
    const hdCum = cumChannel(T, 'housingDemand', y);
    const hdPush = hdCum - prevHDCum; prevHDCum = hdCum;
    let hpGrowth = 1.2 + infl + 0.5 * Math.max(-2, gdpGrowth - 2)
      - 2.2 * Math.max(-3, Math.min(3, (mortgage - BASELINE.mortgage))) * 0.45
      - supplyFlow * 7 + hdPush;
    s.homePrice = Math.max(50, s.homePrice * (1 + hpGrowth / 100));

    const rentCum = cumChannel(T, 'rentDirect', y);
    const rentPush = rentCum - prevRentCum; prevRentCum = rentCum;
    let rentGrowth = 0.8 + infl - supplyFlow * 5.5 + rentPush + 0.3 * hdPush * 0.2
      + Math.max(0, -laborFlow) * 0.0;
    s.rentIndex = s.rentIndex * (1 + rentGrowth / 100);

    /* --- markets --- */
    const stockCum = cumChannel(T, 'stockLevel', y);
    const stockPush = stockCum - prevStockCum; prevStockCum = stockCum;
    let stockGrowth = 6 + 1.8 * (gdpGrowth - 2) - 3.0 * (tenYear - out.tenYear[y - 1])
      + stockPush - Math.max(0, frag - 60) * 0.5 - Math.max(0, infl - 5) * 1.2;
    s.stockIndex = Math.max(5, s.stockIndex * (1 + stockGrowth / 100));

    const dollarPushLvl = dollarCum - (y === 1 ? 0 : cumChannel(T, 'dollarLevel', y - 1));
    exchRateDrift = 0.6 * (ff - 4) * 0.4 - Math.max(0, infl - 3) * 0.8 - Math.max(0, frag - 60) * 0.15;
    s.dollarIndex = Math.max(20, s.dollarIndex * (1 + (dollarPushLvl + exchRateDrift) / 100));

    const energyPushLvl = energyCum - (y === 1 ? 0 : cumChannel(T, 'energy', y - 1));
    s.gasPrice = Math.max(0.5, s.gasPrice * (1 + (energyPushLvl + infl * 0.4) / 100) );

    /* --- households --- */
    const wageCum = cumChannel(T, 'wages', y);
    const wagePush = wageCum - prevWageCum; prevWageCum = wageCum;
    const realIncGrowth = 0.7 * (gdpGrowth - 0.5) + wagePush
      - 0.30 * Math.max(0, infl - 3.5) - 0.5 * Math.max(0, u - out.unemployment[y - 1]);
    s.realIncome = Math.max(20, s.realIncome * (1 + realIncGrowth / 100));

    let poverty = BASELINE.poverty + cumChannel(T, 'poverty', y)
      + 0.45 * (u - 4.2) + 0.25 * Math.max(0, infl - 4);
    poverty = Math.max(3, Math.min(40, poverty));

    let gini = BASELINE.gini + cumChannel(T, 'ineq', y) + 0.20 * (u - 4.2)
      + 0.010 * (s.stockIndex - 100 - 6 * y);
    gini = Math.max(30, Math.min(65, gini));

    /* --- record --- */
    s.inflation = infl; s.fedFunds = ff; s.tenYear = tenYear; s.mortgage = mortgage;
    out.gdpGrowth.push(round2(gdpGrowth));
    out.unemployment.push(round2(u));
    out.inflation.push(round2(infl));
    out.fedFunds.push(round2(ff));
    out.tenYear.push(round2(tenYear));
    out.mortgage.push(round2(mortgage));
    out.deficit.push(round2(deficit));
    out.debt.push(round2(s.debt));
    out.homePrice.push(round2(s.homePrice));
    out.rentIndex.push(round2(s.rentIndex));
    out.stockIndex.push(round2(s.stockIndex));
    out.dollarIndex.push(round2(s.dollarIndex));
    out.gasPrice.push(round2(s.gasPrice));
    out.realIncome.push(round2(s.realIncome));
    out.poverty.push(round2(poverty));
    out.gini.push(round2(gini));
    out.fragility.push(round2(frag));
  }
  return out;
}

function round2(x) { return Math.round(x * 100) / 100; }

/* Run small/central/large effect sizes; return central + envelope band */
function runAll(values, years) {
  const runs = [simulate(values, years, 0), simulate(values, years, 1), simulate(values, years, 2)];
  const mid = runs[1];
  const band = {};
  for (const k in mid) {
    if (k === 'years') continue;
    band[k] = { lo: [], hi: [] };
    for (let i = 0; i < mid[k].length; i++) {
      band[k].lo.push(Math.min(runs[0][k][i], runs[1][k][i], runs[2][k][i]));
      band[k].hi.push(Math.max(runs[0][k][i], runs[1][k][i], runs[2][k][i]));
    }
  }
  return { mid, band };
}

/* Rank levers by how much they're driving the current scenario */
const DRIVER_WEIGHTS = {
  demand: 0.9, supply: 1.3, supplySlow: 0.6, infl: 0.8, deficit: 0.55,
  laborForce: 1.6, structUnemp: 1.1, wages: 0.7, housingSupply: 4.0,
  housingDemand: 0.25, rentDirect: 0.3, mortgageSpread: 0.6, creditSpread: 0.6,
  stockLevel: 0.12, dollarLevel: 0.15, energy: 0.08, poverty: 0.7, ineq: 0.35, frag: 0.09,
};

function topDrivers(values, n) {
  const scored = [];
  for (const lever of LEVERS) {
    if (values[lever.id] === lever.base) continue;
    if (lever.needs) {
      let ok = true;
      for (const k in lever.needs) if (values[k] !== lever.needs[k]) ok = false;
      if (!ok) continue;
    }
    const fx = lever.fx(values[lever.id]);
    let score = 0;
    for (const ch in fx) score += Math.abs(fx[ch][1]) * (DRIVER_WEIGHTS[ch] || 0.5);
    if (lever.id === 'fedIndep' && values.fedIndep === 0) score += 1.5;
    if (lever.id === 'monetize' && values.monetize > 0) score += values.monetize * 0.05;
    if (score > 0.01) scored.push({ lever, score });
  }
  scored.sort((a, b2) => b2.score - a.score);
  return scored.slice(0, n);
}
