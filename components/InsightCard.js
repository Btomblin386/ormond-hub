"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InsightCard({ client, insight, pinned }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pinned ? "unpin" : "pin",
          client,
          scope: insight.scope,
          category: insight.category,
          title: insight.title,
          detail: insight.detail,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={"insight " + insight.category}>
      <div className="ihead">
        <span className={"badge " + insight.category}>{insight.category}</span>
        <span className="sev">{insight.severity}</span>
        <button
          className={"pin-btn" + (pinned ? " pinned" : "")}
          onClick={toggle}
          disabled={busy}
          title={pinned ? "Unpin" : "Pin to track"}
        >
          {pinned ? "★ Pinned" : "☆ Pin"}
        </button>
      </div>
      <div className="ititle">{insight.title}</div>
      {insight.scope && insight.scope !== "account" && <div className="iscope">{insight.scope}</div>}
      <div className="idetail">{insight.detail}</div>
    </div>
  );
}
