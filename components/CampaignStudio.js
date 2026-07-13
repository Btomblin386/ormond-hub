"use client";
import { useState } from "react";

export default function CampaignStudio({ client, initialPlan }) {
  const [plan, setPlan] = useState(initialPlan || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setLoading(true);
    setErr("");
    try {
      const resp = await fetch("/api/campaign-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client }),
      });
      const data = await resp.json();
      if (data.error) setErr(data.error);
      else if (data.plan) setPlan(data.plan);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Campaign Studio</h2>
        <button className="studio-btn" onClick={generate} disabled={loading}>
          {loading ? "Building plan…" : plan ? "Regenerate plan" : "Generate campaign plan"}
        </button>
      </div>
      <p className="note">AI evaluates your top campaigns vs. trending products, lists the content you&apos;ll need, and drafts campaigns to your best audiences. Drafts are advisory — pushing to Meta (paused for approval) is the next step.</p>

      {err && <div className="err-box">Error: {err}</div>}

      {!plan && !loading && <div className="muted" style={{ fontSize: 13 }}>No plan yet — click Generate.</div>}

      {plan && (
        <>
          {plan.summary && <div className="studio-summary">{plan.summary}</div>}

          {Array.isArray(plan.materials) && plan.materials.length > 0 && (
            <div className="studio-block">
              <div className="studio-h">Content & materials needed</div>
              <ul className="studio-list">
                {plan.materials.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {Array.isArray(plan.campaigns) && plan.campaigns.length > 0 && (
            <div className="studio-block">
              <div className="studio-h">Drafted campaigns</div>
              <div className="studio-campaigns">
                {plan.campaigns.map((c, i) => (
                  <div key={i} className="draft-card">
                    <div className="draft-top">
                      <div className="draft-name">{c.name}</div>
                      <span className="draft-budget">{c.daily_budget}/day</span>
                    </div>
                    <div className="draft-meta">
                      {c.objective && <span className="pill">{c.objective}</span>}
                      {Array.isArray(c.products) && c.products.map((p, j) => <span key={j} className="pill">{p}</span>)}
                    </div>
                    {c.audience && <div className="draft-row"><b>Audience:</b> {c.audience}</div>}
                    {c.angle && <div className="draft-row"><b>Angle:</b> {c.angle}</div>}
                    {c.headline && <div className="draft-row"><b>Headline:</b> {c.headline}</div>}
                    {c.primary_text && <div className="draft-copy">{c.primary_text}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
