"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }));

function daysAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function PinnedItem({ client, item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const unpin = async () => {
    setBusy(true);
    try {
      await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpin", client, scope: item.scope, title: item.title }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const base = item.baseline_revenue;
  const cur = item.current_revenue;
  const hasDelta = base != null && cur != null && base > 0;
  const deltaPct = hasDelta ? Math.round(((cur - base) / base) * 100) : null;
  const deltaClass = deltaPct == null ? "" : deltaPct >= 0 ? "roas-good" : "roas-low";

  return (
    <div className="pinned-item">
      <div className="pinned-head">
        <div>
          <div className="ititle">{item.title}</div>
          {item.scope && item.scope !== "account" && <div className="iscope">{item.scope}</div>}
        </div>
        <button className="pin-btn pinned" onClick={unpin} disabled={busy} title="Unpin">★ Unpin</button>
      </div>
      <div className="pinned-track">
        <span className="pinned-when">Pinned {daysAgo(item.pinned_at)}</span>
        {hasDelta ? (
          <span>
            Baseline ({item.baseline_month}) {money(base)} → Latest ({item.current_month}) {money(cur)}{" "}
            <b className={deltaClass}>{deltaPct >= 0 ? "+" : ""}{deltaPct}%</b>
          </span>
        ) : (
          <span className="muted">Tracking baseline captured; check back after new monthly data.</span>
        )}
      </div>
    </div>
  );
}
