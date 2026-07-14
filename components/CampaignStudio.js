"use client";
import { useState } from "react";

function DraftCard({ accountExt, campaign }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const budget = Number(String(campaign.daily_budget || "").replace(/[^0-9.]/g, "")) || 20;

  async function push() {
    if (!link) { setResult({ error: "Add a destination URL first." }); return; }
    if (!window.confirm(`Create "${campaign.name}" in Meta as a PAUSED campaign at $${budget}/day? It will not run until you activate it.`)) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_ext: accountExt,
          name: campaign.name,
          objective: campaign.objective,
          daily_budget: budget,
          link,
          image_url: imageUrl || undefined,
          primary_text: campaign.primary_text,
          headline: campaign.headline,
        }),
      });
      const d = await r.json();
      setResult(d.error ? { error: d.error } : { ok: true });
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="draft-card">
      <div className="draft-top">
        <div className="draft-name">{campaign.name}</div>
        <span className="draft-budget">{campaign.daily_budget}/day</span>
      </div>
      <div className="draft-meta">
        {campaign.objective && <span className="pill">{campaign.objective}</span>}
        {Array.isArray(campaign.products) && campaign.products.map((p, j) => <span key={j} className="pill">{p}</span>)}
      </div>
      {campaign.audience && <div className="draft-row"><b>Audience:</b> {campaign.audience}</div>}
      {campaign.angle && <div className="draft-row"><b>Angle:</b> {campaign.angle}</div>}
      {campaign.headline && <div className="draft-row"><b>Headline:</b> {campaign.headline}</div>}
      {campaign.primary_text && <div className="draft-copy">{campaign.primary_text}</div>}

      {result?.ok ? (
        <div className="push-ok">✓ Created in Meta as PAUSED. Activate it from the Ads management panel below when ready.</div>
      ) : (
        <div className="push-area">
          {!open ? (
            <button className="push-open" onClick={() => setOpen(true)} disabled={!accountExt}>Push to Meta (paused) →</button>
          ) : (
            <div className="push-form">
              <label>Destination URL <span className="req">*</span></label>
              <input type="url" placeholder="https://slavensracing.com/product/..." value={link} onChange={(e) => setLink(e.target.value)} />
              <label>Image URL <span className="opt">(optional)</span></label>
              <input type="url" placeholder="https://…/image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              {result?.error && <div className="push-err">{result.error}</div>}
              <div className="push-actions">
                <button className="push-create" onClick={push} disabled={busy}>{busy ? "Creating…" : "Create paused campaign"}</button>
                <button className="push-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignStudio({ client, initialPlan, accountExt }) {
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
      <p className="note">AI evaluates your top campaigns vs. trending products, lists the content you&apos;ll need, and drafts campaigns to your best audiences. Push a draft to create it in Meta as a PAUSED campaign for your approval.</p>

      {err && <div className="err-box">Error: {err}</div>}
      {!plan && !loading && <div className="muted" style={{ fontSize: 13 }}>No plan yet — click Generate.</div>}

      {plan && (
        <>
          {plan.summary && <div className="studio-summary">{plan.summary}</div>}

          {Array.isArray(plan.materials) && plan.materials.length > 0 && (
            <div className="studio-block">
              <div className="studio-h">Content &amp; materials needed</div>
              <ul className="studio-list">{plan.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}

          {Array.isArray(plan.campaigns) && plan.campaigns.length > 0 && (
            <div className="studio-block">
              <div className="studio-h">Drafted campaigns</div>
              <div className="studio-campaigns">
                {plan.campaigns.map((c, i) => (
                  <DraftCard key={i} accountExt={accountExt} campaign={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
