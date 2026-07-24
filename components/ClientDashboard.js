"use client";
import { useState } from "react";
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

/* ---------- tiny SVG charts (dependency-free) ---------- */
function pts(series, w, h, max) {
  const m = max || Math.max(...series.map((p) => p.v), 1);
  const step = series.length > 1 ? w / (series.length - 1) : w;
  return series.map((p, i) => `${(i * step).toFixed(1)},${(h - (p.v / m) * (h - 3) - 1).toFixed(1)}`).join(" ");
}
function Spark({ series }) {
  if (!series?.length) return null;
  return (
    <svg className="dw-spark" viewBox="0 0 96 26" preserveAspectRatio="none">
      <polyline points={pts(series, 96, 26)} fill="none" stroke="#6366f1" strokeWidth="1.6" />
    </svg>
  );
}
function LineChart({ series, prevSeries }) {
  if (!series?.length) return null;
  const max = Math.max(...series.map((p) => p.v), ...(prevSeries || []).map((p) => p.v), 1);
  return (
    <svg className="dw-chart" viewBox="0 0 320 110" preserveAspectRatio="none">
      {prevSeries?.length > 0 && <polyline points={pts(prevSeries, 320, 110, max)} fill="none" stroke="#d7dbe3" strokeWidth="1.5" strokeDasharray="4 3" />}
      <polyline points={pts(series, 320, 110, max)} fill="none" stroke="#6366f1" strokeWidth="2" />
    </svg>
  );
}
function Bars({ series }) {
  if (!series?.length) return null;
  const max = Math.max(...series.map((p) => p.v), 1);
  const bw = 320 / series.length;
  return (
    <svg className="dw-chart" viewBox="0 0 320 110" preserveAspectRatio="none">
      {series.map((p, i) => {
        const h = (p.v / max) * 104;
        return <rect key={i} x={i * bw + bw * 0.15} y={110 - h} width={bw * 0.7} height={h} rx="1.5" fill="#6366f1" opacity="0.85" />;
      })}
    </svg>
  );
}
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

function Widget({ d, editMode, onEdit, onMove, onDelete }) {
  return (
    <div className={"dw" + (d.w === 2 ? " w2" : "")}>
      <div className="dw-head">
        <span className="dw-icon" title={d.sourceLabel}>{d.icon}</span>
        <span className="dw-title">{d.title}</span>
        {d.overridden && <span className="dw-range">({d.days}d)</span>}
        {editMode && (
          <span className="dw-tools">
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
          {d.viz === "line" ? <LineChart series={d.series} prevSeries={d.prevSeries} /> : <Bars series={d.series} />}
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

export default function ClientDashboard({ accountId, dashboardId, sections, days, ranges, canEdit }) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [modal, setModal] = useState(null); // "new" | widget-data object
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
                onDelete={() => del(d.id)} />
            ))}
          </div>
        </div>
      ))}

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
