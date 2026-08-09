/* ============================================================
   MAKE ME PRESIDENT — policy lever definitions
   ------------------------------------------------------------
   Every lever maps a policy dial to effects on model "channels".
   Effect sizes are triples [small, central, large] drawn from
   empirical literature (cited per lever). Signs:
     demand        pp of GDP demand impulse (level, sustained)
     supply        pp change to potential GDP level (4-yr phase-in)
     supplySlow    pp change to potential GDP level (8-yr phase-in)
     infl          pp one-time price-level effect (spread over ~2y)
     deficit       change in primary deficit, % of GDP (+ = larger deficit)
     laborForce    % change to labor force PER YEAR (flow)
     structUnemp   pp change to structural unemployment
     wages         pp direct real wage growth (front-loaded)
     housingSupply extra housing completions, % of stock PER YEAR
     housingDemand pp one-time home-price effect
     rentDirect    pp one-time rent effect
     mortgageSpread / creditSpread   pp change to spreads
     stockLevel    % one-time equity price effect
     dollarLevel   % one-time dollar effect
     energy        % one-time gasoline price effect
     poverty       pp change to poverty rate
     ineq          change to Gini x100 (level)
     frag          points on 0-100 financial-fragility index
   ============================================================ */

function mul(d, lo, mid, hi) { return [d * lo, d * mid, d * hi]; }
function t(lo, mid, hi) { return [lo, mid, hi]; }

const CATEGORIES = [
  { id: 'tax',   name: 'Taxes & Tariffs',        icon: '🏛️' },
  { id: 'spend', name: 'Federal Spending',        icon: '💰' },
  { id: 'money', name: 'Money & the Fed',         icon: '🏦' },
  { id: 'labor', name: 'Labor & Immigration',     icon: '👷' },
  { id: 'house', name: 'Housing & Real Estate',   icon: '🏘️' },
  { id: 'bank',  name: 'Banking & Finance',       icon: '💳' },
  { id: 'trade', name: 'Trade & Industry',        icon: '🚢' },
  { id: 'energy',name: 'Energy & Regulation',     icon: '⚡' },
];

const LEVERS = [
  /* ---------------- TAXES & TARIFFS ---------------- */
  {
    id: 'topRate', cat: 'tax', name: 'Top income tax rate', unit: '%',
    min: 25, max: 70, step: 1, base: 37,
    desc: 'Top federal marginal rate on individual income (baseline 37%).',
    evidence: 'Elasticity of taxable income for top earners ≈ 0.2–0.4 (Saez, Slemrod & Giertz 2012). CBO: +10pp on top brackets raises roughly $70–120B/yr after behavioral response. Little robust evidence of large short-run growth effects either way at US rates (Piketty-Saez-Stantcheva 2014 vs. Mertens-Olea 2018).',
    fx(v) { const d = v - 37; return {
      deficit: mul(d, -0.020, -0.030, -0.040),
      demand:  mul(d, -0.005, -0.010, -0.020),
      supply:  mul(d,  0.000, -0.010, -0.025),
      ineq:    mul(d, -0.030, -0.050, -0.080),
    };}
  },
  {
    id: 'corpRate', cat: 'tax', name: 'Corporate tax rate', unit: '%',
    min: 10, max: 40, step: 1, base: 21,
    desc: 'Federal statutory corporate income tax rate (baseline 21%).',
    evidence: 'The 2017 TCJA cut (35→21%) raised investment modestly; long-run GDP effect scored ≈ +0.5–1% for 14pp (CBO, JCT; Chodorow-Reich et al. 2024 find domestic capital +7%, but revenue cost large). Each pp ≈ $25B/yr revenue. Cuts flow substantially to shareholders (≈50-80%).',
    fx(v) { const d = v - 21; return {
      deficit:    mul(d, -0.050, -0.070, -0.090),
      supply:     mul(d, -0.020, -0.045, -0.080),
      stockLevel: mul(d, -0.400, -0.700, -1.000),
      ineq:       mul(d, -0.015, -0.030, -0.050),
    };}
  },
  {
    id: 'capGains', cat: 'tax', name: 'Capital gains tax rate', unit: '%',
    min: 0, max: 45, step: 1, base: 20,
    desc: 'Top federal long-term capital-gains rate (baseline 20% + 3.8% NIIT).',
    evidence: 'Realizations are highly elastic short-run; CBO/JCT assume revenue-maximizing rate ≈ 28–32% — above that, revenue can fall. Growth effects small at US rates. Raising toward ~30% raises modest revenue; the model flattens gains beyond that.',
    fx(v) { const d = v - 20; const eff = v <= 30 ? d : (10 - 0.4 * (v - 30)); return {
      deficit:    mul(eff, -0.008, -0.014, -0.020),
      supply:     mul(d,    0.000, -0.005, -0.012),
      stockLevel: mul(d,   -0.050, -0.120, -0.250),
      ineq:       mul(d,   -0.020, -0.040, -0.060),
    };}
  },
  {
    id: 'payroll', cat: 'tax', name: 'Payroll tax rate (combined)', unit: '%',
    min: 10, max: 20, step: 0.5, base: 15.3,
    desc: 'Combined employer+employee Social Security & Medicare rate (baseline 15.3%).',
    evidence: 'Broadest federal tax: 1pp ≈ $90–110B/yr. Falls mostly on workers via wages (CBO incidence assumption). Cuts deliver fast stimulus (2011-12 payroll holiday: MPC ≈ 0.3–0.9, Parker et al. 2013); hikes drag demand quickly.',
    fx(v) { const d = v - 15.3; return {
      deficit: mul(d, -0.250, -0.300, -0.350),
      demand:  mul(d, -0.150, -0.250, -0.350),
      wages:   mul(d, -0.100, -0.150, -0.200),
    };}
  },
  {
    id: 'middleTax', cat: 'tax', name: 'Middle-class income tax', unit: 'pp',
    min: -5, max: 5, step: 0.5, base: 0,
    desc: 'Change in average effective income-tax rate for households under $400k (pp of income).',
    evidence: 'Broad-based income tax changes have demand multipliers ≈ 0.3–1.5 depending on slack (CBO 2015; Romer & Romer 2010 find tax multipliers up to ~2-3 over 3 years). 1pp ≈ $110–130B/yr.',
    fx(v) { return {
      deficit: mul(v, -0.300, -0.400, -0.500),
      demand:  mul(v, -0.250, -0.400, -0.600),
      poverty: mul(v,  0.020,  0.050,  0.080),
    };}
  },
  {
    id: 'estate', cat: 'tax', name: 'Estate tax top rate', unit: '%',
    min: 0, max: 65, step: 5, base: 40,
    desc: 'Top estate-tax rate (baseline 40%, exemption ≈ $14M).',
    evidence: 'Raises only ~$25–35B/yr at current exemptions — macro effects are tiny. Main measured effect is long-run wealth concentration (Piketty & Saez). Repeal ≈ +0.1% of GDP to deficits.',
    fx(v) { const d = v - 40; return {
      deficit: mul(d, -0.001, -0.002, -0.003),
      ineq:    mul(d, -0.005, -0.010, -0.020),
    };}
  },
  {
    id: 'carbon', cat: 'tax', name: 'Carbon tax', unit: '$/ton',
    min: 0, max: 100, step: 5, base: 0,
    desc: 'Economy-wide tax per ton of CO2 (baseline $0).',
    evidence: 'CBO: $25/ton raises ≈ $100B/yr and adds ≈ 0.2–0.3pp to price level; ≈ +22¢/gal gasoline. Emissions fall ≈ 10–15% within a decade (Goulder-Hafstead modeling). GDP drag small if revenue recycled — model assumes revenue reduces the deficit.',
    fx(v) { return {
      deficit: mul(v, -0.008, -0.012, -0.015),
      infl:    mul(v,  0.006,  0.010,  0.014),
      energy:  mul(v,  0.200,  0.280,  0.350),
      supply:  mul(v, -0.002, -0.005, -0.009),
    };}
  },
  {
    id: 'tariff', cat: 'tax', name: 'Average tariff rate', unit: '%',
    min: 0, max: 30, step: 1, base: 12,
    desc: 'Average effective tariff on all imports. 2024 baseline was ~2.5%; 2025-26 actions pushed estimates to roughly 10–15% (Yale Budget Lab) — dial starts at 12%.',
    evidence: 'US import tariffs pass ~100% into US import prices (Amiti-Redding-Weinstein 2019; Cavallo et al. 2021) — the exporter does not pay. 2018-19 tariffs produced no net manufacturing-job gains once retaliation and input costs counted (Flaaen & Pierce, Fed 2019). Revenue ≈ 0.03% GDP per pp, minus growth drag.',
    fx(v) { const d = v - 12; return {
      infl:    mul(d,  0.030,  0.055,  0.090),
      deficit: mul(d, -0.015, -0.025, -0.030),
      supply:  mul(d, -0.010, -0.020, -0.035),
      demand:  mul(d, -0.010, -0.020, -0.040),
      dollarLevel: mul(d, 0.100, 0.200, 0.300),
    };}
  },

  /* ---------------- FEDERAL SPENDING ---------------- */
  {
    id: 'infra', cat: 'spend', name: 'Infrastructure investment', unit: '% GDP',
    min: -0.5, max: 2, step: 0.1, base: 0,
    desc: 'Change in annual federal infrastructure spending, % of GDP (≈ $300B per 1%).',
    evidence: 'Public-investment demand multiplier ≈ 0.4–2.2 (CBO 2015; IMF WEO 2014 finds ~1.4 in slack). Adds to productive capital: long-run output elasticity ≈ 0.06–0.12 (Bom & Ligthart meta-analysis 2014). Build-out lags are real (2021 IIJA disbursed slowly).',
    fx(v) { return {
      demand:  mul(v, 0.40, 0.80, 1.20),
      supply:  mul(v, 0.20, 0.40, 0.60),
      deficit: mul(v, 0.90, 1.00, 1.10),
    };}
  },
  {
    id: 'defense', cat: 'spend', name: 'Defense spending', unit: '% GDP',
    min: -1.5, max: 1.5, step: 0.1, base: 0,
    desc: 'Change in defense outlays, % of GDP (baseline ≈ 3.0% of GDP).',
    evidence: 'Defense multipliers estimated ≈ 0.6–1.2 (Ramey 2011; Barro-Redlick 2011 ≈ 0.6–0.7). Limited supply-side payoff outside R&D spillovers.',
    fx(v) { return {
      demand:  mul(v, 0.40, 0.65, 0.95),
      deficit: mul(v, 0.95, 1.00, 1.05),
      supplySlow: mul(v, 0.00, 0.05, 0.15),
    };}
  },
  {
    id: 'ss', cat: 'spend', name: 'Social Security benefits', unit: '%',
    min: -20, max: 30, step: 1, base: 0,
    desc: 'Across-the-board % change in Social Security benefits (program ≈ 5% of GDP).',
    evidence: 'Near-complete pass-through to spending for lower-income retirees (MPC high). Social Security cuts elderly poverty from ~40% pre-transfer to ~10% (Census/CBPP); a 10% cut is estimated to push ~2-3pp of seniors below the line.',
    fx(v) { return {
      deficit: mul(v, 0.045, 0.050, 0.055),
      demand:  mul(v, 0.030, 0.045, 0.055),
      poverty: mul(v, -0.020, -0.030, -0.045),
      ineq:    mul(v, -0.010, -0.020, -0.030),
    };}
  },
  {
    id: 'health', cat: 'spend', name: 'Medicare / Medicaid spending', unit: '% GDP',
    min: -1.5, max: 1.5, step: 0.1, base: 0,
    desc: 'Change in federal health-program outlays, % of GDP (baseline ≈ 5.6%).',
    evidence: 'Medicaid expansion evidence: better financial security and reduced medical debt (Oregon HIE, Finkelstein et al. 2012), mortality reductions (Miller et al. 2021 QJE). Transfers carry multipliers ≈ 0.5–1.1 (CBO). Cuts raise uninsured rates ~proportionally (CBO scoring of repeal bills).',
    fx(v) { return {
      deficit: mul(v, 0.95, 1.00, 1.05),
      demand:  mul(v, 0.50, 0.80, 1.05),
      poverty: mul(v, -0.30, -0.50, -0.70),
    };}
  },
  {
    id: 'rnd', cat: 'spend', name: 'Federal R&D spending', unit: '% GDP',
    min: -0.3, max: 1, step: 0.05, base: 0,
    desc: 'Change in federal research funding, % of GDP (baseline ≈ 0.7%; postwar peak ≈ 1.9%).',
    evidence: 'Highest measured returns of any federal spending: social returns on nondefense R&D estimated at 150–300% (Fieldhouse & Mertens, Dallas Fed 2023); government R&D explains ~20% of postwar TFP growth. Payoffs arrive with long lags — mostly beyond 5 years.',
    fx(v) { return {
      deficit:    mul(v, 0.95, 1.00, 1.05),
      supplySlow: mul(v, 0.80, 1.60, 2.60),
      demand:     mul(v, 0.20, 0.35, 0.50),
    };}
  },
  {
    id: 'edu', cat: 'spend', name: 'Education spending', unit: '% GDP',
    min: -0.5, max: 1, step: 0.05, base: 0,
    desc: 'Change in federal education funding (K-12, Pell, pre-K), % of GDP.',
    evidence: 'School spending increases raise completed education and adult earnings (Jackson-Johnson-Persico 2016 QJE: +10% spending → +7% wages for poor students). Quality pre-K shows benefit-cost ratios > 1 (Heckman). Macro payoff is real but mostly beyond a 10-year window.',
    fx(v) { return {
      deficit:    mul(v, 0.95, 1.00, 1.05),
      demand:     mul(v, 0.30, 0.50, 0.70),
      supplySlow: mul(v, 0.20, 0.60, 1.10),
      poverty:    mul(v, -0.10, -0.20, -0.35),
      ineq:       mul(v, -0.10, -0.25, -0.40),
    };}
  },
  {
    id: 'ui', cat: 'spend', name: 'Unemployment insurance generosity', unit: '%',
    min: -50, max: 100, step: 5, base: 0,
    desc: '% change in UI benefit levels/duration (baseline ≈ 0.2% of GDP in normal times).',
    evidence: 'UI is among the strongest automatic stabilizers (multiplier ≈ 0.4–2.1, CBO). Generosity modestly lengthens unemployment spells: benefit-duration elasticity ≈ 0.3–0.5 (Schmieder-von Wachter 2016); 2020-21 supplements showed small disincentive effects (Dube 2021).',
    fx(v) { return {
      deficit:     mul(v,  0.0015, 0.0020, 0.0025),
      demand:      mul(v,  0.0015, 0.0022, 0.0030),
      structUnemp: mul(v,  0.0010, 0.0030, 0.0060),
      poverty:     mul(v, -0.0020, -0.0035, -0.0050),
    };}
  },
  {
    id: 'ctc', cat: 'spend', name: 'Child allowance', unit: '$/mo',
    min: 0, max: 500, step: 25, base: 0,
    desc: 'Universal monthly payment per child (2021 expanded CTC ≈ $250-300/mo).',
    evidence: 'The 2021 expanded CTC cut child poverty by ~40% while it lasted (Census SPM data; Columbia CPSP). Cost ≈ 0.8% of GDP at $300/mo. Employment effects measured in 2021: minimal (Ananat et al. 2022); long-run labor-supply estimates range 0 to -1.5% for affected parents.',
    fx(v) { return {
      deficit:    mul(v,  0.0024, 0.0027, 0.0030),
      demand:     mul(v,  0.0018, 0.0024, 0.0030),
      poverty:    mul(v, -0.0030, -0.0050, -0.0070),
      laborForce: mul(v,  0.0000, -0.0002, -0.0005),
      ineq:       mul(v, -0.0020, -0.0040, -0.0060),
    };}
  },

  /* ---------------- MONEY & THE FED ---------------- */
  {
    id: 'fedIndep', cat: 'money', name: 'Federal Reserve independence', unit: '',
    min: 0, max: 1, step: 1, base: 1, toggle: ['President sets rates', 'Independent Fed'],
    desc: 'Keep the Fed independent, or take direct control of interest rates (enables the override dial below).',
    evidence: 'Cross-country evidence: central-bank independence is strongly associated with lower, more stable inflation with no output cost (Alesina & Summers 1993; Cukierman). Episodes of political rate-setting (Nixon/Burns 1972, Turkey 2019-23, Argentina) preceded inflation surges and currency slides.',
    fx(v) { if (v >= 1) return {}; return {
      dollarLevel: t(-2, -5, -9),
      creditSpread: t(0.15, 0.40, 0.80),
      frag: t(6, 12, 20),
    };}
  },
  {
    id: 'ffOverride', cat: 'money', name: 'Presidential rate override', unit: '%',
    min: 0, max: 10, step: 0.25, base: 4,
    needs: { fedIndep: 0 },
    desc: 'The federal funds rate you dictate (only active if you strip Fed independence). Baseline ≈ 4%.',
    evidence: 'Holding rates below the economy\'s neutral/Taylor level de-anchors inflation expectations over 1-3 years (1970s US; Turkey 2021-23 saw inflation exceed 70% after forced cuts). Holding far above triggers recession (Volcker 1981-82: inflation broken at cost of 10.8% unemployment).',
    fx() { return {}; } // handled directly by engine
  },
  {
    id: 'inflTarget', cat: 'money', name: 'Inflation target', unit: '%',
    min: 0, max: 4, step: 0.5, base: 2,
    desc: 'The inflation rate monetary policy aims for (baseline 2%).',
    evidence: 'A credible higher target raises average inflation roughly one-for-one and long rates with it; transition costs come via repricing (Ball 2014 argued for 4%; Fed 2020 review kept 2%). A 0% target risks hitting the zero lower bound in recessions more often.',
    fx() { return {}; } // engine
  },
  {
    id: 'qe', cat: 'money', name: 'QE / balance sheet', unit: '$T',
    min: -1, max: 2, step: 0.25, base: 0,
    desc: 'Change in Fed bond holdings ($ trillions). Positive = QE purchases, negative = faster runoff.',
    evidence: 'Event studies: ~$600B of purchases lowers 10-yr yields ≈ 15–25bp (Krishnamurthy & Vissing-Jorgensen 2011; Gagnon et al. 2011) — real but modest per dollar. Effects strongest when markets are stressed.',
    fx(v) { return {
      demand: mul(v, 0.05, 0.10, 0.20),
      stockLevel: mul(v, 1.0, 2.0, 3.5),
    };} // 10-yr effect handled in engine via qe value
  },
  {
    id: 'dollarPolicy', cat: 'money', name: 'Dollar intervention', unit: '',
    min: -10, max: 10, step: 1, base: 0,
    desc: 'FX intervention: negative = deliberately weaken the dollar, positive = prop it up.',
    evidence: 'Sterilized intervention has modest, mostly temporary effects for reserve-currency issuers (Fratzscher et al. 2019: moves of 1-5% when coordinated). A 10% weaker dollar adds roughly 0.3–0.5pp to CPI (Gopinath passthrough estimates) and helps exporters.',
    fx(v) { return {
      dollarLevel: mul(v, 0.4, 0.8, 1.2),
      infl:        mul(v, -0.010, -0.025, -0.040),
      demand:      mul(v, -0.005, -0.015, -0.030),
    };}
  },
  {
    id: 'monetize', cat: 'money', name: 'Print money to pay bills', unit: '%',
    min: 0, max: 100, step: 5, base: 0,
    desc: 'Share of the federal deficit financed by money creation instead of borrowing.',
    evidence: 'Sustained monetary deficit finance is the best-documented cause of high inflation in history (Sargent 1982 "Ends of Four Big Inflations"; Weimar, Argentina, Zimbabwe, Venezuela). Financing a ~6%-of-GDP deficit with money growth produces inflation that compounds yearly and a falling currency.',
    fx(v) { return {
      infl:        mul(v, 0.040, 0.080, 0.150),
      dollarLevel: mul(v, -0.10, -0.20, -0.35),
      frag:        mul(v, 0.10, 0.20, 0.30),
      deficit:     mul(v, -0.010, -0.015, -0.020),
    };}
  },

  /* ---------------- LABOR & IMMIGRATION ---------------- */
  {
    id: 'minWage', cat: 'labor', name: 'Federal minimum wage', unit: '$',
    min: 7.25, max: 25, step: 0.25, base: 7.25,
    desc: 'Federal wage floor (baseline $7.25 since 2009; 30 states already set higher floors).',
    evidence: 'Modern studies find small employment effects up to ~60% of local median wage (Card-Krueger 1994; Cengiz et al. 2019 QJE: minimal job loss, real wage gains at bottom). CBO (2019, $15 score): +wages for ~17M, ~0-1.3M jobs at risk, mid ~0.4M. Beyond ~$17-20 federal floor, evidence runs out — the model adds rising job-loss risk there.',
    fx(v) { const d = v - 7.25; const over = Math.max(0, v - 15);
      return {
        wages:       mul(d, 0.015, 0.030, 0.045),
        poverty:     mul(d, -0.015, -0.030, -0.050),
        ineq:        mul(d, -0.030, -0.050, -0.070),
        infl:        mul(d, 0.004, 0.008, 0.014),
        structUnemp: t(d * 0.000 + over * 0.02, d * 0.008 + over * 0.05, d * 0.022 + over * 0.09),
      };}
  },
  {
    id: 'immigration', cat: 'labor', name: 'Legal immigration level', unit: '%',
    min: -100, max: 200, step: 10, base: 0,
    desc: '% change in legal immigration (baseline ≈ 1M green cards + net inflow ≈ 0.3% of labor force/yr).',
    evidence: 'Immigration raises GDP roughly in proportion to labor-force growth; wage effects on native workers ≈ 0 on average (NAS 2017 consensus report; Card 1990 Mariel; Clemens). CBO 2024: the 2021-23 surge added ~0.2pp/yr to GDP growth and reduced deficits ~$0.9T over a decade. High-skilled inflows raise innovation (Kerr).',
    fx(v) { return {
      laborForce: mul(v, 0.0020, 0.0030, 0.0040),
      deficit:    mul(v, -0.0004, -0.0008, -0.0014),
      housingDemand: mul(v, 0.004, 0.008, 0.014),
      infl:       mul(v, -0.0010, -0.0020, -0.0035),
    };}
  },
  {
    id: 'deport', cat: 'labor', name: 'Mass deportations', unit: 'M/yr',
    min: 0, max: 2, step: 0.1, base: 0.15,
    desc: 'Removals per year, millions (baseline ≈ 0.15M/yr; unauthorized workforce ≈ 8M).',
    evidence: 'Modeling of 1M+/yr removals (Peri; Brookings; AIC 2024): GDP lower by ~0.4–1.2% per million workers removed, with construction and agriculture hit hardest — Secure Communities evidence shows native employment falls too (East et al. 2023). Direct enforcement cost ≈ $80–100B per million. Food and housing costs rise.',
    fx(v) { const d = v - 0.15; return {
      laborForce:    mul(d, -0.35, -0.50, -0.65),
      infl:          mul(d, 0.15, 0.30, 0.50),
      deficit:       mul(d, 0.15, 0.25, 0.35),
      housingSupply: mul(d, -0.030, -0.060, -0.100),
      housingDemand: mul(d, -0.3, -0.6, -1.0),
    };}
  },
  {
    id: 'unions', cat: 'labor', name: 'Union policy', unit: '',
    min: -5, max: 5, step: 1, base: 0,
    desc: 'Negative = national right-to-work; positive = PRO-Act-style organizing rights (baseline: status quo, ~10% union density).',
    evidence: 'Unions compress wage distributions: the fall from ~30% to 10% density explains a fifth to a third of rising US wage inequality (Card 2001; Western & Rosenfeld 2011). Union wage premium ≈ 10-15%. Effects on total employment/productivity: small and contested in both directions.',
    fx(v) { return {
      wages:       mul(v, 0.010, 0.030, 0.050),
      ineq:        mul(v, -0.05, -0.10, -0.15),
      structUnemp: mul(v, 0.000, 0.008, 0.020),
      supply:      mul(v, 0.000, -0.010, -0.030),
    };}
  },
  {
    id: 'overtime', cat: 'labor', name: 'Overtime salary threshold', unit: '$k',
    min: 24, max: 100, step: 2, base: 44,
    desc: 'Salary below which workers must get time-and-a-half overtime (baseline ≈ $44k).',
    evidence: 'DOL/academic studies of the 2016-2019 threshold changes: modest wage gains for newly covered workers, small hour reductions, negligible employment effects (Quach 2024).',
    fx(v) { const d = (v - 44) / 10; return {
      wages: mul(d, 0.005, 0.015, 0.025),
      ineq:  mul(d, -0.01, -0.03, -0.05),
    };}
  },
  {
    id: 'leave', cat: 'labor', name: 'Paid family leave', unit: 'wks',
    min: 0, max: 16, step: 1, base: 0,
    desc: 'Federally funded paid family/medical leave, weeks (baseline: none; only US among rich countries).',
    evidence: 'California\'s program raised new mothers\' employment and hours (Rossin-Slater et al. 2013); modest positive or zero firm effects (Bedard-Rossin-Slater 2016). Cost ≈ 0.1-0.2% of GDP at 12 weeks (CBO score of FAMILY Act).',
    fx(v) { return {
      deficit:    mul(v, 0.008, 0.012, 0.016),
      laborForce: mul(v, 0.004, 0.010, 0.018),
      wages:      mul(v, 0.000, 0.003, 0.006),
    };}
  },
  {
    id: 'licensing', cat: 'labor', name: 'Occupational licensing reform', unit: '',
    min: 0, max: 10, step: 1, base: 0,
    desc: 'Reduce licensing barriers (≈25% of US workers need a license, up from 5% in 1950).',
    evidence: 'Licensing raises covered wages ~10-15% but restricts entry and mobility (Kleiner & Krueger 2013); universal recognition laws raised migration of licensed workers with no measured quality decline (Johnson & Kleiner 2020).',
    fx(v) { return {
      supply:      mul(v, 0.010, 0.025, 0.045),
      structUnemp: mul(v, -0.004, -0.010, -0.018),
      infl:        mul(v, -0.002, -0.005, -0.008),
    };}
  },

  /* ---------------- HOUSING & REAL ESTATE ---------------- */
  {
    id: 'zoning', cat: 'house', name: 'Zoning / land-use reform', unit: '',
    min: 0, max: 10, step: 1, base: 0,
    desc: 'Federal push (funding conditions, preemption) to legalize more housing near jobs. 10 = maximal national upzoning.',
    evidence: 'Supply constraints explain most price divergence across metros (Glaeser & Gyourko 2018). Auckland\'s 2016 upzoning raised permits ~4x in upzoned areas and cut rent growth (Greenaway-McGrevy 2023). Misallocation from constrained cities may cost several % of GDP long-run (Hsieh-Moretti 2019 — magnitude debated).',
    fx(v) { return {
      housingSupply: mul(v, 0.020, 0.045, 0.075),
      supplySlow:    mul(v, 0.010, 0.030, 0.060),
      rentDirect:    mul(v, -0.10, -0.25, -0.45),
    };}
  },
  {
    id: 'mid', cat: 'house', name: 'Mortgage interest deduction', unit: '',
    min: -1, max: 1, step: 1, base: 0, toggle3: ['Repeal', 'Keep (baseline)', 'Expand'],
    desc: 'Repeal, keep, or expand the mortgage-interest deduction (costs ≈ $30-40B/yr post-TCJA).',
    evidence: 'The MID does not raise homeownership — it capitalizes into prices of larger homes for higher-income buyers (Hilber & Turner 2014; Gruber et al., Denmark 2021: repeal had no effect on ownership). Repeal raises revenue and trims prices ~1-3% at the top.',
    fx(v) { return {
      deficit:       mul(v, 0.08, 0.12, 0.16),
      housingDemand: mul(v, 0.8, 1.5, 2.5),
      ineq:          mul(v, 0.05, 0.10, 0.15),
    };}
  },
  {
    id: 'buyerCredit', cat: 'house', name: 'First-time buyer credit', unit: '$k',
    min: 0, max: 25, step: 1, base: 0,
    desc: 'Down-payment assistance / tax credit for first-time buyers.',
    evidence: 'Demand subsidies into constrained supply capitalize into prices: the 2008-10 credit pulled sales forward and supported prices ~1-2% temporarily (Berger-Turner-Zwick 2020). Helps individual recipients; raises prices market-wide when supply is tight.',
    fx(v) { return {
      housingDemand: mul(v, 0.10, 0.20, 0.32),
      deficit:       mul(v, 0.003, 0.005, 0.007),
      rentDirect:    mul(v, -0.01, -0.03, -0.05),
    };}
  },
  {
    id: 'rentControl', cat: 'house', name: 'National rent control', unit: '% units',
    min: 0, max: 50, step: 5, base: 0,
    desc: 'Share of rental units under rent caps (baseline ≈ 2%, local only).',
    evidence: 'San Francisco study (Diamond, McQuade & Qian 2019 AER): covered tenants gained, but landlords cut rental supply 15%, raising citywide rents ~5% — benefits incumbents, costs future renters. Short-run rent relief, long-run supply decline is the most replicated result in housing economics.',
    fx(v) { return {
      rentDirect:    mul(v, -0.06, -0.10, -0.14),
      housingSupply: mul(v, -0.0015, -0.0035, -0.0060),
      housingDemand: mul(v, -0.02, -0.05, -0.08),
    };}
  },
  {
    id: 'socialHousing', cat: 'house', name: 'Public / subsidized construction', unit: 'k units/yr',
    min: 0, max: 500, step: 25, base: 50,
    desc: 'Federally financed affordable-housing construction (baseline ≈ 50k LIHTC units/yr).',
    evidence: 'LIHTC evaluations: real additions to stock with partial crowd-out (30-70%, Sinai-Waldfogel; Baum-Snow & Marion). Cost ≈ $250-350k/unit federal share. Direct supply lowers nearby rents modestly (Diamond & McQuade 2019).',
    fx(v) { const d = v - 50; return {
      housingSupply: mul(d, 0.00015, 0.00030, 0.00045),
      deficit:       mul(d, 0.0007, 0.0010, 0.0013),
      rentDirect:    mul(d, -0.002, -0.004, -0.007),
      poverty:       mul(d, -0.0005, -0.0012, -0.0020),
    };}
  },
  {
    id: 'investorLimit', cat: 'house', name: 'Institutional investor limits', unit: '%',
    min: 0, max: 100, step: 10, base: 0,
    desc: 'Restrict large-investor purchases of single-family homes (institutions own ≈ 3-5% of SFR stock).',
    evidence: 'Evidence is thin: institutional buyers are concentrated in a few metros; studies find they raised prices ~1-2% locally (Gurun et al. 2023) while adding rental supply. Limits likely trim prices slightly and tighten rentals slightly — both effects small nationally.',
    fx(v) { return {
      housingDemand: mul(v, -0.005, -0.012, -0.025),
      rentDirect:    mul(v, 0.000, 0.005, 0.012),
    };}
  },

  /* ---------------- BANKING & FINANCE ---------------- */
  {
    id: 'bankCapital', cat: 'bank', name: 'Bank capital requirements', unit: '%',
    min: 4, max: 25, step: 1, base: 10,
    desc: 'Required equity capital for large banks, % of risk-weighted assets (baseline ≈ 10-13%).',
    evidence: 'Each +1pp of capital raises lending spreads only ~5-10bp (BIS; Firestone et al., Fed 2017) but materially cuts crisis probability — banks with thin capital drove 2008. Optimal capital estimated 13-25% (Admati; Fed/Minneapolis 2016). Cutting capital juices credit now, raises blow-up risk later.',
    fx(v) { const d = v - 10; return {
      creditSpread: mul(d, 0.020, 0.040, 0.065),
      frag:         mul(d, -2.0, -3.0, -4.0),
      demand:       mul(d, -0.010, -0.025, -0.045),
    };}
  },
  {
    id: 'finDereg', cat: 'bank', name: 'Financial deregulation', unit: '',
    min: -5, max: 5, step: 1, base: 0,
    desc: 'Negative = tighten oversight (stress tests, Volcker rule); positive = roll back Dodd-Frank-style rules.',
    evidence: 'Deregulation cycles precede credit booms and busts (Reinhart & Rogoff; Mian-Sufi on 2000s mortgage credit). The 2018 EGRRCPA rollback of mid-size-bank rules was cited by the Fed\'s own 2023 SVB post-mortem (Barr report) as weakening supervision. Short-run credit gains are real; tail risk accumulates.',
    fx(v) { return {
      demand:       mul(v, 0.020, 0.050, 0.080),
      creditSpread: mul(v, -0.010, -0.030, -0.050),
      frag:         mul(v, 2.0, 3.5, 5.5),
      housingDemand:mul(v, 0.10, 0.30, 0.55),
    };}
  },
  {
    id: 'fdic', cat: 'bank', name: 'Deposit insurance cap', unit: '$k',
    min: 100, max: 5000, step: 100, base: 250,
    desc: 'FDIC coverage per depositor (baseline $250k; 5000 ≈ effectively unlimited).',
    evidence: 'Higher coverage stops bank runs (Diamond-Dybvig logic; 2023 SVB episode resolved via de facto full coverage) but breeds moral hazard over time — banks with more insured deposits take more risk (Demirgüç-Kunt & Detragiache cross-country evidence).',
    fx(v) { const d = (v - 250) / 1000; return {
      frag: t(d * -1.5 + Math.abs(d) * 0.0, d * -1.0 + Math.abs(d) * 0.8, d * -0.5 + Math.abs(d) * 1.8),
      creditSpread: mul(d, -0.010, -0.020, -0.030),
    };}
  },
  {
    id: 'glassSteagall', cat: 'bank', name: 'Glass-Steagall separation', unit: '',
    min: 0, max: 1, step: 1, base: 0, toggle: ['Unified banking (baseline)', 'Separate commercial/investment'],
    desc: 'Force separation of commercial banking from securities trading (repealed 1999).',
    evidence: 'Economists debate its role in 2008 (pure investment banks and thrifts failed, not universal banks per se), but separation demonstrably shrinks contagion channels and bank complexity. Costs: modestly pricier capital-markets services.',
    fx(v) { return {
      frag:         mul(v, -1.0, -3.0, -5.0),
      creditSpread: mul(v, 0.020, 0.050, 0.100),
      stockLevel:   mul(v, -0.5, -1.0, -2.0),
    };}
  },
  {
    id: 'ftt', cat: 'bank', name: 'Financial transactions tax', unit: 'bps',
    min: 0, max: 50, step: 5, base: 0,
    desc: 'Tax per trade on stocks/bonds/derivatives, basis points (10bps = 0.1%).',
    evidence: 'CBO: a 10bp FTT raises ~$60-80B/yr before migration/volume decline; Sweden\'s 1980s FTT drove most trading offshore and was repealed. Reduces high-frequency volume; effects on volatility ambiguous (Colliard-Hoffmann 2017).',
    fx(v) { return {
      deficit:    mul(v, -0.0010, -0.0018, -0.0025),
      stockLevel: mul(v, -0.020, -0.050, -0.100),
      frag:       mul(v, -0.010, 0.000, 0.030),
    };}
  },
  {
    id: 'usury', cat: 'bank', name: 'National interest-rate cap', unit: '% APR',
    min: 10, max: 100, step: 5, base: 100,
    desc: 'Cap on consumer-loan APRs (100 = no cap, baseline; 36% = military-lending standard).',
    evidence: 'Caps eliminate the most predatory products but also cut credit access for the riskiest borrowers — evidence on net welfare is genuinely mixed (Zinman 2010; Melzer 2011 finds payday harm; Morgan-Strain find hardship when access removed).',
    fx(v) { const d = (100 - v) / 10; return {
      poverty: t(d * -0.010, d * 0.000, d * 0.015),
      demand:  mul(d, -0.002, -0.005, -0.010),
      ineq:    mul(d, -0.01, -0.02, -0.03),
    };}
  },

  /* ---------------- TRADE & INDUSTRY ---------------- */
  {
    id: 'exportControls', cat: 'trade', name: 'Tech export controls', unit: '',
    min: 0, max: 10, step: 1, base: 3,
    desc: 'Restrictions on advanced tech (chips, AI) exports to rivals (baseline: current chip controls).',
    evidence: 'Controls cost US firms revenue and R&D scale (chip-equipment makers lost ~20-30% of China sales) while slowing rivals\' frontier capability — the security benefit is real but unpriced here. Overly broad controls accelerate design-out of US suppliers (Peterson Institute analyses).',
    fx(v) { const d = v - 3; return {
      supply:     mul(d, -0.008, -0.018, -0.035),
      stockLevel: mul(d, -0.10, -0.25, -0.45),
    };}
  },
  {
    id: 'buyAmerica', cat: 'trade', name: 'Buy-America procurement', unit: '%',
    min: 0, max: 100, step: 5, base: 60,
    desc: 'Domestic-content share required in federal purchases (baseline ≈ 60%).',
    evidence: 'Raises costs of government projects ~5-25% for covered items (GAO reviews); supports specific factories, but each protected job costs multiples of its wage. Small macro footprint.',
    fx(v) { const d = (v - 60) / 10; return {
      infl:        mul(d, 0.003, 0.008, 0.015),
      deficit:     mul(d, 0.005, 0.010, 0.018),
      structUnemp: mul(d, 0.000, -0.003, -0.008),
    };}
  },
  {
    id: 'antitrust', cat: 'trade', name: 'Antitrust enforcement', unit: '',
    min: 0, max: 10, step: 1, base: 4,
    desc: 'Merger challenges and monopolization cases (baseline: recent moderate enforcement).',
    evidence: 'Rising concentration is associated with higher markups (De Loecker-Eeckhout 2020) and monopsony wage suppression ~15-25% below competitive levels in concentrated labor markets (Azar-Marinescu; Benmelech). Breakups\' record: AT&T divestiture spurred competition. Effects arrive slowly.',
    fx(v) { const d = v - 4; return {
      supplySlow: mul(d, 0.000, 0.020, 0.050),
      infl:       mul(d, 0.000, -0.004, -0.010),
      wages:      mul(d, 0.000, 0.010, 0.025),
      stockLevel: mul(d, -0.10, -0.30, -0.60),
    };}
  },
  {
    id: 'chips', cat: 'trade', name: 'Manufacturing subsidies', unit: '$B/yr',
    min: 0, max: 150, step: 10, base: 40,
    desc: 'CHIPS-style subsidies for strategic manufacturing (baseline ≈ $40B/yr equivalent).',
    evidence: 'CHIPS Act triggered >$400B announced fab investment; construction employment responded fast. Per-job cost is high (often >$1M) and some spending displaces private investment — supports resilience more than measured GDP (Brookings, CSIS assessments).',
    fx(v) { const d = (v - 40) / 10; return {
      demand:  mul(d, 0.008, 0.015, 0.025),
      supply:  mul(d, 0.004, 0.012, 0.025),
      deficit: mul(d, 0.030, 0.035, 0.040),
    };}
  },

  /* ---------------- ENERGY & REGULATION ---------------- */
  {
    id: 'drilling', cat: 'energy', name: 'Oil & gas permitting', unit: '',
    min: -5, max: 5, step: 1, base: 0,
    desc: 'Negative = restrict federal leases/permits; positive = maximal expansion ("drill baby drill").',
    evidence: 'US is already the world\'s top producer (~13M bbl/day); prices are set globally, so even large permitting shifts move gasoline only a few percent over years (EIA elasticities). Producers respond to price, not permits alone — 2021-24 output hit records under restrictions. Emissions move opposite to output.',
    fx(v) { return {
      energy: mul(v, -0.4, -0.9, -1.6),
      infl:   mul(v, -0.005, -0.015, -0.028),
      supply: mul(v, 0.003, 0.008, 0.016),
    };}
  },
  {
    id: 'renewables', cat: 'energy', name: 'Clean-energy subsidies', unit: '$B/yr',
    min: 0, max: 150, step: 10, base: 50,
    desc: 'IRA-style tax credits for renewables, storage, nuclear, EVs (baseline ≈ $50B/yr).',
    evidence: 'Learning curves are the strongest result in energy economics: solar costs fell ~90% in 15 years; subsidies accelerated deployment (IRA drove record capacity additions 2023-25). Electricity price effect: slightly negative long-run; fiscal cost is the main drag (CBO re-scored IRA credits upward).',
    fx(v) { const d = (v - 50) / 10; return {
      deficit:    mul(d, 0.030, 0.035, 0.040),
      demand:     mul(d, 0.008, 0.015, 0.022),
      energy:     mul(d, -0.05, -0.15, -0.30),
      supplySlow: mul(d, 0.000, 0.008, 0.020),
    };}
  },
  {
    id: 'envReg', cat: 'energy', name: 'Environmental regulation', unit: '',
    min: -5, max: 5, step: 1, base: 0,
    desc: 'Negative = roll back air/water/emissions rules; positive = tighten them.',
    evidence: 'EPA retrospective studies: major air rules\' monetized health benefits exceed compliance costs by ~3-30x (Clean Air Act §812 reports) — but those benefits (mortality, IQ) are NOT in GDP. Measured GDP/productivity cost of tightening is small but real for exposed industries (Greenstone 2002).',
    fx(v) { return {
      supply:  mul(v, -0.008, -0.020, -0.040),
      infl:    mul(v, 0.003, 0.008, 0.015),
      poverty: mul(v, -0.005, -0.015, -0.030),
    };}
  },
  {
    id: 'nuclear', cat: 'energy', name: 'Nuclear permitting reform', unit: '',
    min: 0, max: 10, step: 1, base: 1,
    desc: 'Streamline NRC licensing, standardize designs, extend existing plants (baseline: ADVANCE Act).',
    evidence: 'US nuclear construction costs 3-5x international best practice, mostly regulatory/process-driven (MIT 2018; Vogtle overruns). Korea/France show standardization works. Payoffs are almost entirely beyond 5 years — nothing connects to the grid fast.',
    fx(v) { const d = v - 1; return {
      supplySlow: mul(d, 0.005, 0.015, 0.030),
      energy:     mul(d, -0.05, -0.12, -0.25),
      demand:     mul(d, 0.002, 0.005, 0.010),
    };}
  },
  {
    id: 'aiReg', cat: 'energy', name: 'AI regulation intensity', unit: '',
    min: 0, max: 10, step: 1, base: 2,
    desc: 'From laissez-faire (0) to strict licensing of frontier AI (10). Baseline: light-touch.',
    evidence: 'Genuinely uncertain territory — flagged honestly. Estimates of AI\'s productivity contribution range from ~0.5% to >7% of GDP over a decade (Acemoglu 2024 vs. Goldman/McKinsey). Heavy licensing would slow diffusion and its risks alike; the model prices only the measured-productivity channel.',
    fx(v) { const d = v - 2; return {
      supplySlow:  mul(d, -0.010, -0.040, -0.090),
      structUnemp: mul(d, 0.000, -0.005, -0.015),
      stockLevel:  mul(d, -0.20, -0.50, -0.90),
    };}
  },
];

const LEVER_MAP = Object.fromEntries(LEVERS.map(l => [l.id, l]));

/* Preset presidencies */
const PRESETS = {
  reset: { name: '— Baseline (do nothing)', values: {} },
  supplySide: {
    name: 'Supply-Sider',
    values: { corpRate: 15, topRate: 30, capGains: 15, tariff: 3, finDereg: 3, envReg: -3, drilling: 4, licensing: 6, zoning: 5, aiReg: 0, middleTax: -1 }
  },
  progressive: {
    name: 'Progressive',
    values: { topRate: 45, corpRate: 28, capGains: 30, minWage: 17, ctc: 300, health: 0.8, edu: 0.5, leave: 12, unions: 4, rnd: 0.3, bankCapital: 15, socialHousing: 300, zoning: 6, carbon: 40, tariff: 5 }
  },
  populist: {
    name: 'Populist',
    values: { tariff: 25, deport: 1.0, fedIndep: 0, ffOverride: 1.5, middleTax: -2, minWage: 12, buyAmerica: 90, immigration: -80, drilling: 5, finDereg: 2 }
  },
  technocrat: {
    name: 'Abundance Technocrat',
    values: { zoning: 9, nuclear: 8, licensing: 8, rnd: 0.5, immigration: 80, tariff: 3, carbon: 30, chips: 80, antitrust: 6, socialHousing: 150, edu: 0.3, bankCapital: 13 }
  },
};
