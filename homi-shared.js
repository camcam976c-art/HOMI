// ═══════════════════════════════════════════════════════════════
// HOMI Shared — Colors, Engine v3, Property Data, Utilities
// Loaded by every HOMI page as a plain <script> (no Babel needed)
// ═══════════════════════════════════════════════════════════════

var {useState,useEffect,useRef} = React;

// ── Colors ───────────────────────────────────────────────────────────────────
var C={
  cream:"#FAF6F0",creamDark:"#F0E9DC",creamMid:"#EDE3D6",white:"#FFFFFF",
  green:"#1C4A2E",greenMid:"#2D6A4F",greenLight:"#52B788",greenPale:"#D8F3DC",
  gold:"#C9963A",goldLight:"#E8B84B",goldPale:"#FDF3E0",
  text:"#1A1A1A",textMid:"#3A3A3A",textMuted:"#8A8A8A",
  border:"#E4DDD3",borderGreen:"rgba(28,74,46,0.2)",borderGold:"rgba(201,150,58,0.35)",
  red:"#C0392B",redPale:"#FDECEA",amber:"#D97706",amberPale:"#FEF3C7",
  orange:"#C2500A",orangePale:"#FEF0E7",
  blue:"#2563A8",bluePale:"#EBF2FB",teal:"#0F766E",tealPale:"#CCFBF1",
  sagePale:"#ECF4EE",
};

// ── Icon set ─────────────────────────────────────────────────────────────────

async function callClaude(system,userMsg){
  const res=await fetch("/.netlify/functions/claude",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system,messages:[{role:"user",content:userMsg}]})
  });
  const data=await res.json();
  return data.content?.[0]?.text||"Unable to load response.";
}


// ── Scoring Engine v3 ────────────────────────────────────────────
var SYS_WEIGHTS = {
  foundation:     0.18,  // STRUCTURAL — Hard Flag (active movement)
  structural:     0.05,  // STRUCTURAL — Hard Flag (framing compromise)
  roof:           0.18,  // STRUCTURAL — Conditional (age + active defect split)
  electrical:     0.16,  // SAFETY     — Hard Flag (FPE/Zinsco = cap 25)
  plumbing:       0.13,  // SYSTEMS    — Conditional (PB pipe, galvanized)
  hvac:           0.11,  // SAFETY/SYSTEMS
  water_intrusion:0.07,  // STRUCTURAL — Hard Flag (active penetration)
  windows_doors:  0.05,  // STRUCTURAL — Conditional (egress failure)
  exterior:       0.05,  // STRUCTURAL
  attic:          0.04,  // STRUCTURAL
  basement:       0.05,  // STRUCTURAL — Conditional (moisture/pest)
  interior:       0.01,  // SYSTEMS    — cosmetic only
  environmental:  0.05,  // SAFETY     — Hard Flag (radon/mold/asbestos/lead)
  garage:         0.03,  // SAFETY     — Conditional (fire separation, CO)
  appliances:     0.02,  // SYSTEMS
  maintenance:    0.10,  // cross-system behavior bonus (separate from above)
};

// ── Tier assignments ──────────────────────────────────────────────────────────
var SYS_TIER = {
  foundation:'structural', structural:'structural', roof:'structural',
  water_intrusion:'structural', windows_doors:'structural', exterior:'structural',
  attic:'structural', basement:'structural',
  electrical:'safety', hvac:'safety', environmental:'safety', garage:'safety',
  plumbing:'systems', interior:'systems', appliances:'systems',
};
var TIER_WEIGHTS = { safety:0.35, structural:0.40, systems:0.25 };

// ── Hard Flag definitions ─────────────────────────────────────────────────────
var HARD_FLAGS = {
  fpe_zinsco:      { sys:'electrical',     label:'FPE/Zinsco Panel',          severity:'critical', scoreCap:25, desc:'Insurance denial risk. Panel replacement required before coverage.' },
  pb_pipe:         { sys:'plumbing',       label:'Polybutylene Plumbing',     severity:'critical', scoreCap:40, desc:'Insurance exclusion risk. Most carriers deny or exclude PB failures.' },
  active_water:    { sys:'water_intrusion',label:'Active Water Penetration',  severity:'critical', scoreCap:35, desc:'FHA hard stop. Cascading damage to foundation, framing, and mold risk.' },
  foundation_move: { sys:'foundation',     label:'Foundation Movement',       severity:'critical', scoreCap:30, desc:'Active settlement or cracking detected. Structural engineer required.' },
  friable_asbestos:{ sys:'environmental',  label:'Friable Asbestos',          severity:'critical', scoreCap:30, desc:'FHA hard stop. Abatement required before loan approval.' },
  lead_paint:      { sys:'environmental',  label:'Lead Paint (pre-1978)',     severity:'critical', scoreCap:null, desc:'HUD-EPA disclosure required. Chipped/peeling = FHA hard stop.' },
  active_mold:     { sys:'environmental',  label:'Active Mold',               severity:'critical', scoreCap:35, desc:'FHA condition. Remediation required before habitability certification.' },
  egress_fail:     { sys:'windows_doors',  label:'Bedroom Egress Failure',    severity:'conditional', scoreCap:null, desc:'Life-safety issue. IRC R310: min 5.7 sq ft, 24" H, 20" W, 44" sill.' },
  galvanized_pipe: { sys:'plumbing',       label:'Galvanized Plumbing',       severity:'conditional', scoreCap:null, desc:'Insurance surcharge trigger. Corrosion risk; replace within 5–10 yrs.' },
  knob_tube:       { sys:'electrical',     label:'Knob & Tube Wiring',        severity:'conditional', scoreCap:50, desc:'Legacy wiring. Many insurers restrict coverage or require inspection.' },
  roof_age_fha:    { sys:'roof',           label:'Roof Life < 2 Years',       severity:'conditional', scoreCap:null, desc:'FHA minimum: 2 yr remaining life required for loan approval.' },
};

// ── Decay half-life in months ─────────────────────────────────────────────────
var DECAY_HALFLIFE = {
  hvac:24, roof:36, water:18, water_heater:18, electrical:60, plumbing:60,
  exterior:48, foundation:120, structural:120, basement:60,
  windows_doors:48, attic:60, environmental:36, garage:60, appliances:24,
};

// ── Freshness thresholds per system (months) ──────────────────────────────────
var FRESHNESS_THRESHOLDS = {
  hvac:           {fresh:12, aging:24},
  water:          {fresh:12, aging:18},
  water_heater:   {fresh:12, aging:18},
  roof:           {fresh:18, aging:36},
  electrical:     {fresh:36, aging:60},
  plumbing:       {fresh:36, aging:60},
  exterior:       {fresh:24, aging:48},
  foundation:     {fresh:60, aging:120},
  structural:     {fresh:60, aging:120},
  basement:       {fresh:24, aging:48},
  windows_doors:  {fresh:24, aging:48},
  attic:          {fresh:36, aging:72},
  environmental:  {fresh:24, aging:36},
  garage:         {fresh:36, aging:60},
  appliances:     {fresh:12, aging:24},
};
var FRESHNESS_MULTIPLIER = {fresh:1.0, aging:0.80, stale:0.60};
var FRESHNESS_COLOR      = {fresh:'#2D6A4F', aging:'#D97706', stale:'#C0392B'};
var FRESHNESS_BG         = {fresh:'#D8F3DC', aging:'#FEF3C7', stale:'#FDECEA'};
function getFreshnessState(monthsAgo, sysKey){
  const t = FRESHNESS_THRESHOLDS[sysKey] || {fresh:18, aging:36};
  if(monthsAgo == null) return 'stale';
  if(monthsAgo <= t.fresh) return 'fresh';
  if(monthsAgo <= t.aging) return 'aging';
  return 'stale';
}

function freshnessMult(monthsAgo, sysKey){
  const hl = DECAY_HALFLIFE[sysKey] || 36;
  return Math.max(0.40, 1 - (monthsAgo / (hl * 2)));
}

// ── v2.1 Condition factor (updated scale) ────────────────────────────────────
var CONDITION_FACTOR = {
  excellent:97, good:88, fair:68, poor:38, critical:15, unknown:40,
  // legacy aliases
  monitor:50, replace:25, safety:10
};

// ── Age factor table ──────────────────────────────────────────────────────────
function ageFactor(util){
  if(util<=0.30) return 95;
  if(util<=0.50) return 85;
  if(util<=0.60) return 75;
  if(util<=0.75) return 60;
  if(util<=0.90) return 40;
  if(util<=1.00) return 25;
  return 12;
}

// ── Age-Adjusted Risk Modifier (v2.1) ────────────────────────────────────────
function ageRiskModifier(util){
  if(util > 0.90) return -14;
  if(util > 0.75) return -6;
  return 0;
}

function maintenanceFactor(rate){
  if(rate==null)  return 50;
  if(rate>=0.90)  return 95;
  if(rate>=0.70)  return 80;
  if(rate>=0.50)  return 65;
  if(rate>=0.25)  return 45;
  return 25;
}

var EVENT_FACTOR = {none:90, minor_resolved:75, moderate:50, major:25, safety:10};

// ── Source confidence ─────────────────────────────────────────────────────────
var CONFIDENCE_FACTOR = {
  inspector:95, permit:92, provider:90, document:80,
  owner_photo:70, owner:55, inferred:40
};

var SOURCE_CONFIG = {
  inspector:  {label:'Inspector verified',  color:'#2D6A4F', bg:'#D8F3DC', icon:'🔍'},
  permit:     {label:'Permit record',        color:'#2563A8', bg:'#EBF2FB', icon:'📋'},
  provider:   {label:'Provider confirmed',   color:'#2563A8', bg:'#EBF2FB', icon:'🔧'},
  document:   {label:'Document verified',    color:'#C9963A', bg:'#FDF3E0', icon:'🧾'},
  owner_photo:{label:'Owner w/ photo',       color:'#D97706', bg:'#FEF3C7', icon:'📷'},
  owner:      {label:'Owner reported',       color:'#8A8A8A', bg:'#F5F5F5', icon:'👤'},
  inferred:   {label:'Inferred',             color:'#8A8A8A', bg:'#F5F5F5', icon:'📊'},
};

// ── Evidence ladder ───────────────────────────────────────────────────────────
var EVIDENCE_LADDER = [
  {key:'none',       label:'No evidence',         icon:'📝', maxPts:2,  color:'#8A8A8A', bg:'#F5F5F5'},
  {key:'photo',      label:'Photo attached',       icon:'📷', maxPts:4,  color:'#D97706', bg:'#FEF3C7'},
  {key:'receipt',    label:'Receipt / invoice',    icon:'🧾', maxPts:7,  color:'#C9963A', bg:'#FDF3E0'},
  {key:'contractor', label:'Contractor confirmed', icon:'🔧', maxPts:9,  color:'#2D6A4F', bg:'#D8F3DC'},
  {key:'inspector',  label:'Inspector verified',   icon:'✅', maxPts:10, color:'#1C4A2E', bg:'#D8F3DC'},
];

// ── Windows/Doors Major Improvement Bonus ────────────────────────────────────
// Full documented replacement (permit + contractor + warranty) = +16 pts contribution
// × 0.25 owner coeff = +4 pts on OES (total ~5 pts with system score movement)
var MAJOR_IMPROVEMENT_BONUS = {
  windows_doors: { receipt:8, contractor:12, inspector:16 },
  roof:          { receipt:10, contractor:14, inspector:16 },
  hvac:          { receipt:8, contractor:12, inspector:16 },
  foundation:    { receipt:12, contractor:14, inspector:16 },
  electrical:    { receipt:6, contractor:10, inspector:14 },
  plumbing:      { receipt:6, contractor:10, inspector:14 },
};

// ── Climate adjustments (Zone 5A default) ────────────────────────────────────
var CLIMATE_ADJ = {
  roof:-3, hvac:-2, plumbing:-1, exterior:-2, water:-1, water_intrusion:-2, electrical:0,
  windows_doors:-1, foundation:-1
};

// ── System score calculator ───────────────────────────────────────────────────
function scoreSystem(sys){
  const util = sys.age / (sys.expectedLife || 20);
  const af   = ageFactor(util);
  const cf   = CONDITION_FACTOR[sys.condition] || 65;
  const mf   = maintenanceFactor(sys.maintenanceRate ?? null);
  const ef   = EVENT_FACTOR[sys.event || 'none'];
  const conf = CONFIDENCE_FACTOR[sys.source || 'inferred'];
  const base = Math.round((af*0.35)+(cf*0.25)+(mf*0.15)+(ef*0.15)+(conf*0.10));
  // Apply age risk modifier
  return Math.max(5, base + ageRiskModifier(util));
}

function decayedScore(baseScore, monthsAgo, sysKey, inferredBaseline=55){
  const fm = freshnessMult(monthsAgo, sysKey);
  return Math.round(baseScore*fm + inferredBaseline*(1-fm));
}

// ── Owner update cap ──────────────────────────────────────────────────────────
function ownerUpdateCap(verifiedScore){
  return verifiedScore >= 70
    ? verifiedScore * 0.15
    : Math.min(10, verifiedScore * 0.20);
}

// ── Plausibility gate (3-tier) ────────────────────────────────────────────────
function plausibilityGate(ownerUp, verifiedScore){
  const claimedDelta = ownerUp.claimedScore - verifiedScore;
  const cap = ownerUpdateCap(verifiedScore);
  const evEntry = EVIDENCE_LADDER.find(e=>e.key===ownerUp.evidence) || EVIDENCE_LADDER[0];

  if(claimedDelta > 20 && ownerUp.evidence === 'none'){
    return {delta: Math.min(1, cap), tier:3, flag:true,
      message:'Large improvement claimed without evidence. Upload a receipt or photo to unlock credit.'};
  }
  if(claimedDelta > 15){
    return {delta: Math.min(evEntry.maxPts * 0.4, cap), tier:2, flag:true,
      message:'Score impact capped until verification. Upload invoice or contractor confirmation to unlock full credit.'};
  }
  return {delta: Math.min(evEntry.maxPts, cap), tier:1, flag:false, message:null};
}

// ── Replacement Horizon (Lifecycle Intelligence) ──────────────────────────────
function getReplacementHorizon(util, conditionKey){
  const cf = CONDITION_FACTOR[conditionKey] || 65;
  if(util > 0.90 || cf <= 15) return 'act_now';
  if(util > 0.75 || cf <= 38) return 'replace_window';
  if(util > 0.60 || cf <= 68) return 'plan_ahead';
  return 'monitor';
}

var HORIZON_CONFIG = {
  monitor:        {label:'Monitor',               color:'#2D6A4F', bg:'#D8F3DC'},
  plan_ahead:     {label:'Plan Ahead',            color:'#C9963A', bg:'#FDF3E0'},
  replace_window: {label:'Replacement Window',    color:'#D97706', bg:'#FEF3C7'},
  act_now:        {label:'Act Now',               color:'#C0392B', bg:'#FDECEA'},
};

// ── Main score computation ────────────────────────────────────────────────────
function computeHomeScore(systems, ownerUpdates=[], maintenanceBehavior=70, activeFlags=[]){
  let tierScores = {safety:0, structural:0, systems:0};
  let tierWeightSum = {safety:0, structural:0, systems:0};
  let confTotal=0, confCount=0;
  let verifiedSystemCount=0, inferredCount=0, ownerCount=0;
  let freshnessSum=0, freshnessCount=0;
  const breakdown=[];
  const plausibilityFlags=[];

  systems.forEach(sys=>{
    const base      = scoreSystem(sys);
    const decayed   = sys.monthsAgo != null ? decayedScore(base, sys.monthsAgo, sys.key, 55) : base;
    const climateAdj= CLIMATE_ADJ[sys.key] || 0;
    let verifiedScore = Math.max(0, Math.min(100, decayed + climateAdj));

    // Apply Hard Flag score caps
    const sysFlags = activeFlags.filter(f => {
      const flagDef = HARD_FLAGS[f];
      return flagDef && flagDef.sys === sys.key && flagDef.scoreCap !== null;
    });
    if(sysFlags.length > 0){
      const minCap = Math.min(...sysFlags.map(f => HARD_FLAGS[f].scoreCap));
      verifiedScore = Math.min(verifiedScore, minCap);
    }

    const tier = SYS_TIER[sys.key] || 'systems';
    const weight = SYS_WEIGHTS[sys.key] || 0;
    const freshState = sys.monthsAgo != null ? getFreshnessState(sys.monthsAgo, sys.key) : 'stale';
    const fm = sys.monthsAgo != null ? freshnessMult(sys.monthsAgo, sys.key) : 0.4;
    const util = sys.age / (sys.expectedLife || 20);
    const horizon = getReplacementHorizon(util, sys.condition);

    if(['inspector','permit','provider','document'].includes(sys.source)) verifiedSystemCount++;
    else if(sys.source==='inferred') inferredCount++;
    else ownerCount++;

    freshnessSum += FRESHNESS_MULTIPLIER[freshState]; freshnessCount++;

    // Owner update with Major Improvement Bonus
    const ownerUp = ownerUpdates.find(u=>u.sysKey===sys.key);
    let ownerDelta=0, plausFlag=null;
    if(ownerUp){
      // Check for Major Improvement Bonus
      const mib = MAJOR_IMPROVEMENT_BONUS[sys.key];
      if(mib && ownerUp.isMajorReplacement){
        const bonusPts = mib[ownerUp.evidence] || mib.receipt || 0;
        ownerDelta = bonusPts;
      } else {
        const gate = plausibilityGate(ownerUp, verifiedScore);
        ownerDelta = Math.max(0, Math.round(gate.delta * 10)/10);
        plausFlag  = gate;
        if(gate.flag) plausibilityFlags.push({sysKey:sys.key, name:sys.name, ...gate});
      }
    }

    const conf = CONFIDENCE_FACTOR[sys.source || 'inferred'];
    tierScores[tier]     += verifiedScore * weight;
    tierWeightSum[tier]  += weight;
    confTotal += conf * fm;
    confCount++;

    breakdown.push({
      ...sys, base, decayed, verifiedScore, ownerDelta, freshState, freshnessMult:fm,
      finalScore: Math.round(verifiedScore + ownerDelta),
      climateAdj, weight, tier, horizon, plausFlag,
    });
  });

  // Maintenance behavior
  tierScores.systems += maintenanceBehavior * (SYS_WEIGHTS.maintenance || 0.10);
  tierWeightSum.systems += SYS_WEIGHTS.maintenance;

  // Normalize each tier score
  const normalizedTier = {
    safety:     tierWeightSum.safety > 0     ? tierScores.safety / tierWeightSum.safety : 50,
    structural: tierWeightSum.structural > 0 ? tierScores.structural / tierWeightSum.structural : 50,
    systems:    tierWeightSum.systems > 0    ? tierScores.systems / tierWeightSum.systems : 50,
  };

  // Composite VIS
  let vis = Math.round(
    normalizedTier.safety    * TIER_WEIGHTS.safety +
    normalizedTier.structural * TIER_WEIGHTS.structural +
    normalizedTier.systems   * TIER_WEIGHTS.systems
  );

  // Hard Flag floors on composite VIS
  if(activeFlags.length > 0){
    const criticalFlags = activeFlags.filter(f => HARD_FLAGS[f]?.severity === 'critical');
    const highCritical  = activeFlags.filter(f => ['fpe_zinsco','foundation_move','active_water','friable_asbestos','active_mold'].includes(f));
    if(highCritical.length > 0) vis = Math.min(vis, 50);
    else if(criticalFlags.length > 0) vis = Math.min(vis, 65);
  }

  // Owner boost (all systems)
  const ownerTotal = breakdown.reduce((sum, s) => sum + (s.ownerDelta * s.weight), 0);
  const ownerBoost = Math.round(ownerTotal * 0.25 * 100) / 10;
  const oes = Math.min(100, Math.round(vis + ownerBoost));

  // Confidence
  const verifCoverage = Math.round((verifiedSystemCount / systems.length) * 100);
  const avgFreshness = freshnessCount > 0 ? freshnessSum / freshnessCount : 0.5;
  const avgConf = confCount > 0 ? confTotal / confCount : 50;
  const inferredRatio = inferredCount / systems.length;
  const confScore = avgConf * (1 - inferredRatio*0.3) * avgFreshness;
  const confLabel = confScore>=70?'High':confScore>=52?'Moderate':confScore>=38?'Limited':'Low';
  const confColor = confScore>=70?'#2D6A4F':confScore>=52?'#C9963A':confScore>=38?'#D97706':'#C0392B';

  return {
    vis, oes, ownerBoost, breakdown,
    confLabel, confColor, confScore,
    normalizedTier,
    trajectory: 'improving', trajectoryDelta: +4,
    anomaly: plausibilityFlags.some(f=>f.tier>=2),
    plausibilityFlags, activeFlags,
    maintenanceBehavior,
    verifiedSystemCount, inferredCount, ownerCount, verifCoverage, avgFreshness,
    systems
  };
}

// ── Property data (v2.1 — 15 systems) ────────────────────────────────────────
var HOME_SYSTEMS_RAW = [
  {key:'foundation',     name:'Foundation & Structure', icon:'foundation', age:21, expectedLife:80,  condition:'fair',    maintenanceRate:0.60, event:'moderate',       source:'inspector',  monthsAgo:6},
  {key:'structural',     name:'Structural Framing',     icon:'list',       age:21, expectedLife:80,  condition:'good',    maintenanceRate:0.70, event:'none',           source:'inspector',  monthsAgo:6},
  {key:'roof',           name:'Roof',                   icon:'roof',       age:21, expectedLife:25,  condition:'fair',    maintenanceRate:0.60, event:'moderate',       source:'inspector',  monthsAgo:6},
  {key:'electrical',     name:'Electrical',             icon:'electrical', age:21, expectedLife:40,  condition:'fair',    maintenanceRate:0.50, event:'moderate',       source:'inspector',  monthsAgo:6},
  {key:'plumbing',       name:'Plumbing',               icon:'plumbing',   age:21, expectedLife:50,  condition:'good',    maintenanceRate:0.70, event:'none',           source:'provider',   monthsAgo:14},
  {key:'hvac',           name:'HVAC',                   icon:'hvac',       age:9,  expectedLife:15,  condition:'good',    maintenanceRate:0.80, event:'none',           source:'inspector',  monthsAgo:6},
  {key:'water_intrusion',name:'Water Intrusion',        icon:'water',      age:21, expectedLife:99,  condition:'fair',    maintenanceRate:0.55, event:'minor_resolved', source:'inspector',  monthsAgo:6},
  {key:'windows_doors',  name:'Windows & Doors',        icon:'exterior',   age:21, expectedLife:25,  condition:'fair',    maintenanceRate:0.40, event:'moderate',       source:'inspector',  monthsAgo:6},
  {key:'exterior',       name:'Exterior & Envelope',    icon:'exterior',   age:21, expectedLife:30,  condition:'good',    maintenanceRate:0.65, event:'minor_resolved', source:'owner',      monthsAgo:3},
  {key:'attic',          name:'Attic & Insulation',     icon:'home',       age:21, expectedLife:40,  condition:'good',    maintenanceRate:0.65, event:'none',           source:'inspector',  monthsAgo:6},
  {key:'basement',       name:'Basement / Crawlspace',  icon:'list',       age:21, expectedLife:60,  condition:'fair',    maintenanceRate:0.55, event:'minor_resolved', source:'inspector',  monthsAgo:6},
  {key:'interior',       name:'Interior Finishes',      icon:'home',       age:21, expectedLife:30,  condition:'fair',    maintenanceRate:0.60, event:'none',           source:'owner',      monthsAgo:3},
  {key:'environmental',  name:'Environmental Hazards',  icon:'bell',       age:21, expectedLife:99,  condition:'good',    maintenanceRate:0.80, event:'none',           source:'inspector',  monthsAgo:6},
  {key:'garage',         name:'Garage',                 icon:'home',       age:21, expectedLife:40,  condition:'good',    maintenanceRate:0.70, event:'none',           source:'inspector',  monthsAgo:6},
  {key:'appliances',     name:'Appliances',             icon:'wrench',     age:9,  expectedLife:15,  condition:'fair',    maintenanceRate:0.55, event:'none',           source:'owner',      monthsAgo:8},
];

var OWNER_UPDATES_RAW = [
  {sysKey:'hvac',         claimedScore:88, evidence:'receipt',  note:'Replaced filter + annual tune-up, April 2025', date:'Apr 2025'},
  {sysKey:'exterior',     claimedScore:78, evidence:'photo',    note:'Repainted front siding, touched up caulking',  date:'Mar 2025'},
  {sysKey:'plumbing',     claimedScore:80, evidence:'owner',    note:'No issues observed, drains running well',      date:'Feb 2025'},
];

// Active Hard Flags for this property
var ACTIVE_FLAGS_RAW = [];

var SCORE_RESULT = computeHomeScore(HOME_SYSTEMS_RAW, OWNER_UPDATES_RAW, 79, ACTIVE_FLAGS_RAW);

// ── Snapshot / Property Data ─────────────────────────────────────
var SNAPSHOT_DATA = {
  address: "142 Maple Ridge Drive",
  city: "Allentown, PA 18104",
  built: 2004, sqft: "2,847", beds: 4, baths: 2.5,
  score: 72,
  fiveYearCost: 13400,
  tenYearCost: 38200,
  systems: [
    {name:"Roof",          icon:"roof",      installed:2004, lifespan:25, status:"attention", risk:"medium", nextWindow:"2027–2029", replaceCost:"$11K–$15K"},
    {name:"HVAC System",   icon:"hvac",      installed:2016, lifespan:15, status:"good",      risk:"low",    nextWindow:"2030–2032", replaceCost:"$7K–$9K"},
    {name:"Water Heater",  icon:"water",     installed:2018, lifespan:12, status:"urgent",    risk:"high",   nextWindow:"2025–2026", replaceCost:"$900–$1,800"},
    {name:"Electrical",    icon:"electrical",installed:2004, lifespan:40, status:"attention", risk:"medium", nextWindow:"Inspect now", replaceCost:"$150–$4,500"},
    {name:"Plumbing",      icon:"plumbing",  installed:2004, lifespan:40, status:"good",      risk:"low",    nextWindow:"2026 inspection", replaceCost:"$200–$600"},
    {name:"Exterior",      icon:"exterior",  installed:2004, lifespan:30, status:"good",      risk:"low",    nextWindow:"2027–2029", replaceCost:"$2,500–$5K"},
    {name:"Landscaping",   icon:"landscape", installed:2004, lifespan:99, status:"attention", risk:"low",    nextWindow:"This spring", replaceCost:"$80–$400/yr"},
  ],
  actions: [
    {text:"Replace HVAC filter — overdue",    urgency:"now"},
    {text:"Water heater flush — this month",  urgency:"now"},
    {text:"Spring lawn pre-emergent — this week", urgency:"soon"},
    {text:"Schedule panel inspection",        urgency:"soon"},
    {text:"Clean gutters before summer",      urgency:"soon"},
  ],
  flags: [
    {label:"Water Heater",  note:"At 9/12 years — replacement likely within 18 months", color:C.red},
    {label:"Roof",          note:"Entering repair window by 2027. Inspect this year.", color:C.amber},
    {label:"Electrical",    note:"Panel inspection overdue. Required by most insurers.", color:C.amber},
  ]
};
