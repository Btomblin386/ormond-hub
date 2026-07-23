"use client";

// Page-growth cards + sparklines from daily snapshots (page_stats_daily).
// Deltas compare the latest snapshot to ~7 days back (or the earliest one
// while history is still accumulating).
function Spark({ points, color = "#4f46e5" }) {
  const vals = points.filter((v) => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const W = 120, H = 34, span = max - min || 1;
  const step = W / (vals.length - 1);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="growth-spark" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ now, then }) {
  if (now == null || then == null || now === then) return null;
  const diff = now - then;
  return <span className={"growth-delta " + (diff > 0 ? "up" : "down")}>{diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString()}</span>;
}

export default function PageGrowth({ stats, igUsername }) {
  if (!stats?.length) return null;
  const latest = stats[stats.length - 1];
  const weekAgo = stats.length > 7 ? stats[stats.length - 8] : stats[0];
  const single = stats.length < 2;

  const cards = [
    { label: "Facebook followers", now: latest.fb_followers, then: weekAgo.fb_followers, series: stats.map((s) => s.fb_followers), color: "#2563eb" },
    { label: igUsername ? `Instagram followers` : null, now: latest.ig_followers, then: weekAgo.ig_followers, series: stats.map((s) => s.ig_followers), color: "#d946ef" },
    { label: latest.ig_reach_day != null ? "IG reach (yesterday)" : null, now: latest.ig_reach_day, then: weekAgo.ig_reach_day, series: stats.map((s) => s.ig_reach_day), color: "#059669" },
  ].filter((c) => c.label && c.now != null);
  if (!cards.length) return null;

  return (
    <div className="panel">
      <h2>Page growth</h2>
      <p className="note">Daily snapshots of follower counts and reach{single ? " — history builds from today; trend lines appear after a few days" : ` · last ${stats.length} days`}.</p>
      <div className="growth-cards">
        {cards.map((c) => (
          <div key={c.label} className="growth-card">
            <div className="label">{c.label}</div>
            <div className="growth-val">{c.now.toLocaleString()} <Delta now={c.now} then={c.then} /></div>
            <Spark points={c.series} color={c.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
