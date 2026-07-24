"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SOURCES, VIZZES, fmtValue } from "../lib/metrics";

// Renders a client analytics dashboard (sections -> widgets) plus a light
// editor for agency/manager. Clients see the same page read-only.

const PALETTE = ["#6366f1", "#00c875", "#fdab3d", "#e2445c", "#0ea5e9", "#a855f7", "#94a3b8"];

async function post(body) {
  const r = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

/* ---------- SVG charts (dependency-free, hoverable) ---------- */
const fmtDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function xy(series, w, h, max, pad = 2) {
  const m = max || 1;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  return series.map((p, i) => [i * step, h - pad - (p.v / m) * (h - pad * 2)]);
}
// Catmull-Rom -> bezier for AA-style smooth curves.
function smoothPath(P) {
  if (P.length < 2) return "";
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
// Round a raw max up to a "nice" tick ceiling (1/2/2.5/5 × 10^k) so the
// y-axis reads $20/$40/$60/$80, never $61/$81.
function niceCeil(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 4, 5, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
// Measure the container's real pixel width so strokes never stretch.
function useMeasure() {
  const [el, setEl] = useState(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

function Spark({ series }) {
  const [ref, w] = useMeasure();
  if (!series?.length) return <div ref={ref} className="dw-spark" />;
  const max = Math.max(...series.map((p) => p.v), 1);
  return (
    <div ref={ref} className="dw-spark">
      {w > 0 && (
        <svg width={w} height={26}>
          <path d={smoothPath(xy(series, w, 26, max, 3))} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

// Shared hoverable chart: pixel-accurate, crisp strokes, gradient area fill.
function Chart({ series, prevSeries, kind = "line", fmt, h = 110, axes = false }) {
  const [hov, setHov] = useState(null);
  const [ref, mw] = useMeasure();
  const gid = "g" + Math.abs((series?.[0]?.d || "x").split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, h));
  if (!series?.length) return <div ref={ref} />;
  const W = Math.max(mw, 60), PADL = axes ? 48 : 0, PADT = 10, PADB = 4, plotW = W - PADL, plotH = h - PADT - PADB;
  const max = niceCeil(Math.max(...series.map((p) => p.v), ...(prevSeries || []).map((p) => p.v), 1));
  const Y = (v) => PADT + plotH - (v / max) * plotH;
  const step = series.length > 1 ? plotW / (series.length - 1) : plotW;
  const P = series.map((p, i) => [i * step, Y(p.v)]);
  const PP = prevSeries?.length ? prevSeries.map((p, i) => [i * step, Y(p.v)]) : null;
  const bw = plotW / series.length;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHov(Math.max(0, Math.min(series.length - 1, Math.round((e.clientX - r.left - PADL) / plotW * (series.length - 1)))));
  };
  return (
    <div className="dw-chartwrap" ref={ref} onMouseLeave={() => setHov(null)}>
      {mw > 0 && (
      <svg width={W} height={h} onMouseMove={onMove} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {(axes ? [0.25, 0.5, 0.75, 1] : []).map((g) => (
          <g key={g}>
            <line x1={PADL} x2={W} y1={Y(max * g)} y2={Y(max * g)} stroke="#eef0f4" strokeWidth="1" />
            <text x={PADL - 8} y={Y(max * g) + 3.5} textAnchor="end" className="dw-axis">{fmtValue(max * g, fmt)}</text>
          </g>
        ))}
        <g transform={`translate(${PADL},0)`}>
          {kind === "column"
            ? series.map((p, i) => (
                <rect key={i} x={i * bw + bw * 0.18} y={Y(p.v)} width={Math.max(1, bw * 0.64)} height={Math.max(0, PADT + plotH - Y(p.v))}
                  rx="1.5" fill="#6366f1" opacity={hov === i ? 1 : 0.8} />
              ))
            : (
              <>
                <path d={smoothPath(P) + `L${plotW},${PADT + plotH}L0,${PADT + plotH}Z`} fill={`url(#${gid})`} stroke="none" />
                {PP && <path d={smoothPath(PP)} fill="none" stroke="#cfd4dd" strokeWidth="1.5" strokeDasharray="4 3" />}
                <path d={smoothPath(P)} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {hov != null && <circle cx={P[hov][0]} cy={P[hov][1]} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2" />}
                {hov != null && PP && <circle cx={PP[hov][0]} cy={PP[hov][1]} r="3" fill="#fff" stroke="#b6bcc7" strokeWidth="1.5" />}
              </>
            )}
          {hov != null && <line x1={P[hov][0]} x2={P[hov][0]} y1={PADT} y2={PADT + plotH} stroke="#c7d2fe" strokeWidth="1" />}
        </g>
      </svg>
      )}
      {axes && (
        <div className="dw-xlabels" style={{ paddingLeft: PADL }}>
          <span>{fmtDay(series[0].d)}</span>
          <span>{fmtDay(series[Math.floor(series.length / 2)].d)}</span>
          <span>{fmtDay(series[series.length - 1].d)}</span>
        </div>
      )}
      {hov != null && mw > 0 && (
        <div className="dw-tip" style={{ left: Math.min(Math.max(P[hov][0] + PADL, 60), W - 60) }}>
          <div className="dw-tip-date">{fmtDay(series[hov].d)}</div>
          <div><span className="dw-dot" style={{ background: "#6366f1" }} /> {fmtValue(series[hov].v, fmt)}</div>
          {prevSeries?.[hov] && <div className="dw-tip-prev"><span className="dw-dot" style={{ background: "#c3c8d2" }} /> {fmtValue(prevSeries[hov].v, fmt)} <span>prev</span></div>}
        </div>
      )}
    </div>
  );
}
const LineChart = (p) => <Chart {...p} kind="line" />;
const Bars = (p) => <Chart {...p} kind="column" />;
function Donut({ cats, total, fmt }) {
  const sum = cats.reduce((a, c) => a + c.value, 0) || 1;
  const C = 2 * Math.PI * 40;
  let acc = 0;
  return (
    <div className="dw-donut">
      <svg viewBox="0 0 100 100" className="dw-donut-svg">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#eef0f4" strokeWidth="14" />
        {cats.map((c, i) => {
          const frac = c.value / sum;
          const el = (
            <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="14"
              strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 50 50)" />
          );
          acc += frac;
          return el;
        })}
        <text x="50" y="54" textAnchor="middle" className="dw-donut-total">{fmtValue(total, fmt)}</text>
      </svg>
      <div className="dw-legend">
        {cats.map((c, i) => (
          <div key={i} className="dw-legend-row">
            <span className="dw-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="dw-legend-lbl" title={c.label}>{c.label}</span>
            <b>{fmtValue(c.value, fmt)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Delta({ delta, dir }) {
  if (delta == null) return null;
  const up = delta >= 0;
  const good = dir === 0 ? null : dir === 1 ? up : !up;
  return (
    <span className={"dw-delta " + (good == null ? "flat" : good ? "good" : "bad")}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(Math.abs(delta) >= 100 ? 0 : 1)}%
    </span>
  );
}

function Widget({ d, editMode, onEdit, onMove, onDelete, onOpen }) {
  const drillable = !editMode && d.viz !== "table" && onOpen;
  return (
    <div className={"dw" + (d.w === 2 ? " w2" : "") + (drillable ? " clickable" : "")}
      onClick={drillable ? onOpen : undefined} title={drillable ? "Click for the full breakdown" : undefined}>
      <div className="dw-head">
        <span className="dw-icon" title={d.sourceLabel}>{d.icon}</span>
        <span className="dw-title">{d.title}</span>
        {d.overridden && <span className="dw-range">({d.days}d)</span>}
        {editMode && (
          <span className="dw-tools" onClick={(e) => e.stopPropagation()}>
            <button title="Edit" onClick={onEdit}>✎</button>
            <button title="Move earlier" onClick={() => onMove(-1)}>↑</button>
            <button title="Move later" onClick={() => onMove(1)}>↓</button>
            <button title="Remove" onClick={onDelete}>×</button>
          </span>
        )}
      </div>
      {d.viz === "stat" && (
        <>
          <div className="dw-value">{fmtValue(d.total, d.fmt)} <Delta delta={d.delta} dir={d.dir} /></div>
          <Spark series={d.series} />
        </>
      )}
      {(d.viz === "line" || d.viz === "column") && (
        <>
          <div className="dw-value sm">{fmtValue(d.total, d.fmt)} <Delta delta={d.delta} dir={d.dir} /></div>
          {d.viz === "line" ? <LineChart series={d.series} prevSeries={d.prevSeries} fmt={d.fmt} /> : <Bars series={d.series} fmt={d.fmt} />}
        </>
      )}
      {d.viz === "donut" && (d.cats?.length ? <Donut cats={d.cats} total={d.total} fmt={d.fmt} /> : <div className="dw-empty">No data in this period.</div>)}
      {d.viz === "table" && (
        d.rows?.length ? (
          <table className="dw-table">
            <thead><tr><th>Campaign</th><th>Spend</th><th>Conv.</th><th>Value</th><th>ROAS</th></tr></thead>
            <tbody>
              {d.rows.map((r, i) => (
                <tr key={i}>
                  <td title={r.name}>{r.name}</td>
                  <td>{fmtValue(r.spend, "money")}</td>
                  <td>{fmtValue(r.conversions, "num")}</td>
                  <td>{fmtValue(r.revenue, "money")}</td>
                  <td>{r.roas != null ? r.roas.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="dw-empty">No campaign spend in this period.</div>
      )}
    </div>
  );
}

/* ---------- metric drill-down modal ---------- */
function MetricModal({ clientId, widget, onClose }) {
  const [days, setDays] = useState(widget.days || 30);
  const [kind, setKind] = useState(widget.viz === "column" ? "column" : "line");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetch("/api/metric", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, source: widget.source, metricKey: widget.metric_key, days }) })
      .then((r) => r.json()).catch(() => null)
      .then((d) => { if (!dead) { setRes(d?.data ? d : null); setLoading(false); } });
    return () => { dead = true; };
  }, [days, clientId, widget.source, widget.metric_key]);
  const d = res?.data;
  const bd = res?.breakdown;
  const bdMax = bd?.length ? Math.max(...bd.map((b) => b.value), 1) : 1;
  const avg = d?.series?.length ? d.total / d.series.filter((p) => p.v).length : null;
  const best = d?.series?.length ? d.series.reduce((a, p) => (p.v > a.v ? p : a), d.series[0]) : null;
  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-modal-inner wide" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-top">
          <span className="dw-icon">{widget.icon}</span>
          <b style={{ fontSize: 15 }}>{widget.title}</b>
          <span className="muted" style={{ fontSize: 12 }}>{widget.sourceLabel}</span>
          <button className="cal-x" onClick={onClose}>×</button>
        </div>
        <div className="dashx-ranges" style={{ margin: "10px 0" }}>
          {[7, 30, 60, 90, 180, 365].map((r) => (
            <button key={r} className={"pv-tab" + (days === r ? " on" : "")} onClick={() => setDays(r)}>Last {r}d</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className={"pv-tab" + (kind === "line" ? " on" : "")} onClick={() => setKind("line")}>Line</button>
          <button className={"pv-tab" + (kind === "column" ? " on" : "")} onClick={() => setKind("column")}>Columns</button>
        </div>
        {loading || !d ? <div className="muted" style={{ fontSize: 13, padding: 30 }}>{loading ? "Loading…" : "No data."}</div> : (
          <>
            <div className="dw-value" style={{ fontSize: 28 }}>{fmtValue(d.total, d.fmt)} <Delta delta={d.delta} dir={d.dir} /></div>
            <div className="muted" style={{ fontSize: 11.5, margin: "2px 0 8px" }}>vs {fmtValue(d.prev, d.fmt)} the previous {days} days · dashed line = previous period</div>
            <Chart series={d.series} prevSeries={d.prevSeries} kind={kind} fmt={d.fmt} h={220} axes />
            <div className="dw-statsrow">
              <div><span className="muted">Daily avg</span><b>{fmtValue(avg, d.fmt)}</b></div>
              <div><span className="muted">Best day</span><b>{best ? `${fmtValue(best.v, d.fmt)} · ${fmtDay(best.d)}` : "—"}</b></div>
              <div><span className="muted">Previous period</span><b>{fmtValue(d.prev, d.fmt)}</b></div>
            </div>
            {bd?.length > 0 && (
              <div className="dw-bd">
                <div className="dash-sec-head" style={{ marginTop: 14 }}>By campaign</div>
                {bd.map((b, i) => (
                  <div key={i} className="dw-bd-row">
                    <span className="dw-bd-lbl" title={b.label}>{b.label}</span>
                    <span className="dw-bd-bar"><span style={{ width: `${(b.value / bdMax) * 100}%` }} /></span>
                    <b>{fmtValue(b.value, d.fmt)}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- add / edit modal ---------- */
function WidgetModal({ dashboardId, sections, widget, onClose }) {
  const router = useRouter();
  const isNew = !widget?.id;
  const [f, setF] = useState({
    source: widget?.source || "meta_ads",
    metricKey: widget?.metric_key || "spend",
    viz: widget?.viz || "stat",
    title: widget?.rawTitle || "",
    section: widget?.section || sections[0] || "",
    w: widget?.w || 1,
    daysOverride: widget?.daysOverride || 0,
  });
  const [busy, setBusy] = useState(false);
  const metricDef = SOURCES[f.source]?.metrics?.[f.metricKey];
  const vizChoices = metricDef?.vizzes || VIZZES.filter((v) => v !== "donut" && v !== "table");
  const set = (k, v) => setF((x) => {
    const n = { ...x, [k]: v };
    if (k === "source") { n.metricKey = Object.keys(SOURCES[v].metrics)[0]; }
    if (k === "source" || k === "metricKey") {
      const md = SOURCES[n.source].metrics[n.metricKey];
      if (md?.vizzes && !md.vizzes.includes(n.viz)) n.viz = md.vizzes[0];
      if (!md?.vizzes && (n.viz === "donut" || n.viz === "table")) n.viz = "stat";
    }
    return n;
  });
  async function save() {
    setBusy(true);
    try {
      const body = isNew
        ? { op: "add_widget", dashboardId, ...f, daysOverride: f.daysOverride || null }
        : { op: "update_widget", id: widget.id, viz: f.viz, title: f.title, section: f.section, w: f.w, daysOverride: f.daysOverride || null };
      const d = await post(body);
      if (!d.error) { onClose(); router.refresh(); }
    } finally { setBusy(false); }
  }
  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-modal-inner" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 10px" }}>{isNew ? "Add widget" : "Edit widget"}</h3>
        <div className="dwm-grid">
          {isNew && (
            <>
              <label>Data source
                <select value={f.source} onChange={(e) => set("source", e.target.value)}>
                  {Object.entries(SOURCES).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.label}</option>)}
                </select>
              </label>
              <label>Metric
                <select value={f.metricKey} onChange={(e) => set("metricKey", e.target.value)}>
                  {Object.entries(SOURCES[f.source].metrics).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </label>
            </>
          )}
          <label>Visualization
            <select value={f.viz} onChange={(e) => set("viz", e.target.value)}>
              {vizChoices.map((v) => <option key={v} value={v}>{v === "stat" ? "Number" : v[0].toUpperCase() + v.slice(1)}</option>)}
            </select>
          </label>
          <label>Width
            <select value={f.w} onChange={(e) => set("w", Number(e.target.value))}>
              <option value={1}>Normal</option>
              <option value={2}>Wide (2 columns)</option>
            </select>
          </label>
          <label>Date range
            <select value={f.daysOverride} onChange={(e) => set("daysOverride", Number(e.target.value))}>
              <option value={0}>Follow the page range</option>
              {[7, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </label>
          <label>Title <span className="muted">(optional override)</span>
            <input type="text" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={metricDef?.label || ""} />
          </label>
          <label>Section
            <input type="text" list="dash-sections" value={f.section} onChange={(e) => set("section", e.target.value)} placeholder="e.g. Paid Ads · Meta" />
            <datalist id="dash-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
        </div>
        <div className="cal-modal-actions">
          <button className="cal-approve" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Add widget" : "Save"}</button>
          <button className="social-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ClientDashboard({ accountId, clientId, dashboardId, sections, days, ranges, canEdit }) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [modal, setModal] = useState(null); // "new" | widget-data object
  const [drill, setDrill] = useState(null); // widget-data object -> full breakdown
  const sectionNames = sections.map((s) => s.title).filter(Boolean);

  async function move(id, dir) { await post({ op: "move_widget", id, dir }); router.refresh(); }
  async function del(id) {
    if (!window.confirm("Remove this widget?")) return;
    await post({ op: "delete_widget", id }); router.refresh();
  }

  return (
    <div className="dashx">
      <div className="dashx-bar">
        <div className="dashx-ranges">
          {ranges.map((r) => (
            <Link key={r} href={`/accounts/${accountId}/dashboard?days=${r}`} className={"pv-tab" + (days === r ? " on" : "")}>Last {r} days</Link>
          ))}
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            {editMode && <button className="social-btn" onClick={() => setModal("new")}>+ Add widget</button>}
            <button className={editMode ? "cal-approve" : "social-btn"} onClick={() => setEditMode(!editMode)}>{editMode ? "Done editing" : "✎ Edit dashboard"}</button>
          </div>
        )}
      </div>

      {sections.length === 0 && (
        <div className="panel"><div className="muted" style={{ fontSize: 13 }}>
          No data sources feeding this dashboard yet — once ad, social, GA4 or leads data exists for this client, an Overview builds itself.
        </div></div>
      )}

      {sections.map((sec, si) => (
        <div key={si} className="dash-section">
          {sec.title && <div className="dash-sec-head">{sec.title}</div>}
          <div className="dash-grid">
            {sec.widgets.map((d) => (
              <Widget key={d.id} d={d} editMode={editMode}
                onEdit={() => setModal(d)}
                onMove={(dir) => move(d.id, dir)}
                onDelete={() => del(d.id)}
                onOpen={() => setDrill(d.metric_key === "spend_by_campaign" ? { ...d, metric_key: "spend", title: "Ad Spend" } : d)} />
            ))}
          </div>
        </div>
      ))}

      {drill && <MetricModal clientId={clientId} widget={drill} onClose={() => setDrill(null)} />}

      {modal && (
        <WidgetModal dashboardId={dashboardId} sections={sectionNames} onClose={() => setModal(null)}
          widget={modal === "new" ? null : {
            id: modal.id, source: modal.source, metric_key: modal.metric_key, viz: modal.viz,
            rawTitle: modal.titleOverride || "", section: modal.section, w: modal.w, daysOverride: modal.overridden ? modal.days : 0,
          }} />
      )}
    </div>
  );
}
