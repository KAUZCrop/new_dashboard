// ────────────────────────────────────────────────────────────
//  Data Layer
//
//  - Loads data from Google Sheets API (when CONFIG.SHEET_ID + API_KEY are set)
//  - Falls back to deterministic mock data when not configured
//  - Exposes aggregation helpers used by the dashboard
//
//  Public API:
//    window.DASH.load(config)  → Promise<void>  (populates window.DASH.ROWS)
//    window.DASH.totals(rows), .byDay, .byMedia, .byCampaign, .byDevice
//    window.DASH.prevPeriodRows(rows)
//    window.DASH.fmt
//    window.DASH.MEDIA, .CAMPAIGNS, .DEVICES, .ROWS, .isMock
// ────────────────────────────────────────────────────────────

const MEDIA_DEFAULT = [
  { key: "NVR_SA", label: "네이버 S/A", short: "NVR-SA" },
  { key: "NVR_DA", label: "네이버 D/A", short: "NVR-DA" },
  { key: "KKO_SA", label: "카카오 S/A", short: "KKO-SA" },
  { key: "KKO_DA", label: "카카오 모먼트", short: "KKO-MT" },
  { key: "GOO_SA", label: "구글 검색", short: "GGL-SA" },
  { key: "GDN",    label: "GDN",       short: "GDN"    },
  { key: "META",   label: "Meta",      short: "META"   },
  { key: "YT",     label: "YouTube",   short: "YT"     },
  { key: "TIK",    label: "TikTok",    short: "TIK"    },
];
const CAMPAIGNS_DEFAULT = [
  { key: "BR_MAIN",   label: "대표 All",         media: ["NVR_SA","GOO_SA"] },
  { key: "BR_BRAND",  label: "자사명 All",       media: ["NVR_SA","GOO_SA","KKO_SA"] },
  { key: "PR_NEW",    label: "신상품 5월",        media: ["META","YT","GDN","KKO_DA"] },
  { key: "PR_BEST",   label: "베스트셀러",        media: ["NVR_DA","META","TIK"] },
  { key: "RE_RT",     label: "리타겟팅",         media: ["GDN","META","KKO_DA"] },
  { key: "RE_LAL",    label: "LAL 확장",         media: ["META","TIK","YT"] },
  { key: "EV_MAY",    label: "가정의달 프로모션", media: ["NVR_DA","KKO_DA","META","YT"] },
];
const DEVICES = ["PC", "MO"];

// ─── helpers ──────────────────────────────────────────────
function rng(seed){ let s = seed; return () => { s = (s*9301+49297) % 233280; return s/233280; }; }
function sum(arr, k){ return arr.reduce((a,r)=>a+(r[k]||0), 0); }

// ─── mock data generator (used when no sheet configured) ──
function buildMockRows(){
  const rows = [];
  const start = new Date(); start.setDate(start.getDate() - 56);
  const days = 56;
  let id = 0;
  for (let d = 0; d < days; d++){
    const date = new Date(start); date.setDate(start.getDate() + d);
    const dayStr = date.toISOString().slice(0,10).replace(/-/g, ".");
    const week = `${date.getMonth()+1}월 ${Math.ceil((date.getDate())/7)}주차`;
    for (const camp of CAMPAIGNS_DEFAULT){
      for (const mediaKey of camp.media){
        for (const dev of DEVICES){
          const r = rng(id*31 + d*7 + camp.key.length + mediaKey.length + (dev==="PC"?1:2));
          const mediaWeight = {NVR_SA:1.2,GOO_SA:1.0,NVR_DA:1.8,KKO_DA:1.6,META:2.2,YT:1.4,GDN:1.5,KKO_SA:0.9,TIK:1.7}[mediaKey] || 1;
          const devWeight = dev==="MO"?1.6:1.0;
          const campWeight = {BR_MAIN:1.4,BR_BRAND:0.7,PR_NEW:1.6,PR_BEST:1.3,RE_RT:0.6,RE_LAL:1.1,EV_MAY:1.9}[camp.key] || 1;
          const dayOfWeek = date.getDay();
          const weekendBoost = (dayOfWeek===0||dayOfWeek===6)?1.25:1.0;
          const recencyBoost = d > days-14 ? 1.3 : 1.0;
          const base = 1800 * mediaWeight * devWeight * campWeight * weekendBoost * recencyBoost;
          const impressions = Math.round(base * (0.6 + r()*0.8));
          const ctr = (mediaKey==="NVR_SA"||mediaKey==="GOO_SA") ? 0.045+r()*0.04 : 0.008+r()*0.018;
          const clicks = Math.round(impressions * ctr);
          const cpc = (mediaKey==="NVR_SA"||mediaKey==="GOO_SA"||mediaKey==="KKO_SA") ? 480+r()*420 : 180+r()*240;
          const cost = Math.round(clicks * cpc);
          const cvr = camp.key==="BR_BRAND" ? 0.09+r()*0.06 : camp.key==="RE_RT" ? 0.08+r()*0.05 : 0.012+r()*0.025;
          const conversions = Math.round(clicks * cvr);
          const aov = 38000 + r()*42000;
          const revenue = Math.round(conversions * aov);
          rows.push({
            id: id++, date: dayStr, week,
            media: mediaKey, mediaLabel: MEDIA_DEFAULT.find(m=>m.key===mediaKey).label,
            campaign: camp.key, campaignLabel: camp.label,
            adGroup: `${camp.label} / ${dev}`,
            device: dev, impressions, clicks, cost, conversions, revenue,
          });
        }
      }
    }
  }
  return rows;
}

// ─── Column auto-detection ───────────────────────────────
const COLUMN_KEYWORDS = {
  week:        ["주차", "week", "주"],
  date:        ["날짜", "date", "일자", "일"],
  media:       ["매체", "media", "채널", "channel", "플랫폼", "platform", "매체명"],
  campaign:    ["캠페인", "campaign", "캠페인명"],
  adGroup:     ["광고그룹", "adgroup", "ad_group", "ad group", "그룹", "광고그룹명"],
  device:      ["기기", "device", "디바이스"],
  impressions: ["노출수", "노출", "impression", "impressions", "imp", "노출량"],
  clicks:      ["클릭수", "클릭", "click", "clicks"],
  cost:        ["비용", "cost", "광고비", "지출", "spend", "금액", "집행금액", "소진금액"],
  conversions: ["전환수", "전환", "conversion", "conversions", "conv", "전환량"],
  revenue:     ["매출", "revenue", "수익", "매출액", "전환매출"],
  goalType:    ["목표유형", "목표 유형", "캠페인유형", "캠페인 유형", "목표타입", "goal_type", "goaltype", "campaign_type"],
};

// autoDetect returns { field: columnIndex } directly — avoids double-lookup encoding issues
function autoDetectColumnIndices(headers, manualColNames) {
  const idx = {};
  const usedIdx = new Set();

  // manual overrides first (field → headerName string → index)
  for (const [field, headerName] of Object.entries(manualColNames || {})) {
    const i = headers.findIndex(h => String(h).trim() === String(headerName).trim());
    if (i >= 0 && !usedIdx.has(i)) { idx[field] = i; usedIdx.add(i); }
  }

  // auto-detect for remaining fields
  for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS)) {
    if (field in idx) continue;
    for (const kw of keywords) {
      const i = headers.findIndex(h => {
        const norm = String(h).trim().toLowerCase().replace(/\s+/g, "");
        const k = kw.toLowerCase().replace(/\s+/g, "");
        return norm === k || norm.includes(k);
      });
      if (i >= 0 && !usedIdx.has(i)) { idx[field] = i; usedIdx.add(i); break; }
    }
  }

  // log for debugging
  const nameMap = {};
  for (const [f, i] of Object.entries(idx)) nameMap[f] = `[${i}] ${headers[i]}`;
  console.info("[DASH] 컬럼 인덱스 →", nameMap);
  return idx;
}

// ─── Google Sheets loader ─────────────────────────────────
async function loadFromSheets(config){
  const { SHEET_ID, RANGE, API_KEY, COLUMNS } = config;
  if (!SHEET_ID || !API_KEY) throw new Error("SHEET_ID and API_KEY are required");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE || "A:Z")}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  const { values } = await res.json();
  if (!values || values.length < 2) throw new Error("Sheet has no data rows");
  const headers = values[0];
  console.info("[DASH] 시트 헤더:", headers);

  const manualCols = COLUMNS && Object.keys(COLUMNS).length ? COLUMNS : {};
  const idx = autoDetectColumnIndices(headers, manualCols);
  window.DASH.detectedColumns = { idx, headers };

  const numericField = k => ["impressions","clicks","cost","conversions","revenue"].includes(k);
  const rows = values.slice(1).filter(r => r.length).map((r, i) => {
    const row = { id: i };
    for (const [field, colIdx] of Object.entries(idx)){
      let v = r[colIdx];
      if (v == null) v = numericField(field) ? 0 : "";
      if (numericField(field)) v = Number(String(v).replace(/[^\d.-]/g,"")) || 0;
      row[field] = v;
    }
    row.mediaLabel = row.media;
    row.campaignLabel = row.campaign;
    return row;
  });
  console.info("[DASH] 파싱된 첫 3행:", rows.slice(0, 3));
  console.info("[DASH] 시트 2행 원본값:", values[1]);
  if (rows[0]) console.info("[DASH] 첫 행 숫자필드:", {
    impressions: rows[0].impressions,
    clicks: rows[0].clicks,
    cost: rows[0].cost,
    conversions: rows[0].conversions,
  });
  // derive unique media + campaign lists from the data
  const seenMedia = new Map(), seenCamp = new Map();
  rows.forEach(r => {
    if (r.media && !seenMedia.has(r.media)) seenMedia.set(r.media, { key:r.media, label:r.media, short:r.media });
    if (r.campaign && !seenCamp.has(r.campaign)) seenCamp.set(r.campaign, { key:r.campaign, label:r.campaign });
  });
  return {
    rows,
    media: [...seenMedia.values()],
    campaigns: [...seenCamp.values()],
  };
}

// ─── Google Drive — creatives ─────────────────────────────
async function loadDriveCreatives(config){
  const { GDRIVE_FOLDER_ID, API_KEY } = config;
  if (!GDRIVE_FOLDER_ID || !API_KEY) return null;
  const q = `'${GDRIVE_FOLDER_ID}' in parents and mimeType contains 'image/' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,modifiedTime)&pageSize=100&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive API ${res.status}`);
  const { files } = await res.json();
  return (files || []).map(f => ({
    id: f.id,
    name: f.name.replace(/\.[^.]+$/, ""),
    thumbs: [`https://drive.google.com/thumbnail?id=${f.id}&sz=w400`],
    full:   `https://drive.google.com/thumbnail?id=${f.id}&sz=w1200`,
    href:   `https://drive.google.com/file/d/${f.id}/view`,
    // try to parse [CAMPAIGN_KEY][MEDIA_KEY][DEVICE]_vN pattern
    ...parseCreativeName(f.name),
    mediaLabel: undefined, // set after parse by lookup
    createdTime: f.createdTime,
  }));
}
function parseCreativeName(name){
  // matches [PR_NEW][META][MO]_v3.png  →  { campaign, media, device, version }
  const m = String(name).match(/\[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]_?v?(\d+)?/i);
  if (!m) return {};
  return { campaign: m[1], media: m[2], device: m[3], version: m[4] ? "v"+m[4] : undefined };
}
function buildMockCreatives(){
  const palettes = [
    ["#C2410C","#FBBF24"],["#1D4ED8","#60A5FA"],["#15803D","#84CC16"],
    ["#7E22CE","#F472B6"],["#0E7490","#22D3EE"],["#B91C1C","#FCA5A5"],
    ["#A16207","#FDE68A"],["#0F766E","#5EEAD4"],["#9333EA","#DDD6FE"],
  ];
  const out = [];
  let id = 0;
  // synthetic P.MAX-style bundle row (multi-thumbnail, no per-creative breakdown)
  {
    const thumbs = [];
    for (let i=0; i<6; i++) thumbs.push(makeMockThumb(palettes[i%palettes.length], "실적 최대화", "P.MAX"));
    out.push({
      id: `bundle-pmax`,
      name: "피맥스",
      mediaLabel: "B. 실적최대화",
      media: "PMAX", campaign: "PMAX", device: "MO",
      thumbs, bundle: true,
      impressions: 530642, clicks: 9108, cost: 3774574,
      mediaConv: 56, gaConv: 0,
      revenue: 14820000,
    });
  }
  const creativeNames = ["analysis_3","메타_빌스_분원","메타_빌스_학생부","slide_3","story_v2","carousel_1","video_short","banner_a","feed_v4","static_v1","reels_v2","native_v3"];
  let nameIdx = 0;
  for (const camp of CAMPAIGNS_DEFAULT) {
    for (const mediaKey of camp.media.slice(0, 2)) {
      const palette = palettes[id % palettes.length];
      const mediaLabel = (MEDIA_DEFAULT.find(m=>m.key===mediaKey)?.label) || mediaKey;
      const r1 = rng(id*17+3)();
      const r2 = rng(id*23+7)();
      const impressions = Math.round(20000 + r1*60000);
      const ctr = 0.008 + r2*0.025;
      const clicks = Math.round(impressions * ctr);
      const cpc = 200 + r1*1200;
      const cost = Math.round(clicks * cpc);
      const conv = Math.round(clicks * (0.012 + r2*0.07));
      out.push({
        id: `mock-${id}`,
        name: creativeNames[nameIdx++ % creativeNames.length],
        mediaLabel,
        media: mediaKey, campaign: camp.key, device: "MO",
        thumbs: [makeMockThumb(palette, camp.label, mediaKey)],
        impressions, clicks, cost,
        mediaConv: conv,
        gaConv: Math.round(conv * (0.55 + r2*0.35)),
        revenue: Math.round(cost * (1.5 + r1*3.5)),
      });
      id++;
    }
  }
  return out;
}
function makeMockThumb([c1, c2], camp, media, large){
  const w = large ? 800 : 400, h = large ? 600 : 300;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>
    </linearGradient></defs>
    <rect width='${w}' height='${h}' fill='url(#g)'/>
    <circle cx='${w*0.7}' cy='${h*0.35}' r='${h*0.3}' fill='white' fill-opacity='0.18'/>
    <rect x='${w*0.12}' y='${h*0.65}' width='${w*0.55}' height='${h*0.06}' fill='white' fill-opacity='0.65' rx='3'/>
    <rect x='${w*0.12}' y='${h*0.74}' width='${w*0.35}' height='${h*0.04}' fill='white' fill-opacity='0.45' rx='3'/>
    <text x='${w*0.12}' y='${h*0.22}' fill='white' fill-opacity='0.95' font-family='sans-serif' font-size='${h*0.075}' font-weight='700'>${camp}</text>
    <text x='${w*0.12}' y='${h*0.32}' fill='white' fill-opacity='0.7' font-family='monospace' font-size='${h*0.045}' letter-spacing='2'>${media}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

async function loadCreatives(config){
  const D = window.DASH;
  if (config.GDRIVE_FOLDER_ID && config.API_KEY) {
    try {
      const items = await loadDriveCreatives(config);
      D.CREATIVES = items;
      D.creativesAreMock = false;
      D.creativesSource = `Google Drive · ${items.length}개 소재`;
      return;
    } catch (err) {
      console.warn("[DASH] Drive load failed:", err.message);
      D.creativesLoadError = err.message;
    }
  }
  D.CREATIVES = buildMockCreatives();
  D.creativesAreMock = true;
  D.creativesSource = "샘플 소재";
}

// ─── aggregation helpers ──────────────────────────────────
function derive(r){
  return {
    ...r,
    ctr: r.impressions ? r.clicks/r.impressions : 0,
    cpc: r.clicks ? r.cost/r.clicks : 0,
    cpa: r.conversions ? r.cost/r.conversions : 0,
    roas: r.cost ? r.revenue/r.cost : 0,
  };
}
function totals(rows){
  const impressions = sum(rows,"impressions");
  const clicks = sum(rows,"clicks");
  const cost = sum(rows,"cost");
  const conversions = sum(rows,"conversions");
  const revenue = sum(rows,"revenue");
  return {
    impressions, clicks, cost, conversions, revenue,
    ctr: clicks/Math.max(impressions,1),
    cpc: cost/Math.max(clicks,1),
    cpa: cost/Math.max(conversions,1),
    roas: revenue/Math.max(cost,1),
  };
}
function groupBy(rows, key){
  const map = new Map();
  for (const r of rows){
    const k = r[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}
function byDay(rows){
  const m = groupBy(rows, "date");
  return [...m.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date, rs]) => ({ date, ...totals(rs) }));
}
function parseDate(s){ return new Date(String(s).replace(/\./g,"-")); }
function isoWeekKey(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
function monthWeekKey(date){
  // Korean convention: "M월 N주차" where N = ceil(day/7)
  const m = date.getMonth()+1;
  const w = Math.ceil(date.getDate()/7);
  return `${m}월 ${w}주차`;
}
function byWeek(rows){
  const groups = new Map();
  for (const r of rows){
    // prefer the row's own week label (sheet column) for fidelity
    const key = r.week || monthWeekKey(parseDate(r.date));
    if (!groups.has(key)) groups.set(key, { rows:[], firstDate:r.date });
    const g = groups.get(key);
    g.rows.push(r);
    if (r.date < g.firstDate) g.firstDate = r.date;
  }
  return [...groups.entries()]
    .sort(([,a],[,b]) => a.firstDate.localeCompare(b.firstDate))
    .map(([k, g]) => ({ date:g.firstDate, label:k, ...totals(g.rows) }));
}
function byMonth(rows){
  const groups = new Map();
  for (const r of rows){
    const k = r.date.slice(0,7); // YYYY.MM
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k, rs]) => ({ date:k, label:k, ...totals(rs) }));
}
function byMedia(rows){
  const m = groupBy(rows, "media");
  return [...m.entries()].map(([k, rs]) => ({ key:k, label: window.DASH.MEDIA.find(x=>x.key===k)?.label || k, short: window.DASH.MEDIA.find(x=>x.key===k)?.short || k, ...totals(rs) }))
    .sort((a,b)=>b.cost-a.cost);
}
function byCampaign(rows){
  const m = groupBy(rows, "campaign");
  return [...m.entries()].map(([k, rs]) => ({ key:k, label: window.DASH.CAMPAIGNS.find(x=>x.key===k)?.label || k, ...totals(rs) }))
    .sort((a,b)=>b.revenue-a.revenue);
}
function byDevice(rows){
  const m = groupBy(rows, "device");
  return [...m.entries()].map(([k, rs]) => ({ key:k, label:k==="PC"?"PC":"Mobile", ...totals(rs) }));
}
function prevPeriodRows(rows){
  if (!rows.length) return [];
  const dates = [...new Set(rows.map(r=>r.date))].sort();
  const span = dates.length;
  const earliest = dates[0];
  const earliestDate = new Date(earliest.replace(/\./g,"-"));
  const prevEnd = new Date(earliestDate); prevEnd.setDate(prevEnd.getDate()-1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate()-(span-1));
  const prevStartStr = prevStart.toISOString().slice(0,10).replace(/-/g,".");
  const prevEndStr   = prevEnd.toISOString().slice(0,10).replace(/-/g,".");
  return window.DASH.ROWS.filter(r => r.date >= prevStartStr && r.date <= prevEndStr);
}

// ─── formatters ───────────────────────────────────────────
const fmt = {
  int: n => Math.round(n).toLocaleString("ko-KR"),
  krw: n => "₩" + Math.round(n).toLocaleString("ko-KR"),
  krwShort: n => {
    if (n >= 1e8) return (n/1e8).toFixed(2)+"억";
    if (n >= 1e4) return (n/1e4).toFixed(1)+"만";
    return Math.round(n).toLocaleString("ko-KR");
  },
  intShort: n => {
    if (n >= 1e8) return (n/1e8).toFixed(2)+"억";
    if (n >= 1e6) return (n/1e6).toFixed(2)+"M";
    if (n >= 1e3) return (n/1e3).toFixed(1)+"K";
    return Math.round(n).toLocaleString();
  },
  pct: n => (n*100).toFixed(2)+"%",
  pct1: n => (n*100).toFixed(1)+"%",
  mult: n => n.toFixed(2)+"×",
  date: s => s ? s.slice(5).replace(".","/") : "",
};

// ─── public load() ────────────────────────────────────────
async function load(config = {}){
  const D = window.DASH;
  D.MEDIA = MEDIA_DEFAULT.slice();
  D.CAMPAIGNS = CAMPAIGNS_DEFAULT.slice();
  D.DEVICES = DEVICES.slice();

  if (config.SHEET_ID && config.API_KEY) {
    try {
      const { rows, media, campaigns } = await loadFromSheets(config);
      if (media.length)     D.MEDIA = media;
      if (campaigns.length) D.CAMPAIGNS = campaigns;
      D.ROWS = rows;
      D.isMock = false;
      D.source = `Google Sheets · ${config.RANGE || "A:Z"} · ${rows.length}행`;
    } catch (err) {
      console.warn("[DASH] Sheets load failed:", err.message);
      D.loadError = err.message;
      D.ROWS = [];  // API 설정이 있으면 샘플 데이터 대신 빈 데이터
      D.isMock = false;
      D.source = "연결 실패";
    }
  } else {
    D.ROWS = buildMockRows();
    D.isMock = true;
    D.source = "샘플 데이터 (SHEET_ID와 API_KEY를 설정하세요)";
  }
  // creatives (Drive)
  await loadCreatives(config);
}

const _hasCredentials = !!(window.CONFIG?.SHEET_ID && window.CONFIG?.API_KEY);
window.DASH = {
  MEDIA: MEDIA_DEFAULT, CAMPAIGNS: CAMPAIGNS_DEFAULT, DEVICES,
  ROWS: _hasCredentials ? [] : buildMockRows(),
  CREATIVES: buildMockCreatives(),
  isMock: !_hasCredentials, source: _hasCredentials ? "불러오는 중…" : "샘플 데이터", loadError: null,
  creativesAreMock: true, creativesSource: "샘플 소재", creativesLoadError: null,
  // api
  load, totals, byDay, byWeek, byMonth, byMedia, byCampaign, byDevice, prevPeriodRows, fmt,
};
