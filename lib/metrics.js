// Normalized metric engine for client analytics dashboards.
// Every widget = one metric from one source rendered as one viz. All sources
// reduce to the same shape: { series, prevSeries, total, prev, delta, cats?, rows? }.
// Pure JS over the raw daily rows from dashboardRaw() — no queries per widget.

export const SOURCES = {
  meta_ads: {
    label: "Meta Ads", icon: "📣",
    metrics: {
      spend:       { label: "Ad Spend", fmt: "money", dir: 0, agg: "sum", field: "spend" },
      impressions: { label: "Impressions", fmt: "int", dir: 1, agg: "sum", field: "impressions" },
      clicks:      { label: "Link Clicks", fmt: "int", dir: 1, agg: "sum", field: "clicks" },
      conversions: { label: "Conversions", fmt: "num", dir: 1, agg: "sum", field: "conversions" },
      revenue:     { label: "Conversion Value", fmt: "money", dir: 1, agg: "sum", field: "revenue" },
      ctr:         { label: "CTR", fmt: "pct", dir: 1, ratio: ["clicks", "impressions"], scale: 100 },
      cpc:         { label: "Avg CPC", fmt: "money2", dir: -1, ratio: ["spend", "clicks"] },
      roas:        { label: "ROAS", fmt: "num2", dir: 1, ratio: ["revenue", "spend"] },
      cpa:         { label: "Cost / Conversion", fmt: "money2", dir: -1, ratio: ["spend", "conversions"] },
      spend_by_campaign: { label: "Spend by Campaign", fmt: "money", dir: 0, kind: "cat", vizzes: ["donut"] },
      campaign_table:    { label: "Campaign Performance", fmt: "money", dir: 0, kind: "table", vizzes: ["table"] },
    },
  },
  ga4: {
    label: "Google Analytics", icon: "📈",
    metrics: {
      sessions:  { label: "Sessions", fmt: "int", dir: 1, agg: "sum", field: "sessions", seg: "total" },
      revenue:   { label: "Purchase Revenue", fmt: "money", dir: 1, agg: "sum", field: "revenue", seg: "total" },
      purchases: { label: "Purchases", fmt: "int", dir: 1, agg: "sum", field: "purchases", seg: "total" },
      aov:       { label: "Avg Order Value", fmt: "money2", dir: 1, ratio: ["revenue", "purchases"], seg: "total" },
      paid_revenue: { label: "Meta-attributed Revenue", fmt: "money", dir: 1, agg: "sum", field: "revenue", seg: "meta_paid" },
    },
  },
  facebook: {
    label: "Facebook", icon: "📘",
    metrics: {
      fb_followers: { label: "Page Followers", fmt: "int", dir: 1, kind: "level", field: "fb_followers" },
      fb_fans:      { label: "Page Likes", fmt: "int", dir: 1, kind: "level", field: "fb_fans" },
    },
  },
  instagram: {
    label: "Instagram", icon: "📸",
    metrics: {
      ig_followers:   { label: "Followers", fmt: "int", dir: 1, kind: "level", field: "ig_followers" },
      ig_reach:       { label: "Reach", fmt: "int", dir: 1, agg: "sum", field: "ig_reach_day" },
      ig_media_count: { label: "Posts", fmt: "int", dir: 1, kind: "level", field: "ig_media_count" },
    },
  },
  leads: {
    label: "Lead Ads", icon: "🎯",
    metrics: {
      leads: { label: "Leads", fmt: "int", dir: 1, agg: "sum", field: "n" },
    },
  },
};

export const VIZZES = ["stat", "line", "column", "donut", "table"];

/* ---------- formatting ---------- */
const abbr = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return null;
};
export function fmtValue(v, fmt) {
  if (v == null || !isFinite(v)) return "—";
  const short = abbr(v);
  switch (fmt) {
    case "money":  return "$" + (short || Math.round(v).toLocaleString("en-US"));
    case "money2": return "$" + (short || v.toFixed(2));
    case "pct":    return v.toFixed(2) + "%";
    case "num2":   return short || v.toFixed(2);
    case "num":    return short || (Math.round(v * 10) / 10).toLocaleString("en-US");
    default:       return short || Math.round(v).toLocaleString("en-US");
  }
}

/* ---------- date windows ---------- */
const dayKey = (d) => d.toISOString().slice(0, 10);
function windowKeys(days, offset = 0, includeToday = false) {
  // Ad-platform data lags ~1 day, so those windows end yesterday. Real-time
  // sources (leads) and level metrics (follower counts) include today.
  const keys = [];
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - (includeToday ? 0 : 1) - offset * days);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

/* ---------- per-source daily lookup ---------- */
function dailyMap(raw, source, def) {
  const m = new Map();
  if (source === "meta_ads") {
    for (const r of raw.meta) {
      const cur = m.get(r.date) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      for (const k of ["spend", "impressions", "clicks", "conversions", "revenue"]) cur[k] += Number(r[k] || 0);
      m.set(r.date, cur);
    }
  } else if (source === "ga4") {
    for (const r of raw.ga4) if (r.segment === (def.seg || "total")) m.set(r.date, r);
  } else if (source === "facebook" || source === "instagram") {
    for (const r of raw.page) m.set(r.date, r);
  } else if (source === "leads") {
    for (const r of raw.leads) m.set(r.date, r);
  }
  return m;
}

function seriesFor(map, keys, field) {
  return keys.map((k) => ({ d: k, v: Number(map.get(k)?.[field] ?? 0) }));
}
const sum = (s) => s.reduce((a, p) => a + p.v, 0);
const lastNonZero = (s) => { for (let i = s.length - 1; i >= 0; i--) if (s[i].v) return s[i].v; return 0; };

/* ---------- the one compute function ---------- */
export function computeWidget(widget, raw, pageDays) {
  const src = SOURCES[widget.source];
  const def = src?.metrics?.[widget.metric_key];
  if (!def) return null;
  const days = widget.days_override || pageDays;
  const fresh = def.kind === "level" || widget.source === "leads";
  const cur = windowKeys(days, 0, fresh), prev = windowKeys(days, 1, fresh);
  const map = dailyMap(raw, widget.source, def);

  const out = {
    id: widget.id, section: widget.section, viz: widget.viz, metric_key: widget.metric_key,
    title: widget.title || def.label, titleOverride: widget.title || "",
    source: widget.source, sourceLabel: src.label, icon: src.icon,
    fmt: def.fmt, dir: def.dir, days, overridden: !!widget.days_override,
    w: widget.config?.w || 1,
  };

  if (def.kind === "cat" || def.kind === "table") {
    // Campaign-level (meta only): aggregate the current window per campaign.
    const inWin = new Set(cur);
    const byCamp = new Map();
    for (const r of raw.meta) {
      if (!inWin.has(r.date)) continue;
      const c = byCamp.get(r.campaign) || { name: r.campaign, spend: 0, clicks: 0, conversions: 0, revenue: 0 };
      c.spend += +r.spend; c.clicks += +r.clicks; c.conversions += +r.conversions; c.revenue += +r.revenue;
      byCamp.set(r.campaign, c);
    }
    const rows = [...byCamp.values()].filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);
    if (def.kind === "table") {
      out.rows = rows.slice(0, 8).map((c) => ({ ...c, roas: c.spend ? c.revenue / c.spend : null }));
    } else {
      const top = rows.slice(0, 6);
      const rest = rows.slice(6).reduce((a, c) => a + c.spend, 0);
      out.cats = top.map((c) => ({ label: c.name, value: c.spend }));
      if (rest > 0) out.cats.push({ label: "Other", value: rest });
      out.total = rows.reduce((a, c) => a + c.spend, 0);
    }
    return out;
  }

  if (def.ratio) {
    const [numF, denF] = def.ratio;
    const scale = def.scale || 1;
    const nCur = seriesFor(map, cur, SOURCES[widget.source].metrics[numF]?.field || numF);
    const dCur = seriesFor(map, cur, SOURCES[widget.source].metrics[denF]?.field || denF);
    const nPrev = seriesFor(map, prev, SOURCES[widget.source].metrics[numF]?.field || numF);
    const dPrev = seriesFor(map, prev, SOURCES[widget.source].metrics[denF]?.field || denF);
    out.series = cur.map((k, i) => ({ d: k, v: dCur[i].v ? (nCur[i].v / dCur[i].v) * scale : 0 }));
    out.total = sum(dCur) ? (sum(nCur) / sum(dCur)) * scale : null;
    out.prev = sum(dPrev) ? (sum(nPrev) / sum(dPrev)) * scale : null;
  } else if (def.kind === "level") {
    const s = seriesFor(map, cur, def.field);
    const p = seriesFor(map, prev, def.field);
    // carry-forward gaps so the line doesn't dive to zero on missed snapshots
    let last = lastNonZero(p) || 0;
    out.series = s.map((pt) => { if (pt.v) last = pt.v; return { d: pt.d, v: last }; });
    out.total = lastNonZero(s) || last || null;
    out.prev = lastNonZero(p) || null;
  } else {
    out.series = seriesFor(map, cur, def.field);
    out.prevSeries = seriesFor(map, prev, def.field);
    out.total = sum(out.series);
    out.prev = sum(out.prevSeries);
  }
  out.delta = out.prev ? ((out.total - out.prev) / Math.abs(out.prev)) * 100 : null;
  return out;
}

// Per-campaign breakdown of a Meta metric over the current window (drill-down).
export function computeBreakdown(source, metricKey, raw, days) {
  if (source !== "meta_ads") return null;
  const def = SOURCES.meta_ads.metrics[metricKey];
  if (!def || def.kind) return null;
  const inWin = new Set(windowKeys(days));
  const byCamp = new Map();
  for (const r of raw.meta) {
    if (!inWin.has(r.date)) continue;
    const c = byCamp.get(r.campaign) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    for (const k of ["spend", "impressions", "clicks", "conversions", "revenue"]) c[k] += Number(r[k] || 0);
    byCamp.set(r.campaign, c);
  }
  const val = (c) => def.ratio
    ? (c[def.ratio[1]] ? (c[def.ratio[0]] / c[def.ratio[1]]) * (def.scale || 1) : 0)
    : c[def.field];
  return [...byCamp.entries()]
    .map(([label, c]) => ({ label, value: val(c), spend: c.spend }))
    .filter((x) => x.spend > 0 || x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

// Group computed widgets into ordered sections (first-appearance order).
export function computeSections(widgets, raw, pageDays) {
  const bySection = [];
  const idx = new Map();
  for (const w of widgets) {
    const data = computeWidget(w, raw, pageDays);
    if (!data) continue;
    const key = w.section || "";
    if (!idx.has(key)) { idx.set(key, bySection.length); bySection.push({ title: key, widgets: [] }); }
    bySection[idx.get(key)].widgets.push(data);
  }
  return bySection;
}

// Largest window any widget needs (×2 for the comparison period), for one raw fetch.
export function rawSpan(widgets, pageDays) {
  let m = pageDays;
  for (const w of widgets) if (w.days_override && w.days_override > m) m = w.days_override;
  return m * 2 + 2;
}
