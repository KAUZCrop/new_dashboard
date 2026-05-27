// ────────────────────────────────────────────────────────────
//  Terminal Dashboard (Classic White)
//
//  Layout (top → bottom, page is scrollable):
//    HEADER · period + comparison toggle + sync
//    GRANULARITY TABS  ·  일별 / 주별 / 월별
//    CAMPAIGN CHIPS
//    KPI STRIP (8 cells)
//    [01] LINE CHART  ·  switchable metric (매출&비용 / 전환 / CVR / ROAS)
//    [02] BY MEDIA   [03] BY CAMPAIGN   [04] BY DEVICE
//    [05] CREATIVE REPORT (Google Drive)
//    [06] TOP AD-GROUPS table
// ────────────────────────────────────────────────────────────

const TerminalTheme = {
  bg:       "#FAFAF5",
  panel:    "#FFFFFF",
  panelHi:  "#F2EFE6",
  border:   "#D8D5CC",
  fg:       "#1A1A1A",
  muted:    "#6B665C",
  faint:    "#A39E94",
  accent:   "#C2410C",
  green:    "#15803D",
  red:      "#B91C1C",
  blue:     "#1D4ED8",
  magenta:  "#7E22CE",
  cyan:     "#0E7490",
  accents:  ["#C2410C","#1D4ED8","#15803D","#7E22CE","#B91C1C","#0E7490","#1A1A1A","#A16207","#0F766E"],
  grid:     "#ECEAE3",
  font:     "'IBM Plex Sans', 'Pretendard', system-ui, sans-serif",
  monoFont: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
};

function TerminalDashboard(){
  const D = window.DASH;
  const [periodDays, setPeriodDays] = React.useState(28);
  const [comparison, setComparison]   = React.useState(true);
  const [activeCampaign, setCamp]     = React.useState("ALL");
  const [granularity, setGranularity] = React.useState("day");  // day | week | month
  const [chartMetric, setChartMetric] = React.useState("rev_cost"); // rev_cost | conv | cvr | roas
  const [focusedCreative, setFocusedCreative] = React.useState(null);
  // Multi-select slicers: empty Set = 전체
  const [mediaSel,  setMediaSel]  = React.useState(() => new Set());
  const [deviceSel, setDeviceSel] = React.useState(() => new Set());
  const toggleSel = (setFn, set, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setFn(next);
  };

  // ─── data slicing ────────────────────────────────────────
  const allDates = React.useMemo(()=>[...new Set(D.ROWS.map(r=>r.date))].sort(), []);
  const cutoff = allDates[Math.max(0, allDates.length-periodDays)];
  const rows = React.useMemo(
    () => D.ROWS.filter(r =>
      r.date >= cutoff &&
      (activeCampaign==="ALL" || r.campaign===activeCampaign) &&
      (mediaSel.size === 0  || mediaSel.has(r.media)) &&
      (deviceSel.size === 0 || deviceSel.has(r.device))
    ),
    [periodDays, activeCampaign, mediaSel, deviceSel]
  );
  const prevRows = React.useMemo(
    () => D.prevPeriodRows(rows).filter(r =>
      (activeCampaign==="ALL" || r.campaign===activeCampaign) &&
      (mediaSel.size === 0  || mediaSel.has(r.media)) &&
      (deviceSel.size === 0 || deviceSel.has(r.device))
    ),
    [rows, activeCampaign, mediaSel, deviceSel]
  );
  const t  = D.totals(rows);
  const tp = D.totals(prevRows);

  // granularity-aware aggregation for the line chart
  const trendData = React.useMemo(() => {
    if (granularity === "week")  return D.byWeek(rows);
    if (granularity === "month") return D.byMonth(rows);
    return D.byDay(rows);
  }, [rows, granularity]);
  const trendPrev = React.useMemo(() => {
    if (granularity === "week")  return D.byWeek(prevRows);
    if (granularity === "month") return D.byMonth(prevRows);
    return D.byDay(prevRows);
  }, [prevRows, granularity]);

  const mediaAgg = D.byMedia(rows);
  const campAgg  = D.byCampaign(rows);
  const devAgg   = D.byDevice(rows);

  // campaign goal type map (ROAS / CPA) — built from all rows so it survives filtering
  const campaignGoalMap = React.useMemo(() => {
    const map = new Map();
    D.ROWS.forEach(r => {
      if (r.campaign && r.goalType && !map.has(r.campaign)) {
        const t = String(r.goalType).toUpperCase().trim();
        map.set(r.campaign, t.includes("CPA") ? "CPA" : "ROAS");
      }
    });
    return map;
  }, []);
  const isCPA = activeCampaign !== "ALL" && campaignGoalMap.get(activeCampaign) === "CPA";

  // delta helper
  const delta = (a, b) => b ? ((a-b)/b) : 0;

  // ─── KPI cards ───────────────────────────────────────────
  const dailyForSpark = D.byDay(rows); // sparklines always at day grain
  const allKpis = [
    { code:"IMP",  label:"노출",     value:D.fmt.intShort(t.impressions),  delta: delta(t.impressions, tp.impressions),  spark: dailyForSpark.map(d=>({value:d.impressions})), color: TerminalTheme.blue },
    { code:"CLK",  label:"클릭",     value:D.fmt.intShort(t.clicks),       delta: delta(t.clicks, tp.clicks),            spark: dailyForSpark.map(d=>({value:d.clicks})),      color: TerminalTheme.cyan },
    { code:"CTR",  label:"클릭률",   value:D.fmt.pct(t.ctr),               delta: delta(t.ctr, tp.ctr),                  spark: dailyForSpark.map(d=>({value:d.ctr})),         color: TerminalTheme.magenta },
    { code:"CPC",  label:"클릭당비용", value:"₩"+Math.round(t.cpc).toLocaleString(), delta: delta(t.cpc, tp.cpc),         spark: dailyForSpark.map(d=>({value:d.cpc})),         color: TerminalTheme.accent, lowerIsBetter: true },
    { code:"COV",  label:"전환",     value:D.fmt.intShort(t.conversions),  delta: delta(t.conversions, tp.conversions),  spark: dailyForSpark.map(d=>({value:d.conversions})), color: TerminalTheme.green },
    { code:"CPA",  label:"전환당비용", value:"₩"+Math.round(t.cpa).toLocaleString(), delta: delta(t.cpa, tp.cpa),         spark: dailyForSpark.map(d=>({value:d.cpa})),         color: TerminalTheme.red, lowerIsBetter: true },
    { code:"REV",  label:"매출",     value:D.fmt.krwShort(t.revenue),      delta: delta(t.revenue, tp.revenue),          spark: dailyForSpark.map(d=>({value:d.revenue})),     color: TerminalTheme.accent },
    { code:"ROAS", label:"ROAS",    value:t.roas.toFixed(2)+"×",          delta: delta(t.roas, tp.roas),                spark: dailyForSpark.map(d=>({value:d.roas})),        color: TerminalTheme.green },
  ];
  const kpis = isCPA ? allKpis.filter(k => k.code !== "REV" && k.code !== "ROAS") : allKpis;

  // ─── ad-group rollup ────────────────────────────────────
  const adGroupMap = new Map();
  rows.forEach(r => {
    const k = `${r.campaignLabel} · ${r.mediaLabel} · ${r.device}`;
    if (!adGroupMap.has(k)) adGroupMap.set(k, { key:k, campaign:r.campaignLabel, media:r.mediaLabel, device:r.device, impressions:0,clicks:0,cost:0,conversions:0,revenue:0 });
    const g = adGroupMap.get(k);
    g.impressions+=r.impressions; g.clicks+=r.clicks; g.cost+=r.cost; g.conversions+=r.conversions; g.revenue+=r.revenue;
  });
  const adGroups = [...adGroupMap.values()]
    .map(g=>({...g, ctr:g.clicks/g.impressions, cpa:g.cost/Math.max(g.conversions,1), roas:g.revenue/Math.max(g.cost,1)}))
    .sort((a,b)=>b.revenue-a.revenue).slice(0,12);

  // ─── creative rollup ────────────────────────────────────
  // Creatives may carry their own metrics (mock data, bundles); otherwise
  // we derive metrics from rows matching the creative's campaign + media.
  const creatives = (D.CREATIVES || []).map(c => {
    const hasOwnMetrics = c.impressions != null;
    let m;
    if (hasOwnMetrics) {
      m = {
        impressions: c.impressions||0,
        clicks: c.clicks||0,
        cost: c.cost||0,
        mediaConv: c.mediaConv||0,
        gaConv: c.gaConv||0,
        revenue: c.revenue||0,
      };
    } else {
      const matched = rows.filter(r => (!c.campaign || r.campaign===c.campaign) && (!c.media || r.media===c.media));
      const tot = D.totals(matched);
      m = {
        impressions: tot.impressions, clicks: tot.clicks, cost: tot.cost,
        mediaConv: tot.conversions, gaConv: Math.round(tot.conversions*0.65),
        revenue: tot.revenue,
      };
    }
    const ctr = m.impressions ? m.clicks/m.impressions : 0;
    const cpc = m.clicks ? m.cost/m.clicks : 0;
    return {
      ...c,
      thumbs: c.thumbs || (c.thumb ? [c.thumb] : []),
      ...m, ctr, cpc,
      mediaCpa: m.mediaConv ? m.cost/m.mediaConv : 0,
      mediaCvr: m.clicks    ? m.mediaConv/m.clicks : 0,
      gaCpa:    m.gaConv    ? m.cost/m.gaConv : 0,
      gaCvr:    m.clicks    ? m.gaConv/m.clicks : 0,
      roas:     m.cost      ? m.revenue/m.cost : 0,
    };
  });
  // creative totals row (sum of all creatives shown)
  const creativeTotals = creatives.reduce((a, c) => ({
    impressions: a.impressions + c.impressions,
    clicks: a.clicks + c.clicks,
    cost: a.cost + c.cost,
    mediaConv: a.mediaConv + c.mediaConv,
    gaConv: a.gaConv + c.gaConv,
    revenue: a.revenue + c.revenue,
  }), { impressions:0, clicks:0, cost:0, mediaConv:0, gaConv:0, revenue:0 });
  creativeTotals.ctr = creativeTotals.impressions ? creativeTotals.clicks/creativeTotals.impressions : 0;
  creativeTotals.cpc = creativeTotals.clicks ? creativeTotals.cost/creativeTotals.clicks : 0;
  creativeTotals.mediaCpa = creativeTotals.mediaConv ? creativeTotals.cost/creativeTotals.mediaConv : 0;
  creativeTotals.mediaCvr = creativeTotals.clicks ? creativeTotals.mediaConv/creativeTotals.clicks : 0;
  creativeTotals.gaCpa = creativeTotals.gaConv ? creativeTotals.cost/creativeTotals.gaConv : 0;
  creativeTotals.gaCvr = creativeTotals.clicks ? creativeTotals.gaConv/creativeTotals.clicks : 0;

  const S = terminalStyles;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

  // ─── chart metric configuration ──────────────────────────
  const metricConfigs = {
    rev_cost: {
      label:"매출 & 비용",
      series: [
        { name:"매출", color:TerminalTheme.green,  data: trendData.map(d=>({x:d.date, value:d.revenue})) },
        { name:"비용", color:TerminalTheme.accent, data: trendData.map(d=>({x:d.date, value:d.cost})) },
        ...(comparison ? [{ name:"매출 (전)", color:TerminalTheme.faint, data: trendPrev.map((d,i)=>({x:trendData[i]?.date||d.date, value:d.revenue})) }] : []),
      ],
      dashed: comparison?[2]:[],
    },
    conv: {
      label:"전환수",
      series: [
        { name:"전환", color:TerminalTheme.blue, data: trendData.map(d=>({x:d.date, value:d.conversions})) },
        ...(comparison ? [{ name:"전환 (전)", color:TerminalTheme.faint, data: trendPrev.map((d,i)=>({x:trendData[i]?.date||d.date, value:d.conversions})) }] : []),
      ],
      dashed: comparison?[1]:[],
    },
    cvr: {
      label:"전환율 (CVR)",
      series: [
        { name:"CVR", color:TerminalTheme.magenta, data: trendData.map(d=>({x:d.date, value: d.clicks ? d.conversions/d.clicks : 0 })) },
        ...(comparison ? [{ name:"CVR (전)", color:TerminalTheme.faint, data: trendPrev.map((d,i)=>({x:trendData[i]?.date||d.date, value: d.clicks ? d.conversions/d.clicks : 0 })) }] : []),
      ],
      dashed: comparison?[1]:[],
    },
    roas: {
      label:"ROAS",
      series: [
        { name:"ROAS", color:TerminalTheme.accent, data: trendData.map(d=>({x:d.date, value:d.roas})) },
        ...(comparison ? [{ name:"ROAS (전)", color:TerminalTheme.faint, data: trendPrev.map((d,i)=>({x:trendData[i]?.date||d.date, value:d.roas})) }] : []),
      ],
      dashed: comparison?[1]:[],
    },
  };
  const visibleMetricKeys = isCPA
    ? Object.keys(metricConfigs).filter(k => k !== "rev_cost" && k !== "roas")
    : Object.keys(metricConfigs);
  const safeChartMetric = visibleMetricKeys.includes(chartMetric) ? chartMetric : visibleMetricKeys[0];
  const currentMetric = metricConfigs[safeChartMetric];

  // ─── render ──────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerL}>
          <span style={S.brand}>◆ {(window.CONFIG?.TITLE) || "CAMPAIGN.TERM"}</span>
          <span style={S.brandSub}>{(window.CONFIG?.SUBTITLE) || "AD-PERF MONITOR"}</span>
          <span style={S.statusDot}/>
          <span style={{...S.muted, fontSize:10}}>{D.isMock ? "MOCK · " : "LIVE · "}{D.source}</span>
        </div>
        <div style={S.headerR}>
          <span style={{...S.muted, fontSize:10, marginLeft:8, fontFamily:TerminalTheme.monoFont}}>{timeStr} KST</span>
        </div>
      </div>

      {/* GRANULARITY + CAMPAIGN CHIPS */}
      <div style={S.controlBar}>
        <span style={S.stripLabel}>VIEW</span>
        <div style={S.segGroup}>
          {[{l:"일별",v:"day"},{l:"주별",v:"week"},{l:"월별",v:"month"}].map(g=>(
            <button key={g.v} style={granularity===g.v?S.segActive:S.seg} onClick={()=>setGranularity(g.v)}>{g.l}</button>
          ))}
        </div>
        <div style={S.divider}/>
        <span style={S.stripLabel}>CAMPAIGN</span>
        <div style={S.campChipsWrap}>
          <button style={activeCampaign==="ALL"?S.chipActive:S.chip} onClick={()=>setCamp("ALL")}>ALL ({D.CAMPAIGNS.length})</button>
          {D.CAMPAIGNS.map(c => (
            <button key={c.key} style={activeCampaign===c.key?S.chipActive:S.chip} onClick={()=>setCamp(c.key)}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* SLICERS: MEDIA + DEVICE */}
      <div style={S.slicerBar}>
        <span style={S.stripLabel}>매체</span>
        <div style={S.slicerChipsWrap}>
          <button style={mediaSel.size===0?S.slicerChipActive:S.slicerChip} onClick={()=>setMediaSel(new Set())}>
            <SlicerBox active={mediaSel.size===0}/> 전체
          </button>
          {D.MEDIA.map(m => {
            const on = mediaSel.has(m.key);
            return (
              <button key={m.key} style={on?S.slicerChipActive:S.slicerChip} onClick={()=>toggleSel(setMediaSel, mediaSel, m.key)}>
                <SlicerBox active={on}/> {m.label}
              </button>
            );
          })}
        </div>
        <div style={S.divider}/>
        <span style={S.stripLabel}>기기</span>
        <div style={S.slicerChipsWrap}>
          <button style={deviceSel.size===0?S.slicerChipActive:S.slicerChip} onClick={()=>setDeviceSel(new Set())}>
            <SlicerBox active={deviceSel.size===0}/> 전체
          </button>
          {D.DEVICES.map(d => {
            const on = deviceSel.has(d);
            return (
              <button key={d} style={on?S.slicerChipActive:S.slicerChip} onClick={()=>toggleSel(setDeviceSel, deviceSel, d)}>
                <SlicerBox active={on}/> {d==="PC"?"PC":"모바일"}
              </button>
            );
          })}
        </div>
        <div style={{flex:1}}/>
        <span style={S.scopePill}>{rows.length.toLocaleString()} 행 선택됨</span>
      </div>

      {/* KPI STRIP */}
      <div style={{...S.kpiRow, gridTemplateColumns:`repeat(${kpis.length},1fr)`}}>
        {kpis.map(k => {
          const goodSign = k.lowerIsBetter ? (k.delta < 0) : (k.delta > 0);
          const dColor = Math.abs(k.delta) < 0.005 ? TerminalTheme.muted : goodSign ? TerminalTheme.green : TerminalTheme.red;
          return (
            <div key={k.code} style={S.kpiCell}>
              <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between"}}>
                <span style={S.kpiCode}>{k.code}</span>
                <span style={{...S.kpiLabel, fontSize:9}}>{k.label}</span>
              </div>
              <div style={{...S.kpiValue, color:k.color}}>{k.value}</div>
              {comparison && (
                <div style={{...S.kpiDelta, color:dColor}}>
                  <span>{k.delta>=0?"▲":"▼"} {(Math.abs(k.delta)*100).toFixed(1)}%</span>
                  <span style={{color:TerminalTheme.faint, marginLeft:6}}>vs prev</span>
                </div>
              )}
              <div style={{marginTop:4}}>
                <Sparkline data={k.spark} width={180} height={22} color={k.color} fill/>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN GRID */}
      <div style={S.mainGrid}>
        {/* [01] LINE CHART */}
        <div style={{...S.panel, gridColumn:"span 12"}}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>[01] {granularity==="day"?"DAILY":granularity==="week"?"WEEKLY":"MONTHLY"} TREND · {currentMetric.label.toUpperCase()}</span>
            <div style={S.metricTabs}>
              {visibleMetricKeys.map(k => (
                <button key={k} style={safeChartMetric===k?S.metricTabActive:S.metricTab} onClick={()=>setChartMetric(k)}>{metricConfigs[k].label}</button>
              ))}
            </div>
          </div>
          <div style={{padding:"12px 16px 8px"}}>
            <LineChart
              responsive
              theme={TerminalTheme}
              width={1400} height={300}
              smooth
              showArea
              series={currentMetric.series}
              dashed={currentMetric.dashed}
            />
          </div>
          <div style={S.subStripRow}>
            <SubStrip label="PEAK" value={metricPeak(currentMetric.series[0].data, chartMetric)}/>
            <SubStrip label="평균" value={metricAvg(currentMetric.series[0].data, chartMetric)}/>
            <SubStrip label="최저" value={metricLow(currentMetric.series[0].data, chartMetric)}/>
            <SubStrip label="기간" value={`${trendData.length} ${granularity==="day"?"일":granularity==="week"?"주":"개월"}`}/>
          </div>
        </div>

        {/* [02] WEEKLY SUMMARY 주차별 요약 */}
        <div style={{...S.panel, gridColumn:"span 12"}}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>[02] WEEKLY SUMMARY · 주차별 요약</span>
            <span style={{...S.muted, fontSize:9}}>{D.byWeek(rows).length}주 · 합계 포함</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <DetailTable rows={D.byWeek(rows)} keyLabel="주차" totals={t} D={D} isCPA={isCPA}/>
          </div>
        </div>

        {/* [06] DAILY DETAIL 일자별 상세 */}
        <div style={{...S.panel, gridColumn:"span 12"}}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>[03] DAILY DETAIL · 일자별 상세</span>
            <span style={{...S.muted, fontSize:9}}>{D.byDay(rows).length}일 · 합계 포함</span>
          </div>
          <div style={{maxHeight:520, overflowY:"auto", overflowX:"auto"}}>
            <DetailTable rows={D.byDay(rows)} keyLabel="날짜" totals={t} D={D} highlightWeekend isCPA={isCPA}/>
          </div>
        </div>

        {/* [07] CREATIVE REPORT */}
        <div style={{...S.panel, gridColumn:"span 12"}}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>[07] CREATIVE · 소재별 리포트</span>
            <span style={{...S.muted, fontSize:9}}>
              {D.creativesAreMock ? "MOCK · " : "LIVE · "}{D.creativesSource}
              {D.creativesLoadError && <span style={{color:TerminalTheme.red, marginLeft:8}}>⚠ {D.creativesLoadError}</span>}
            </span>
          </div>
          <div style={{overflowX:"auto"}}>
            {creatives.length === 0 ? (
              <div style={{padding:24, color:TerminalTheme.muted, fontSize:12}}>
                연결된 소재가 없습니다. config.js의 GDRIVE_FOLDER_ID를 설정하거나 폴더 권한을 확인하세요.
              </div>
            ) : (
              <table style={S.creativeTable}>
                <thead>
                  <tr style={S.detailHeaderTopRow}>
                    <th rowSpan={2} style={{...S.creativeTh, width:110}}>매체명</th>
                    <th rowSpan={2} style={{...S.creativeTh, width:130}}>소재명</th>
                    <th rowSpan={2} style={{...S.creativeTh, minWidth:220}}>소재</th>
                    <th colSpan={5} style={{...S.creativeGroupTh, color:TerminalTheme.blue}}>광고 유입 · TRAFFIC</th>
                    <th colSpan={3} style={{...S.creativeGroupTh, color:TerminalTheme.green}}>매체 전환 · MEDIA CONV</th>
                    <th colSpan={3} style={{...S.creativeGroupTh, color:TerminalTheme.magenta}}>GA 전환 · GA CONV</th>
                  </tr>
                  <tr>
                    <th style={S.creativeThN}>노출수</th>
                    <th style={S.creativeThN}>클릭수</th>
                    <th style={S.creativeThN}>클릭률</th>
                    <th style={S.creativeThN}>CPC</th>
                    <th style={S.creativeThN}>비용</th>
                    <th style={S.creativeThN}>문의신청</th>
                    <th style={S.creativeThN}>CPA</th>
                    <th style={S.creativeThN}>전환율</th>
                    <th style={S.creativeThN}>문의신청</th>
                    <th style={S.creativeThN}>CPA</th>
                    <th style={S.creativeThN}>전환율</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 합계 row */}
                  <tr style={S.creativeTotalRow}>
                    <td colSpan={3} style={{...S.creativeTd, fontWeight:700, textAlign:"center"}}>합계</td>
                    <td style={S.creativeTdN}>{D.fmt.int(creativeTotals.impressions)}</td>
                    <td style={S.creativeTdN}>{D.fmt.int(creativeTotals.clicks)}</td>
                    <td style={{...S.creativeTdN, color:TerminalTheme.blue}}>{D.fmt.pct(creativeTotals.ctr)}</td>
                    <td style={S.creativeTdN}>₩{Math.round(creativeTotals.cpc).toLocaleString()}</td>
                    <td style={S.creativeTdN}>₩{Math.round(creativeTotals.cost).toLocaleString()}</td>
                    <td style={S.creativeTdN}>{D.fmt.int(creativeTotals.mediaConv)}</td>
                    <td style={{...S.creativeTdN, color:TerminalTheme.red}}>{creativeTotals.mediaConv?"₩"+Math.round(creativeTotals.mediaCpa).toLocaleString():"—"}</td>
                    <td style={{...S.creativeTdN, color:TerminalTheme.magenta}}>{D.fmt.pct(creativeTotals.mediaCvr)}</td>
                    <td style={S.creativeTdN}>{D.fmt.int(creativeTotals.gaConv)}</td>
                    <td style={{...S.creativeTdN, color:TerminalTheme.red}}>{creativeTotals.gaConv?"₩"+Math.round(creativeTotals.gaCpa).toLocaleString():"—"}</td>
                    <td style={{...S.creativeTdN, color:TerminalTheme.magenta}}>{creativeTotals.gaConv?D.fmt.pct(creativeTotals.gaCvr):"—"}</td>
                  </tr>
                  {creatives.map((c,i) => (
                    <tr key={c.id} style={i%2 ? S.detailTrAlt : S.detailTr}>
                      <td style={S.creativeTd}>{c.mediaLabel || c.media || "—"}</td>
                      <td style={{...S.creativeTd, fontFamily:TerminalTheme.font, fontWeight:600}}>{c.name}</td>
                      <td style={S.creativeTd}>
                        <div style={{display:"flex", gap:4, alignItems:"center", flexWrap:"wrap"}}>
                          {(c.thumbs || []).map((t, idx) => (
                            <img key={idx} src={t} alt={c.name+"_"+idx}
                              style={S.creativeRowThumb}
                              referrerPolicy="no-referrer"
                              onClick={() => setFocusedCreative({...c, focusThumb:t})}
                            />
                          ))}
                          {c.bundle && <span style={S.bundleBadge}>P.MAX · {c.thumbs.length}장</span>}
                        </div>
                      </td>
                      <td style={S.creativeTdN}>{D.fmt.int(c.impressions)}</td>
                      <td style={S.creativeTdN}>{D.fmt.int(c.clicks)}</td>
                      <td style={{...S.creativeTdN, color:TerminalTheme.blue}}>{c.impressions?D.fmt.pct(c.ctr):"—"}</td>
                      <td style={S.creativeTdN}>{c.clicks?"₩"+Math.round(c.cpc).toLocaleString():"—"}</td>
                      <td style={S.creativeTdN}>₩{Math.round(c.cost).toLocaleString()}</td>
                      <td style={S.creativeTdN}>{D.fmt.int(c.mediaConv)}</td>
                      <td style={{...S.creativeTdN, color:TerminalTheme.red}}>{c.mediaConv?"₩"+Math.round(c.mediaCpa).toLocaleString():"—"}</td>
                      <td style={{...S.creativeTdN, color:TerminalTheme.magenta}}>{c.clicks?D.fmt.pct(c.mediaCvr):"—"}</td>
                      <td style={S.creativeTdN}>{c.gaConv?D.fmt.int(c.gaConv):"—"}</td>
                      <td style={{...S.creativeTdN, color:TerminalTheme.red}}>{c.gaConv?"₩"+Math.round(c.gaCpa).toLocaleString():"—"}</td>
                      <td style={{...S.creativeTdN, color:TerminalTheme.magenta}}>{c.gaConv?D.fmt.pct(c.gaCvr):"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* [05] TOP AD-GROUPS */}
        <div style={{...S.panel, gridColumn:"span 12"}}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>[05] TOP AD-GROUPS · 성과 상위 {adGroups.length}</span>
            <span style={{...S.muted, fontSize:9}}>{isCPA ? "SORT: CPA ASC" : "SORT: REVENUE DESC"}</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{...S.th, width:32}}>#</th>
                  <th style={S.th}>CAMPAIGN</th>
                  <th style={S.th}>MEDIA</th>
                  <th style={{...S.th, width:48}}>DEV</th>
                  <th style={S.thN}>IMP</th>
                  <th style={S.thN}>CLK</th>
                  <th style={S.thN}>CTR</th>
                  <th style={S.thN}>CPC</th>
                  <th style={S.thN}>CONV</th>
                  <th style={S.thN}>CPA</th>
                  {!isCPA && <th style={S.thN}>REV</th>}
                  {!isCPA && <th style={S.thN}>ROAS</th>}
                  <th style={{...S.thN, width:90}}>TREND 7D</th>
                </tr>
              </thead>
              <tbody>
                {adGroups.map((g,i) => {
                  const gRows = rows.filter(r=>r.campaignLabel===g.campaign && r.mediaLabel===g.media && r.device===g.device);
                  const trendVal = isCPA ? d=>({value:d.cpa}) : d=>({value:d.revenue});
                  const dailyG = D.byDay(gRows).slice(-7).map(trendVal);
                  return (
                    <tr key={g.key} style={i%2?S.trAlt:S.tr}>
                      <td style={{...S.tdN, color:TerminalTheme.faint}}>{String(i+1).padStart(2,"0")}</td>
                      <td style={S.td}>{g.campaign}</td>
                      <td style={S.td}>{g.media}</td>
                      <td style={{...S.td, color:TerminalTheme.muted}}>{g.device}</td>
                      <td style={S.tdN}>{D.fmt.intShort(g.impressions)}</td>
                      <td style={S.tdN}>{D.fmt.intShort(g.clicks)}</td>
                      <td style={{...S.tdN, color:TerminalTheme.blue}}>{D.fmt.pct(g.ctr)}</td>
                      <td style={S.tdN}>₩{Math.round(g.clicks?g.cost/g.clicks:0).toLocaleString()}</td>
                      <td style={S.tdN}>{D.fmt.intShort(g.conversions)}</td>
                      <td style={{...S.tdN, color:TerminalTheme.red}}>₩{Math.round(g.cpa).toLocaleString()}</td>
                      {!isCPA && <td style={{...S.tdN, color:TerminalTheme.accent}}>{D.fmt.krwShort(g.revenue)}</td>}
                      {!isCPA && <td style={{...S.tdN, color: g.roas>3?TerminalTheme.green:TerminalTheme.red, fontWeight:600}}>{g.roas.toFixed(2)}×</td>}
                      <td style={{...S.tdN, padding:"2px 8px"}}><Sparkline data={dailyG} width={80} height={18} color={isCPA?TerminalTheme.red:TerminalTheme.accent}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={S.footer}>
        <span>{D.isMock ? "● MOCK DATA" : "● CONNECTED"}</span>
        <span>SHEET: {window.CONFIG?.RANGE || "—"}</span>
        <span>{rows.length.toLocaleString()} rows · {periodDays} days · {granularity}</span>
        <span>{D.loadError ? `⚠ ${D.loadError}` : "LAST SYNC: just now"}</span>
        <div style={{flex:1}}/>
        <span style={{color:TerminalTheme.muted}}>↑↓ SCROLL · F5 REFRESH · ESC EXIT</span>
      </div>

      {/* CREATIVE LIGHTBOX */}
      {focusedCreative && (
        <div style={S.lightbox} onClick={()=>setFocusedCreative(null)}>
          <div style={S.lightboxInner} onClick={e=>e.stopPropagation()}>
            <img src={focusedCreative.focusThumb || focusedCreative.full || (focusedCreative.thumbs && focusedCreative.thumbs[0])} alt={focusedCreative.name} style={S.lightboxImg} referrerPolicy="no-referrer"/>
            <div style={S.lightboxBody}>
              <div style={{fontFamily:TerminalTheme.monoFont, fontSize:11, color:TerminalTheme.muted, letterSpacing:0.5}}>CREATIVE</div>
              <div style={{fontSize:18, fontWeight:700, marginTop:4, wordBreak:"break-all"}}>{focusedCreative.name}</div>
              <div style={{fontSize:11, color:TerminalTheme.muted, marginTop:4, fontFamily:TerminalTheme.monoFont}}>
                {[focusedCreative.campaign, focusedCreative.media, focusedCreative.device, focusedCreative.version].filter(Boolean).join(" · ")}
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8, marginTop:14}}>
                <BigStat label="노출" value={D.fmt.intShort(focusedCreative.impressions||0)}/>
                <BigStat label="클릭" value={D.fmt.intShort(focusedCreative.clicks||0)}/>
                <BigStat label="CTR"   value={focusedCreative.impressions?D.fmt.pct(focusedCreative.ctr||0):"—"} color={TerminalTheme.blue}/>
                <BigStat label="전환"  value={D.fmt.intShort(focusedCreative.conversions||0)}/>
                <BigStat label="매출"  value={focusedCreative.revenue?D.fmt.krwShort(focusedCreative.revenue):"—"} color={TerminalTheme.accent}/>
                <BigStat label="ROAS"  value={focusedCreative.cost?focusedCreative.roas.toFixed(2)+"×":"—"} color={focusedCreative.roas>3?TerminalTheme.green:focusedCreative.roas<1.5?TerminalTheme.red:TerminalTheme.fg}/>
              </div>
              {focusedCreative.href && focusedCreative.href !== "#" && (
                <a href={focusedCreative.href} target="_blank" rel="noopener" style={S.driveLink}>
                  Drive에서 보기 ↗
                </a>
              )}
              <button style={S.lightboxClose} onClick={()=>setFocusedCreative(null)}>✕ 닫기 (ESC)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── small helper components ───────────────────────────────
function SlicerBox({active}){
  return (
    <span style={{
      display:"inline-block",
      width:11, height:11,
      border:`1px solid ${active ? TerminalTheme.accent : TerminalTheme.faint}`,
      background: active ? TerminalTheme.accent : "transparent",
      position:"relative", marginRight:6, verticalAlign:"-1px",
    }}>
      {active && (
        <span style={{
          position:"absolute", left:2, top:0,
          color:"white", fontSize:9, fontWeight:900, lineHeight:1,
        }}>✓</span>
      )}
    </span>
  );
}

function DetailTable({rows, keyLabel, totals, D, highlightWeekend, isCPA}){
  const S = terminalStyles;
  return (
    <table style={S.detailTable}>
      <thead>
        <tr style={S.detailHeaderTopRow}>
          <th style={{...S.detailGroupTh, width:90}}></th>
          <th colSpan={5} style={{...S.detailGroupTh, color:TerminalTheme.blue}}>광고 유입 · TRAFFIC</th>
          <th colSpan={3} style={{...S.detailGroupTh, color:TerminalTheme.green}}>전환 · CONVERSION</th>
          {!isCPA && <th colSpan={2} style={{...S.detailGroupTh, color:TerminalTheme.accent}}>매출 · REVENUE</th>}
        </tr>
        <tr>
          <th style={S.detailTh}>{keyLabel}</th>
          <th style={S.detailThN}>노출수</th>
          <th style={S.detailThN}>클릭수</th>
          <th style={S.detailThN}>클릭률</th>
          <th style={S.detailThN}>CPC</th>
          <th style={S.detailThN}>비용 (VAT+)</th>
          <th style={S.detailThN}>전환수</th>
          <th style={S.detailThN}>CPA</th>
          <th style={S.detailThN}>전환율</th>
          {!isCPA && <th style={S.detailThN}>매출</th>}
          {!isCPA && <th style={S.detailThN}>ROAS</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i) => {
          let weekendColor = TerminalTheme.fg;
          if (highlightWeekend && r.date && r.date.includes(".")) {
            const dow = new Date(r.date.replace(/\./g,"-")).getDay();
            if (dow === 0) weekendColor = TerminalTheme.red;
            else if (dow === 6) weekendColor = TerminalTheme.blue;
          }
          const cvr = r.clicks ? r.conversions / r.clicks : 0;
          return (
            <tr key={r.date} style={i%2 ? S.detailTrAlt : S.detailTr}>
              <td style={{...S.detailTd, color: weekendColor, fontWeight: 600}}>
                {r.label || r.date}
              </td>
              <td style={S.detailTdN}>{D.fmt.int(r.impressions)}</td>
              <td style={S.detailTdN}>{D.fmt.int(r.clicks)}</td>
              <td style={{...S.detailTdN, color:TerminalTheme.blue}}>{D.fmt.pct(r.ctr)}</td>
              <td style={S.detailTdN}>₩{Math.round(r.cpc).toLocaleString()}</td>
              <td style={S.detailTdN}>₩{Math.round(r.cost).toLocaleString()}</td>
              <td style={S.detailTdN}>{D.fmt.int(r.conversions)}</td>
              <td style={{...S.detailTdN, color:TerminalTheme.red}}>₩{Math.round(r.cpa).toLocaleString()}</td>
              <td style={{...S.detailTdN, color:TerminalTheme.magenta}}>{D.fmt.pct(cvr)}</td>
              {!isCPA && <td style={{...S.detailTdN, color:TerminalTheme.accent, fontWeight:600}}>{D.fmt.krwShort(r.revenue)}</td>}
              {!isCPA && <td style={{...S.detailTdN, color: r.roas>3?TerminalTheme.green:r.roas<1.5?TerminalTheme.red:TerminalTheme.fg, fontWeight:600}}>{r.roas.toFixed(2)}×</td>}
            </tr>
          );
        })}
        <tr style={S.detailTotalRow}>
          <td style={{...S.detailTd, fontWeight:700}}>합계</td>
          <td style={{...S.detailTdN, fontWeight:700}}>{D.fmt.int(totals.impressions)}</td>
          <td style={{...S.detailTdN, fontWeight:700}}>{D.fmt.int(totals.clicks)}</td>
          <td style={{...S.detailTdN, fontWeight:700, color:TerminalTheme.blue}}>{D.fmt.pct(totals.ctr)}</td>
          <td style={{...S.detailTdN, fontWeight:700}}>₩{Math.round(totals.cpc).toLocaleString()}</td>
          <td style={{...S.detailTdN, fontWeight:700}}>₩{Math.round(totals.cost).toLocaleString()}</td>
          <td style={{...S.detailTdN, fontWeight:700}}>{D.fmt.int(totals.conversions)}</td>
          <td style={{...S.detailTdN, fontWeight:700, color:TerminalTheme.red}}>₩{Math.round(totals.cpa).toLocaleString()}</td>
          <td style={{...S.detailTdN, fontWeight:700, color:TerminalTheme.magenta}}>{D.fmt.pct(totals.clicks ? totals.conversions/totals.clicks : 0)}</td>
          {!isCPA && <td style={{...S.detailTdN, fontWeight:700, color:TerminalTheme.accent}}>{D.fmt.krwShort(totals.revenue)}</td>}
          {!isCPA && <td style={{...S.detailTdN, fontWeight:700, color: totals.roas>3?TerminalTheme.green:totals.roas<1.5?TerminalTheme.red:TerminalTheme.fg}}>{totals.roas.toFixed(2)}×</td>}
        </tr>
      </tbody>
    </table>
  );
}

function SubStrip({label, value}){
  const S = terminalStyles;
  return (
    <div style={S.subStrip}>
      <span style={S.subStripLabel}>{label}</span>
      <span style={S.subStripValue}>{value}</span>
    </div>
  );
}
function MiniStat({label, value, color}){
  return (
    <div style={{background:TerminalTheme.panel, padding:"6px 8px"}}>
      <div style={{fontSize:9, color:TerminalTheme.faint, fontFamily:TerminalTheme.monoFont, letterSpacing:0.5}}>{label}</div>
      <div style={{fontSize:12, fontWeight:700, fontFamily:TerminalTheme.monoFont, marginTop:1, color: color || TerminalTheme.fg}}>{value}</div>
    </div>
  );
}
function CreativeStat({label, value, color}){
  return (
    <div style={terminalStyles.creativeStatCell}>
      <div style={terminalStyles.creativeStatLabel}>{label}</div>
      <div style={{...terminalStyles.creativeStatValue, color: color || TerminalTheme.fg}}>{value}</div>
    </div>
  );
}
function BigStat({label, value, color}){
  return (
    <div style={terminalStyles.bigStat}>
      <div style={{fontSize:10, color:TerminalTheme.faint, fontFamily:TerminalTheme.monoFont, letterSpacing:1}}>{label}</div>
      <div style={{fontSize:18, fontWeight:700, fontFamily:TerminalTheme.monoFont, marginTop:2, color: color || TerminalTheme.fg}}>{value}</div>
    </div>
  );
}

function metricPeak(data, kind){
  const max = data.reduce((a,d)=>Math.max(a, d.value), 0);
  return formatMetric(max, kind);
}
function metricAvg(data, kind){
  if (!data.length) return "—";
  const avg = data.reduce((a,d)=>a+d.value, 0) / data.length;
  return formatMetric(avg, kind);
}
function metricLow(data, kind){
  if (!data.length) return "—";
  const min = data.reduce((a,d)=>Math.min(a, d.value), Infinity);
  return formatMetric(min, kind);
}
function formatMetric(v, kind){
  const D = window.DASH;
  if (kind === "rev_cost") return D.fmt.krwShort(v);
  if (kind === "conv")     return D.fmt.intShort(v);
  if (kind === "cvr")      return (v*100).toFixed(2)+"%";
  if (kind === "roas")     return v.toFixed(2)+"×";
  return D.fmt.intShort(v);
}

// ─── styles ────────────────────────────────────────────────
const terminalStyles = {
  root: { width:"100%", minHeight:"100vh", background:TerminalTheme.bg, color:TerminalTheme.fg, fontFamily:TerminalTheme.font, fontSize:12, display:"flex", flexDirection:"column" },
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel, position:"sticky", top:0, zIndex:50 },
  headerL: { display:"flex", alignItems:"center", gap:10, minWidth:0 },
  headerR: { display:"flex", alignItems:"center", gap:4, flexShrink:0 },
  brand: { fontFamily:TerminalTheme.monoFont, fontSize:13, fontWeight:600, color:TerminalTheme.accent, letterSpacing:0.5 },
  brandSub: { fontFamily:TerminalTheme.monoFont, fontSize:10, color:TerminalTheme.muted, letterSpacing:0.5 },
  statusDot: { width:8, height:8, borderRadius:"50%", background:TerminalTheme.green, boxShadow:`0 0 8px ${TerminalTheme.green}`, marginLeft:6 },
  muted: { color:TerminalTheme.muted, fontFamily:TerminalTheme.monoFont },
  tab: { background:"transparent", border:`1px solid ${TerminalTheme.border}`, color:TerminalTheme.muted, padding:"4px 10px", fontSize:10, fontFamily:TerminalTheme.monoFont, letterSpacing:0.4, cursor:"pointer", borderRadius:0 },
  tabActive: { background:TerminalTheme.accent, border:`1px solid ${TerminalTheme.accent}`, color:TerminalTheme.panel, padding:"4px 10px", fontSize:10, fontFamily:TerminalTheme.monoFont, letterSpacing:0.4, cursor:"pointer", fontWeight:700, borderRadius:0 },
  divider: { width:1, height:18, background:TerminalTheme.border, margin:"0 6px" },
  controlBar: { display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel, flexWrap:"wrap" },
  campChipsWrap: { display:"flex", gap:4, flexWrap:"wrap", flex:1 },
  stripLabel: { fontFamily:TerminalTheme.monoFont, fontSize:10, color:TerminalTheme.faint, marginRight:4, letterSpacing:1 },
  segGroup: { display:"flex", background:TerminalTheme.panelHi, border:`1px solid ${TerminalTheme.border}`, padding:2 },
  seg: { background:"transparent", border:"none", padding:"3px 10px", fontSize:11, color:TerminalTheme.muted, cursor:"pointer", fontFamily:TerminalTheme.font, fontWeight:500 },
  segActive: { background:TerminalTheme.panel, border:"none", padding:"3px 10px", fontSize:11, color:TerminalTheme.accent, cursor:"pointer", fontFamily:TerminalTheme.font, fontWeight:700, boxShadow:"0 1px 1px rgba(0,0,0,0.05)" },
  chip: { background:"transparent", border:`1px solid ${TerminalTheme.border}`, color:TerminalTheme.muted, padding:"3px 9px", fontSize:11, cursor:"pointer", fontFamily:TerminalTheme.font },
  chipActive: { background:TerminalTheme.panelHi, border:`1px solid ${TerminalTheme.accent}`, color:TerminalTheme.accent, padding:"3px 9px", fontSize:11, cursor:"pointer", fontFamily:TerminalTheme.font, fontWeight:600 },
  scopePill: { fontFamily:TerminalTheme.monoFont, fontSize:10, color:TerminalTheme.fg, background:TerminalTheme.panelHi, padding:"3px 9px", border:`1px solid ${TerminalTheme.border}` },

  // slicer bar (second filter row: 매체 + 기기)
  slicerBar: { display:"flex", alignItems:"center", gap:6, padding:"6px 16px", borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.bg, flexWrap:"wrap" },
  slicerChipsWrap: { display:"flex", gap:3, flexWrap:"wrap" },
  slicerChip: { display:"inline-flex", alignItems:"center", background:TerminalTheme.panel, border:`1px solid ${TerminalTheme.border}`, color:TerminalTheme.muted, padding:"3px 9px 3px 8px", fontSize:11, cursor:"pointer", fontFamily:TerminalTheme.font, lineHeight:1.4 },
  slicerChipActive: { display:"inline-flex", alignItems:"center", background:TerminalTheme.panel, border:`1px solid ${TerminalTheme.accent}`, color:TerminalTheme.accent, padding:"3px 9px 3px 8px", fontSize:11, cursor:"pointer", fontFamily:TerminalTheme.font, fontWeight:600, lineHeight:1.4 },

  // detail tables (weekly + daily)
  detailTable: { width:"100%", borderCollapse:"collapse", fontFamily:TerminalTheme.monoFont, fontSize:11 },
  detailHeaderTopRow: { background:TerminalTheme.panelHi, position:"sticky", top:0, zIndex:2 },
  detailGroupTh: { textAlign:"center", padding:"6px 8px", fontSize:9, letterSpacing:1, fontWeight:700, borderRight:`1px solid ${TerminalTheme.border}`, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi },
  detailTh: { position:"sticky", top:26, textAlign:"left", padding:"5px 10px", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:0.8, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel, zIndex:1 },
  detailThN: { position:"sticky", top:26, textAlign:"right", padding:"5px 10px", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:0.8, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel, zIndex:1 },
  detailTr: { background:TerminalTheme.panel },
  detailTrAlt: { background:TerminalTheme.panelHi },
  detailTd: { padding:"4px 10px", color:TerminalTheme.fg, fontSize:11, borderBottom:`1px solid ${TerminalTheme.grid}`, fontFamily:TerminalTheme.font },
  detailTdN: { padding:"4px 10px", color:TerminalTheme.fg, fontSize:11, textAlign:"right", borderBottom:`1px solid ${TerminalTheme.grid}` },
  detailTotalRow: { background:TerminalTheme.panelHi, borderTop:`2px solid ${TerminalTheme.fg}` },
  kpiRow: { display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:1, background:TerminalTheme.border },
  kpiCell: { background:TerminalTheme.panel, padding:"10px 14px" },
  kpiCode: { fontFamily:TerminalTheme.monoFont, fontSize:10, color:TerminalTheme.faint, letterSpacing:1 },
  kpiLabel: { color:TerminalTheme.muted },
  kpiValue: { fontFamily:TerminalTheme.monoFont, fontSize:22, fontWeight:600, marginTop:2, letterSpacing:-0.5 },
  kpiDelta: { fontFamily:TerminalTheme.monoFont, fontSize:10, marginTop:2 },
  mainGrid: { display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gridAutoRows:"minmax(0,auto)", gap:1, background:TerminalTheme.border, padding:0, flex:1 },
  panel: { background:TerminalTheme.panel, display:"flex", flexDirection:"column", minWidth:0 },
  panelHead: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi, gap:8, flexWrap:"wrap" },
  panelTitle: { fontFamily:TerminalTheme.monoFont, fontSize:11, color:TerminalTheme.accent, letterSpacing:0.8, fontWeight:600 },
  metricTabs: { display:"flex", gap:4 },
  metricTab: { background:"transparent", border:`1px solid ${TerminalTheme.border}`, color:TerminalTheme.muted, padding:"3px 9px", fontSize:10, fontFamily:TerminalTheme.monoFont, letterSpacing:0.3, cursor:"pointer" },
  metricTabActive: { background:TerminalTheme.fg, border:`1px solid ${TerminalTheme.fg}`, color:TerminalTheme.panel, padding:"3px 9px", fontSize:10, fontFamily:TerminalTheme.monoFont, letterSpacing:0.3, cursor:"pointer", fontWeight:700 },
  subStripRow: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:TerminalTheme.border, marginTop:"auto" },
  subStrip: { background:TerminalTheme.panel, padding:"6px 12px", display:"flex", justifyContent:"space-between", alignItems:"baseline" },
  subStripLabel: { fontFamily:TerminalTheme.monoFont, fontSize:9, color:TerminalTheme.faint, letterSpacing:1 },
  subStripValue: { fontFamily:TerminalTheme.monoFont, fontSize:12, color:TerminalTheme.fg, fontWeight:600 },

  legendRow: { display:"flex", alignItems:"center", gap:8, fontSize:11 },
  legendSwatch: { width:9, height:9, borderRadius:2, flexShrink:0 },
  legendLabel: { color:TerminalTheme.fg, fontSize:11, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },

  mediaTable: { width:"100%", borderCollapse:"collapse", fontFamily:TerminalTheme.monoFont, fontSize:11 },
  mediaTh: { textAlign:"left", padding:"5px 0", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:1, borderBottom:`1px solid ${TerminalTheme.border}` },
  mediaThN: { textAlign:"right", padding:"5px 0", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:1, borderBottom:`1px solid ${TerminalTheme.border}` },
  mediaTd: { padding:"6px 0", borderBottom:`1px solid ${TerminalTheme.grid}`, fontSize:11, color:TerminalTheme.fg, fontFamily:TerminalTheme.font },
  mediaTdN: { padding:"6px 0 6px 8px", borderBottom:`1px solid ${TerminalTheme.grid}`, fontSize:11, color:TerminalTheme.fg, textAlign:"right" },
  mediaDot: { display:"inline-block", width:7, height:7, borderRadius:"50%", marginRight:7, verticalAlign:"middle" },
  mediaBarTrack: { display:"inline-block", width:50, height:5, background:TerminalTheme.grid, verticalAlign:"middle", marginRight:6, overflow:"hidden" },
  mediaBarFill: { height:"100%" },

  creativeTable: { width:"100%", borderCollapse:"collapse", fontFamily:TerminalTheme.monoFont, fontSize:11 },
  creativeGroupTh: { textAlign:"center", padding:"6px 8px", fontSize:9, letterSpacing:1, fontWeight:700, borderRight:`1px solid ${TerminalTheme.border}`, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi },
  creativeTh: { textAlign:"left", padding:"6px 10px", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:0.8, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi, verticalAlign:"bottom" },
  creativeThN: { textAlign:"right", padding:"5px 10px", color:TerminalTheme.faint, fontSize:9, fontWeight:600, letterSpacing:0.8, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel },
  creativeTd: { padding:"8px 10px", color:TerminalTheme.fg, fontSize:11, borderBottom:`1px solid ${TerminalTheme.grid}`, fontFamily:TerminalTheme.font, verticalAlign:"middle" },
  creativeTdN: { padding:"8px 10px", color:TerminalTheme.fg, fontSize:11, textAlign:"right", borderBottom:`1px solid ${TerminalTheme.grid}`, verticalAlign:"middle" },
  creativeTotalRow: { background:TerminalTheme.panelHi, borderTop:`2px solid ${TerminalTheme.fg}`, borderBottom:`2px solid ${TerminalTheme.fg}` },
  creativeRowThumb: { width:90, height:68, objectFit:"cover", border:`1px solid ${TerminalTheme.border}`, cursor:"pointer", background:TerminalTheme.bg, display:"block" },
  bundleBadge: { display:"inline-block", fontSize:9, padding:"2px 6px", background:TerminalTheme.accent, color:"white", marginLeft:4, fontFamily:TerminalTheme.monoFont, letterSpacing:0.5, fontWeight:700 },

  creativeGrid: { display:"none" },
  creativeCard: { background:TerminalTheme.panel, cursor:"pointer", display:"flex", flexDirection:"column", transition:"background .15s" },
  creativeThumb: { position:"relative", width:"100%", aspectRatio:"4/3", background:TerminalTheme.panelHi, overflow:"hidden", borderBottom:`1px solid ${TerminalTheme.border}` },
  creativeImg: { width:"100%", height:"100%", objectFit:"cover", display:"block" },
  creativeBadge: { position:"absolute", top:6, left:6, fontSize:9, padding:"2px 6px", background:"rgba(0,0,0,0.7)", color:"white", fontFamily:TerminalTheme.monoFont, letterSpacing:0.5 },
  creativeRank: { position:"absolute", top:6, right:8, fontSize:11, fontFamily:TerminalTheme.monoFont, color:"white", fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.5)" },
  creativeBody: { padding:"8px 10px 10px", display:"flex", flexDirection:"column", gap:6 },
  creativeName: { fontSize:11, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontFamily:TerminalTheme.monoFont },
  creativeMeta: { fontSize:9.5, color:TerminalTheme.muted, fontFamily:TerminalTheme.monoFont, display:"flex", gap:4, letterSpacing:0.3 },
  creativeStats: { display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:1, background:TerminalTheme.border, marginTop:2 },
  creativeStatCell: { background:TerminalTheme.panelHi, padding:"5px 6px" },
  creativeStatLabel: { fontSize:8.5, color:TerminalTheme.faint, fontFamily:TerminalTheme.monoFont, letterSpacing:0.5 },
  creativeStatValue: { fontSize:10.5, fontWeight:700, fontFamily:TerminalTheme.monoFont, marginTop:1 },

  table: { width:"100%", borderCollapse:"collapse", fontFamily:TerminalTheme.monoFont, fontSize:11 },
  th: { textAlign:"left", padding:"6px 10px", color:TerminalTheme.faint, fontWeight:500, fontSize:10, letterSpacing:1, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi },
  thN: { textAlign:"right", padding:"6px 10px", color:TerminalTheme.faint, fontWeight:500, fontSize:10, letterSpacing:1, borderBottom:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panelHi },
  tr: { background:TerminalTheme.panel },
  trAlt: { background:TerminalTheme.panelHi },
  td: { padding:"5px 10px", color:TerminalTheme.fg, borderBottom:`1px solid ${TerminalTheme.grid}` },
  tdN: { padding:"5px 10px", color:TerminalTheme.fg, textAlign:"right", borderBottom:`1px solid ${TerminalTheme.grid}` },
  footer: { display:"flex", alignItems:"center", gap:18, padding:"8px 16px", borderTop:`1px solid ${TerminalTheme.border}`, background:TerminalTheme.panel, fontFamily:TerminalTheme.monoFont, fontSize:10, color:TerminalTheme.muted, letterSpacing:0.5, marginTop:"auto" },

  lightbox: { position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:24 },
  lightboxInner: { background:TerminalTheme.panel, display:"grid", gridTemplateColumns:"minmax(0,2fr) minmax(280px,1fr)", maxWidth:1100, width:"100%", maxHeight:"90vh", border:`1px solid ${TerminalTheme.border}`, boxShadow:"0 24px 80px rgba(0,0,0,0.4)" },
  lightboxImg: { width:"100%", height:"100%", objectFit:"contain", background:TerminalTheme.bg, maxHeight:"90vh" },
  lightboxBody: { padding:"24px 24px 20px", display:"flex", flexDirection:"column", borderLeft:`1px solid ${TerminalTheme.border}`, fontFamily:TerminalTheme.font, overflowY:"auto" },
  bigStat: { background:TerminalTheme.panelHi, padding:"8px 10px", border:`1px solid ${TerminalTheme.border}` },
  driveLink: { display:"inline-block", marginTop:16, fontSize:11, color:TerminalTheme.accent, textDecoration:"none", borderBottom:`1px solid ${TerminalTheme.accent}`, paddingBottom:1, alignSelf:"flex-start", fontFamily:TerminalTheme.monoFont },
  lightboxClose: { marginTop:"auto", padding:"8px 14px", border:`1px solid ${TerminalTheme.border}`, background:"transparent", color:TerminalTheme.muted, fontSize:11, cursor:"pointer", fontFamily:TerminalTheme.monoFont, letterSpacing:0.5, alignSelf:"flex-start" },
};

// keyboard: ESC closes lightbox
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const closeBtn = document.querySelector('[data-lightbox-close]');
      if (closeBtn) closeBtn.click();
    }
  });
}

Object.assign(window, { TerminalDashboard });
