"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { money, num, roas, roasClass } from "../lib/format";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => new Date(s + "T00:00:00");
function shiftDays(base, n) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - n);
}
const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Delta({ cur, prev, goodUp }) {
  if (!(prev > 0)) return <span className="delta flat">—</span>;
  const ch = (cur - prev) / prev;
  const up = ch >= 0;
  const cls = goodUp === null ? "neutral" : (up === goodUp ? "up" : "down");
  return (
    <span className={"delta " + cls}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(ch * 100))}%
    </span>
  );
}

// Monday-start week bucket, so long ranges read as a weekly series
function weekStart(dstr) {
  const d = fromIso(dstr);
  return isoDay(shiftDays(d, (d.getDay() + 6) % 7));
}
function bucketWeekly(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = weekStart(r.date);
    const o = m.get(k) || { date: k, spend: 0, revenue: 0 };
    o.spend += r.spend; o.revenue += r.revenue;
    m.set(k, o);
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
// least-squares line over revenue
function withTrend(rows) {
  const n = rows.length;
  if (n < 3) return rows;
  const ys = rows.map((r) => r.revenue);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; }
  const denom = n * sxx - sx * sx;
  if (!denom) return rows;
  const slope = (n * sxy - sx * sy) / denom, icept = (sy - slope * sx) / n;
  return rows.map((r, i) => ({ ...r, trend: Math.max(0, Math.round(slope * i + icept)) }));
}

function RangeChart({ data, weekly }) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#f0f1f3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} tickFormatter={(d) => d.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtMoney} width={64} />
          <Tooltip formatter={(v) => fmtMoney(v)} labelFormatter={(d) => (weekly ? "Week of " + d : d)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="spend" name="Spend" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="trend" name="Revenue trend" stroke="#047857" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Quick-analytics modal ---------------- */
const PRESETS = [7, 14, 30, 90];

function QuickAnalytics({ account, endDate, onClose }) {
  const end = endDate ? fromIso(endDate) : shiftDays(new Date(), 1);
  const [from, setFrom] = useState(isoDay(shiftDays(end, 6)));
  const [to, setTo] = useState(isoDay(end));
  const [active, setActive] = useState(7);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState("");
  const [sumBusy, setSumBusy] = useState(false);

  async function load(f, t) {
    setBusy(true); setErr(""); setSummary("");
    try {
      const r = await fetch("/api/analytics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: account.id, from: f, to: t }),
      });
      const d = await r.json();
      if (d.error) setErr("Error: " + d.error); else setData(d);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }
  useEffect(() => { load(from, to); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function preset(n) {
    const f = isoDay(shiftDays(end, n - 1)), t = isoDay(end);
    setFrom(f); setTo(t); setActive(n); load(f, t);
  }
  function applyCustom() { setActive("custom"); load(from, to); }

  const t = data?.totals, p = data?.prev;
  const spanDays = data ? Math.round((fromIso(to) - fromIso(from)) / 86400000) + 1 : 0;
  const weekly = spanDays > 30;
  const series = useMemo(() => {
    if (!data) return [];
    return withTrend(weekly ? bucketWeekly(data.trend) : data.trend);
  }, [data, weekly]);

  async function summarize() {
    if (!data) return;
    setSumBusy(true); setSummary("");
    try {
      const r = await fetch("/api/analytics-summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: account.client, from, to, totals: data.totals, prev: data.prev, prevRange: data.prevRange, trend: series.map(({ date, spend, revenue }) => ({ date, spend: Math.round(spend), revenue: Math.round(revenue) })) }),
      });
      const d = await r.json();
      setSummary(d.summary || (d.error ? "Error: " + d.error : "No summary."));
    } catch (e) { setSummary("Error: " + String(e)); } finally { setSumBusy(false); }
  }

  const kpis = t && [
    { label: "Spend", value: money(t.spend), cur: t.spend, prev: p.spend, goodUp: null },
    { label: "Revenue", value: money(t.revenue), cur: t.revenue, prev: p.revenue, goodUp: true },
    { label: "ROAS", value: roas(t.revenue, t.spend).toFixed(1) + "x", cur: roas(t.revenue, t.spend), prev: roas(p.revenue, p.spend), goodUp: true, cls: roasClass(roas(t.revenue, t.spend)) },
    { label: "Conversions", value: num(Math.round(t.conversions)), cur: t.conversions, prev: p.conversions, goodUp: true },
    { label: "Clicks", value: num(Math.round(t.clicks)), cur: t.clicks, prev: p.clicks, goodUp: true },
    { label: "Impressions", value: num(Math.round(t.impressions)), cur: t.impressions, prev: p.impressions, goodUp: true },
  ];

  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-modal-inner qa-inner" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-top">
          <span className="cal-modal-client">{account.client}</span>
          {account.platform && <span className={"pill" + (account.platform === "google" ? " google" : "")}>{account.platform}</span>}
          <Link className="qa-full" href={`/accounts/${account.id}`}>Full account →</Link>
          <button className="cal-x" onClick={onClose}>×</button>
        </div>

        <div className="qa-ranges">
          {PRESETS.map((n) => (
            <button key={n} className={"rng" + (active === n ? " active" : "")} onClick={() => preset(n)}>{n}d</button>
          ))}
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>→</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          <button className={"rng" + (active === "custom" ? " active" : "")} onClick={applyCustom} disabled={busy}>Apply</button>
        </div>

        {err && <div className="push-err">{err}</div>}
        {!data && !err && <div className="muted" style={{ fontSize: 13 }}>Loading…</div>}

        {kpis && (
          <>
            <div className="qa-kpis">
              {kpis.map((k) => (
                <div key={k.label} className="qa-kpi">
                  <div className="label">{k.label}</div>
                  <div className={"value " + (k.cls || "")}>{k.value}</div>
                  <Delta cur={k.cur} prev={k.prev} goodUp={k.goodUp} />
                </div>
              ))}
            </div>
            <div className="qa-prev">
              vs. previous period {data.prevRange.from} → {data.prevRange.to}
              {weekly ? " · charted weekly" : ""}{busy ? " · updating…" : ""}
            </div>
            <div className="qa-sumrow">
              <button className="rng" onClick={summarize} disabled={sumBusy}>{sumBusy ? "Summarizing…" : "✨ AI summary"}</button>
            </div>
            {summary && <div className="qa-sum">{summary}</div>}
            <RangeChart data={series} weekly={weekly} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Trend cards ---------------- */
export default function AccountTrends({ accounts, trends, endDate }) {
  const [sel, setSel] = useState(null);

  // 14 full-data days ending endDate (last complete ingest day), zero-filled
  const dates = useMemo(() => {
    const end = endDate ? fromIso(endDate) : shiftDays(new Date(), 1);
    const out = [];
    for (let i = 13; i >= 0; i--) out.push(isoDay(shiftDays(end, i)));
    return out;
  }, [endDate]);

  const byClient = useMemo(() => {
    const m = {};
    for (const r of trends) (m[r.client_id] ||= {})[r.date] = r;
    return m;
  }, [trends]);

  const cards = useMemo(() => accounts.map((a) => {
    const rows = byClient[a.id] || {};
    const series = dates.map((dt) => ({ date: dt, spend: rows[dt]?.spend || 0, revenue: rows[dt]?.revenue || 0 }));
    const sum = (arr, k) => arr.reduce((s, r) => s + r[k], 0);
    const last7 = series.slice(7), prior7 = series.slice(0, 7);
    return {
      account: a, series: last7,
      spend: sum(last7, "spend"), prevSpend: sum(prior7, "spend"),
      revenue: sum(last7, "revenue"), prevRevenue: sum(prior7, "revenue"),
    };
  }), [accounts, byClient, dates]);

  if (!cards.length) return <div className="muted" style={{ fontSize: 13 }}>No ad accounts yet.</div>;

  return (
    <>
      <div className="trend-grid">
        {cards.map(({ account: a, series, spend, prevSpend, revenue, prevRevenue }) => {
          const r = roas(revenue, spend), pr = roas(prevRevenue, prevSpend);
          return (
            <button key={a.id} className="trend-card" onClick={() => setSel(a)}>
              <div className="tc-head">
                <span className="tc-name">{a.client}</span>
                {a.platform && <span className={"pill" + (a.platform === "google" ? " google" : "")}>{a.platform}</span>}
              </div>
              <div className="tc-spark">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <Line type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="tc-stats">
                <div className="tc-stat"><span className="lbl">Spend</span><span className="val">{money(spend)}</span><Delta cur={spend} prev={prevSpend} goodUp={null} /></div>
                <div className="tc-stat"><span className="lbl">Revenue</span><span className="val">{money(revenue)}</span><Delta cur={revenue} prev={prevRevenue} goodUp={true} /></div>
                <div className="tc-stat"><span className="lbl">ROAS</span><span className={"val " + roasClass(r)}>{r.toFixed(1)}x</span><Delta cur={r} prev={pr} goodUp={true} /></div>
              </div>
            </button>
          );
        })}
      </div>
      {sel && <QuickAnalytics account={sel} endDate={endDate} onClose={() => setSel(null)} />}
    </>
  );
}
