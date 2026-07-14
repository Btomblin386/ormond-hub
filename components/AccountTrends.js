"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import TrendChart from "./TrendChart";
import { money, num, roas, roasClass } from "../lib/format";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function daysAgo(n) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
}

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

/* ---------------- Quick-analytics modal ---------------- */
const PRESETS = [7, 14, 30, 90];

function QuickAnalytics({ account, onClose }) {
  const [from, setFrom] = useState(isoDay(daysAgo(6)));
  const [to, setTo] = useState(isoDay(daysAgo(0)));
  const [active, setActive] = useState(7);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load(f, t) {
    setBusy(true); setErr("");
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
    const f = isoDay(daysAgo(n - 1)), t = isoDay(daysAgo(0));
    setFrom(f); setTo(t); setActive(n); load(f, t);
  }
  function applyCustom() { setActive("custom"); load(from, to); }

  const t = data?.totals, p = data?.prev;
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
            <div className="qa-prev">vs. previous period {data.prevRange.from} → {data.prevRange.to}{busy ? " · updating…" : ""}</div>
            <TrendChart data={data.trend} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Trend cards ---------------- */
export default function AccountTrends({ accounts, trends }) {
  const [sel, setSel] = useState(null);

  // last 14 calendar days, zero-filled so sparse data doesn't distort the line
  const dates = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) out.push(isoDay(daysAgo(i)));
    return out;
  }, []);

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
      {sel && <QuickAnalytics account={sel} onClose={() => setSel(null)} />}
    </>
  );
}
