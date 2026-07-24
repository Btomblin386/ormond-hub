"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SOURCES, VIZZES, fmtValue } from "../lib/metrics";
import EChart from "./EChart";

// Renders a client analytics dashboard (sections -> widgets) plus a light
// editor for agency/manager. Clients see the same page read-only.

const PALETTE = ["#6366f1", "#00c875", "#fdab3d", "#e2445c", "#0ea5e9", "#a855f7", "#94a3b8"];

async function post(body) {
  const r = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

/* ---------- SVG charts (dependency-free, hoverable) ---------- */
const fmtDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const AREA = { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(99,102,241,.20)" }, { offset: 1, color: "rgba(99,102,241,.01)" }] };

function Spark({ series }) {
  if (!series?.length) return null;
  return (
    <div className="dw-spark">
      <EChart height={30} option={{
        animation: false,
        grid: { left: 2, right: 2, top: 4, bottom: 2 },
        xAxis: { type: "category", show: false, boundaryGap: false, data: series.map((p) => p.d) },
        yAxis: { type: "value", show: false },
        series: [{ type: "line", data: series.map((p) => p.v), smooth: 0.45, showSymbol: false,
          lineStyle: { color: "#6366f1", width: 1.6 }, areaStyle: { color: AREA } }],
      }} />
    </div>
  );
}

// Shared chart (ECharts): smooth line + prev-period dashed overlay, or bars.
// Tooltip shows the date with current + previous-period values.
function Chart({ series, prevSeries, kind = "line", fmt, h = 110, axes = false }) {
  if (!series?.length) return null;
  const isBar = kind === "column";
  const option = {
    animation: false,
    grid: { left: axes ? 8 : 2, right: 6, top: 10, bottom: axes ? 4 : 2, containLabel: axes },
    tooltip: {
      trigger: "axis", confine: true,
      backgroundColor: "#1f2430", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        let s = `<b>${fmtDay(series[i].d)}</b><br/>` +
          `<span style="color:#8b93f8">●</span> ${fmtValue(series[i].v, fmt)}`;
        if (prevSeries?.[i] != null) s += `<br/><span style="color:#9aa1ad">●</span> ${fmtValue(prevSeries[i].v, fmt)} <span style="color:#9aa1ad;font-size:10px">prev period</span>`;
        return s;
      },
    },
    xAxis: {
      type: "category", data: series.map((p) => fmtDay(p.d)), show: axes, boundaryGap: isBar,
      axisLine: { lineStyle: { color: "#e6e8eb" } }, axisTick: { show: false },
      axisLabel: { color: "#9ca3af", fontSize: 10, hideOverlap: true },
    },
    yAxis: {
      type: "value", show: axes, splitNumber: 4,
      axisLabel: { color: "#9ca3af", fontSize: 10, formatter: (v) => fmtValue(v, fmt) },
      splitLine: { lineStyle: { color: "#f0f1f4" } },
    },
    series: [
      prevSeries?.length ? {
        type: "line", data: prevSeries.map((p) => p.v), smooth: 0.45, showSymbol: false, symbol: "circle", symbolSize: 6,
        lineStyle: { color: "#cfd4dd", width: 1.5, type: "dashed" }, itemStyle: { color: "#b6bcc7" }, z: 1,
      } : null,
      {
        type: isBar ? "bar" : "line", data: series.map((p) => p.v), smooth: 0.45, showSymbol: false,
        symbol: "circle", symbolSize: 7,
        itemStyle: { color: "#6366f1", borderRadius: isBar ? [3, 3, 0, 0] : 0 },
        lineStyle: { color: "#6366f1", width: 2.2 },
        areaStyle: isBar ? undefined : { color: AREA },
        emphasis: { itemStyle: { color: "#6366f1", borderColor: "#fff", borderWidth: 2 } },
        barMaxWidth: 20, z: 2,
      },
    ].filter(Boolean),
  };
  return <EChart option={option} height={h} />;
}
const LineChart = (p) => <Chart {...p} kind="line" />;
const Bars = (p) => <Chart {...p} kind="column" />;
function Donut({ cats, total, fmt }) {
  const sum = cats.reduce((a, c) => a + c.value, 0) || 1;
  return (
    <div className="dw-donut">
      <div className="dw-donut-svg">
        <EChart height={130} option={{
          animation: false,
          title: { text: fmtValue(total, fmt), left: "center", top: "middle", textStyle: { fontSize: 14, fontWeight: 700, color: "#111827" } },
          tooltip: {
            confine: true, backgroundColor: "#1f2430", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 },
            formatter: (p) => `<b>${p.name}</b><br/>${fmtValue(p.value, fmt)} · ${((p.value / sum) * 100).toFixed(1)}%`,
          },
          series: [{ type: "pie", radius: ["64%", "90%"], avoidLabelOverlap: true, label: { show: false },
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            color: PALETTE,
            data: cats.map((c) => ({ name: c.label, value: c.value })) }],
        }} />
      </div>
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
