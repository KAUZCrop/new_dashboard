// Reusable SVG chart primitives. Styleable via props so each variation can theme them.
// All charts respect a `theme` object: { fg, muted, grid, accent, accents:[], font, monoFont }

const { useMemo, useState, useRef, useEffect } = React;

// ============================== LineChart ==============================
function LineChart({ series, width = 720, height = 220, theme, yKey = "value", showArea = true, showAxis = true, padding = { t: 16, r: 12, b: 22, l: 44 }, smooth = false, dashed = [], responsive = false }){
  const [tip, setTip] = useState(null);
  const svgRef = useRef(null);

  const p = padding;
  const w = width - p.l - p.r, h = height - p.t - p.b;
  const allX = series[0]?.data.map(d=>d.x) || [];
  const maxY = Math.max(...series.flatMap(s=>s.data.map(d=>d[yKey]||0)), 1);
  const x = i => p.l + (w * i) / Math.max(allX.length-1, 1);
  const y = v => p.t + h - (h * v) / maxY;

  const path = (data) => {
    if (smooth){
      let d = "";
      data.forEach((pt,i)=>{
        const cx = x(i), cy = y(pt[yKey]);
        if (i===0) { d += `M${cx},${cy}`; return; }
        const prev = data[i-1];
        const px = x(i-1), py = y(prev[yKey]);
        const mx = (px+cx)/2;
        d += ` C${mx},${py} ${mx},${cy} ${cx},${cy}`;
      });
      return d;
    }
    return data.map((pt,i)=> (i===0?"M":"L") + x(i) + "," + y(pt[yKey])).join(" ");
  };
  const area = (data) => path(data) + ` L${x(data.length-1)},${p.t+h} L${x(0)},${p.t+h} Z`;
  const yticks = 4;
  const tickVals = Array.from({length:yticks+1}, (_,i)=> (maxY*i)/yticks);

  const handleMouseMove = e => {
    if (!svgRef.current || !allX.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const idx = Math.round((px - p.l) / w * (allX.length - 1));
    const i = Math.max(0, Math.min(allX.length - 1, idx));
    setTip({
      i,
      svgX: x(i),
      label: allX[i],
      values: series.map(s => ({ name: s.name, color: s.color || theme.accent, val: s.data[i]?.[yKey] ?? 0 })),
    });
  };

  const fmtTip = v => {
    if (!window.DASH) return v;
    const D = window.DASH;
    if (v >= 1e8) return D.fmt.krwShort(v);
    if (v > 0 && v < 1) return D.fmt.pct(v);
    return D.fmt.int(v);
  };

  return (
    <div style={{ position:"relative" }}>
      <svg
        ref={svgRef}
        {...(responsive ? { width:"100%", height:"auto", viewBox:`0 0 ${width} ${height}`, preserveAspectRatio:"none" } : { width, height })}
        style={{ display:"block", fontFamily: theme.monoFont || theme.font, fontSize: 10, cursor:"crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={()=>setTip(null)}
      >
        {showAxis && tickVals.map((v,i)=>(
          <g key={i}>
            <line x1={p.l} x2={p.l+w} y1={y(v)} y2={y(v)} stroke={theme.grid} strokeWidth={1} strokeDasharray={i===0?"":"2,3"} />
            <text x={p.l-6} y={y(v)+3} fill={theme.muted} textAnchor="end">{window.DASH.fmt.intShort(v)}</text>
          </g>
        ))}
        {showAxis && allX.map((xv,i)=> i % Math.ceil(allX.length/8)===0 && (
          <text key={i} x={x(i)} y={p.t+h+14} fill={theme.muted} textAnchor="middle">{window.DASH.fmt.date(xv)}</text>
        ))}
        {series.map((s,si)=>{
          const color = s.color || theme.accents?.[si] || theme.accent;
          return (
            <g key={si}>
              {showArea && si===0 && <path d={area(s.data)} fill={color} opacity={0.10} />}
              <path d={path(s.data)} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={dashed.includes(si)?"3,3":""} />
            </g>
          );
        })}
        {tip && (
          <g>
            <line x1={tip.svgX} x2={tip.svgX} y1={p.t} y2={p.t+h} stroke={theme.muted} strokeWidth={1} strokeDasharray="3,3" opacity={0.7}/>
            {tip.values.map((v,i) => {
              const cy = y(v.val);
              return <circle key={i} cx={tip.svgX} cy={cy} r={4} fill={v.color} stroke={theme.bg||"#fff"} strokeWidth={1.5}/>;
            })}
          </g>
        )}
      </svg>
      {tip && (
        <div style={{
          position:"absolute", top: p.t, pointerEvents:"none", zIndex:10,
          left: tip.svgX / width * 100 + "%",
          transform: tip.i > allX.length * 0.7 ? "translateX(-105%)" : "translateX(8px)",
        }}>
          <div style={{
            background: theme.fg, color: theme.bg || "#fff",
            fontFamily: theme.monoFont, fontSize: 11, padding: "6px 10px",
            minWidth: 110, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            <div style={{ fontSize: 10, marginBottom: 5, opacity: 0.7, letterSpacing: 0.5 }}>
              {window.DASH.fmt.date(tip.label)}
            </div>
            {tip.values.map((v,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", gap: 12, marginTop: i>0?3:0 }}>
                <span style={{ color: v.color, fontSize: 10 }}>{v.name}</span>
                <span style={{ fontWeight: 700 }}>{fmtTip(v.val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================== BarChart ==============================
function BarChart({ data, width = 600, height = 220, theme, valueKey = "value", labelKey = "label", padding = { t:12, r:12, b:26, l:44 }, horizontal = false, accentIndex = -1, format = "int" }){
  const p = padding;
  const w = width - p.l - p.r, h = height - p.t - p.b;
  const maxV = Math.max(...data.map(d=>d[valueKey]), 1);
  if (horizontal){
    const rowH = h / data.length;
    const barH = Math.min(rowH * 0.62, 22);
    return (
      <svg width={width} height={height} style={{ display:"block", fontFamily: theme.monoFont || theme.font, fontSize: 10 }}>
        {data.map((d,i)=>{
          const bw = (w-90) * (d[valueKey]/maxV);
          const cy = p.t + rowH*i + rowH/2;
          const color = (accentIndex===i) ? theme.accent : (theme.accents?.[i % (theme.accents?.length||1)] || theme.accent);
          return (
            <g key={i}>
              <text x={p.l} y={cy+3} fill={theme.fg} fontSize={10}>{d[labelKey]}</text>
              <rect x={p.l+74} y={cy-barH/2} width={bw} height={barH} fill={color} opacity={0.85} />
              <rect x={p.l+74} y={cy-barH/2} width={bw} height={barH} fill="none" stroke={color} strokeWidth={0.5} />
              <text x={p.l+74+bw+6} y={cy+3} fill={theme.muted} fontSize={10}>
                {format==="krw"?window.DASH.fmt.krwShort(d[valueKey]):window.DASH.fmt.intShort(d[valueKey])}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  // vertical
  const colW = w / data.length;
  const barW = Math.min(colW*0.62, 28);
  return (
    <svg width={width} height={height} style={{ display:"block", fontFamily: theme.monoFont || theme.font, fontSize: 10 }}>
      {[0,0.25,0.5,0.75,1].map((t,i)=>(
        <line key={i} x1={p.l} x2={p.l+w} y1={p.t+h-h*t} y2={p.t+h-h*t} stroke={theme.grid} strokeDasharray={t===0?"":"2,3"} />
      ))}
      {[0,0.5,1].map((t,i)=>(
        <text key={i} x={p.l-6} y={p.t+h-h*t+3} fill={theme.muted} textAnchor="end" fontSize={10}>{window.DASH.fmt.intShort(maxV*t)}</text>
      ))}
      {data.map((d,i)=>{
        const v = d[valueKey];
        const bh = h * (v/maxV);
        const cx = p.l + colW*i + colW/2;
        const color = (accentIndex===i) ? theme.accent : (theme.accents?.[i % (theme.accents?.length||1)] || theme.accent);
        return (
          <g key={i}>
            <rect x={cx-barW/2} y={p.t+h-bh} width={barW} height={bh} fill={color} opacity={0.85} />
            <text x={cx} y={p.t+h+14} fill={theme.muted} textAnchor="middle">{d[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================== Donut ==============================
function Donut({ data, size = 180, theme, valueKey = "value", inner = 0.6, format = "krw" }){
  const total = data.reduce((a,d)=>a+d[valueKey],0);
  const r = size/2, ri = r*inner;
  let acc = 0;
  const arcs = data.map((d,i)=>{
    const start = acc/total * Math.PI*2 - Math.PI/2;
    acc += d[valueKey];
    const end = acc/total * Math.PI*2 - Math.PI/2;
    const large = (end-start) > Math.PI ? 1 : 0;
    const x1 = r + r*Math.cos(start), y1 = r + r*Math.sin(start);
    const x2 = r + r*Math.cos(end),   y2 = r + r*Math.sin(end);
    const xi1 = r + ri*Math.cos(start), yi1 = r + ri*Math.sin(start);
    const xi2 = r + ri*Math.cos(end),   yi2 = r + ri*Math.sin(end);
    return { path: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large} 0 ${xi1},${yi1} Z`, color: theme.accents?.[i % theme.accents.length] || theme.accent, label: d.label, value: d[valueKey], pct: d[valueKey]/total };
  });
  return (
    <svg width={size} height={size} style={{ display:"block" }}>
      {arcs.map((a,i)=>(<path key={i} d={a.path} fill={a.color} />))}
      <text x={size/2} y={size/2-2} fill={theme.fg} textAnchor="middle" style={{ fontFamily: theme.monoFont || theme.font, fontSize: 11 }}>TOTAL</text>
      <text x={size/2} y={size/2+14} fill={theme.fg} textAnchor="middle" style={{ fontFamily: theme.monoFont || theme.font, fontSize: 14, fontWeight:600 }}>
        {format==="krw"?window.DASH.fmt.krwShort(total):window.DASH.fmt.intShort(total)}
      </text>
    </svg>
  );
}

// ============================== Sparkline ==============================
function Sparkline({ data, width = 96, height = 24, color, yKey = "value", baseline = false, fill = false }){
  const max = Math.max(...data.map(d=>d[yKey]),1);
  const min = Math.min(...data.map(d=>d[yKey]),0);
  const range = (max-min) || 1;
  const x = i => (width * i) / Math.max(data.length-1,1);
  const y = v => height - 2 - ((height-4) * (v-min)) / range;
  const pts = data.map((d,i)=> (i===0?"M":"L") + x(i).toFixed(1) + "," + y(d[yKey]).toFixed(1)).join(" ");
  return (
    <svg width={width} height={height} style={{ display:"block" }}>
      {fill && <path d={pts + ` L${x(data.length-1)},${height} L0,${height} Z`} fill={color} opacity={0.18} />}
      <path d={pts} fill="none" stroke={color} strokeWidth={1.25} />
      {baseline && <line x1={0} x2={width} y1={height-2} y2={height-2} stroke={color} opacity={0.25} strokeDasharray="2,2" />}
    </svg>
  );
}

// ============================== Heatmap (day×hour) ==============================
function Heatmap({ data, theme, cols = 7, rows = 24, cellSize = 14, gap = 2, colHeaders = ["월","화","수","목","금","토","일"], rowStep = 4 }){
  // data: number[rows*cols] 0..1 normalized intensity
  const w = cols*(cellSize+gap)+30;
  const h = rows*(cellSize+gap)+16;
  return (
    <svg width={w} height={h} style={{ display:"block", fontFamily: theme.monoFont || theme.font, fontSize: 9 }}>
      {colHeaders.map((c,i)=>(<text key={i} x={30+i*(cellSize+gap)+cellSize/2} y={10} fill={theme.muted} textAnchor="middle">{c}</text>))}
      {Array.from({length:rows},(_,r)=> r%rowStep===0 && (
        <text key={r} x={24} y={16+r*(cellSize+gap)+cellSize-3} fill={theme.muted} textAnchor="end">{String(r).padStart(2,"0")}</text>
      ))}
      {Array.from({length:rows*cols},(_,i)=>{
        const r = Math.floor(i/cols), c = i%cols;
        const v = data[i] ?? 0;
        return <rect key={i} x={30+c*(cellSize+gap)} y={16+r*(cellSize+gap)} width={cellSize} height={cellSize} fill={theme.accent} opacity={0.08 + v*0.85} />;
      })}
    </svg>
  );
}

Object.assign(window, { LineChart, BarChart, Donut, Sparkline, Heatmap });
