"use client";
import { useState } from "react";

function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function DraftCard({ accountExt, campaign, existingCampaigns }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [audiences, setAudiences] = useState(null);
  const [uploadedHashes, setUploadedHashes] = useState([]);
  const [uploading, setUploading] = useState(false);

  const initBudget = Number(String(campaign.daily_budget || "").replace(/[^0-9.]/g, "")) || 20;
  const [form, setForm] = useState({
    campaignId: "", audienceId: "", link: "", budget: initBudget,
    headline: campaign.headline || "", primaryText: campaign.primary_text || "", images: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function openForm() {
    setOpen(true);
    if (audiences === null) {
      try {
        const r = await fetch("/api/audiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_ext: accountExt }) });
        const d = await r.json();
        setAudiences(Array.isArray(d.audiences) ? d.audiences : []);
      } catch { setAudiences([]); }
    }
  }

  async function onFiles(e) {
    const files = [...e.target.files];
    if (!files.length) return;
    setUploading(true); setResult(null);
    try {
      for (const f of files) {
        const b64 = await fileToB64(f);
        const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_ext: accountExt, image_base64: b64 }) });
        const d = await r.json();
        if (d.hash) setUploadedHashes((h) => [...h, d.hash]);
        else setResult({ error: d.error || "upload failed" });
      }
    } finally { setUploading(false); }
  }

  async function create() {
    if (!form.link) { setResult({ error: "Add a destination URL first." }); return; }
    const urlList = form.images.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const imageCount = uploadedHashes.length || urlList.length;
    const aud = audiences?.find((a) => a.id === form.audienceId);
    const where = form.campaignId ? `existing campaign "${existingCampaigns.find((c) => c.campaign_id === form.campaignId)?.campaign || ""}"` : "a NEW campaign";
    if (!window.confirm(`Create this ad PAUSED in ${where}, at $${form.budget}/day, ${imageCount >= 2 ? `carousel (${imageCount} images)` : "single image"}, targeting ${aud ? aud.name : "broad US 18+"}? It won't run until you activate it.`)) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch("/api/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_ext: accountExt,
          campaign_id: form.campaignId || undefined,
          audience_id: form.audienceId || undefined,
          name: campaign.name, objective: campaign.objective,
          daily_budget: Number(form.budget) || initBudget,
          link: form.link,
          image_hashes: uploadedHashes.length ? uploadedHashes : undefined,
          image_urls: uploadedHashes.length ? undefined : urlList,
          primary_text: form.primaryText, headline: form.headline,
        }),
      });
      const d = await r.json();
      setResult(d.error ? { error: d.error } : { ok: true });
    } catch (e) { setResult({ error: String(e) }); } finally { setBusy(false); }
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
      {campaign.primary_text && <div className="draft-copy">{campaign.primary_text}</div>}

      {result?.ok ? (
        <div className="push-ok">✓ Created in Meta as PAUSED. Activate it from the Ads management panel below when ready.</div>
      ) : (
        <div className="push-area">
          {!open ? (
            <button className="push-open" onClick={openForm} disabled={!accountExt}>Review &amp; push to Meta →</button>
          ) : (
            <div className="push-form">
              <label>Campaign</label>
              <select value={form.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
                <option value="">➕ Create new campaign</option>
                {existingCampaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>Add to: {c.campaign}</option>)}
              </select>

              <label>Audience</label>
              <select value={form.audienceId} onChange={(e) => set("audienceId", e.target.value)}>
                <option value="">Broad — US, 18+</option>
                {(audiences || []).map((a) => <option key={a.id} value={a.id}>{a.name}{a.size > 0 ? ` (~${a.size.toLocaleString()})` : ""}</option>)}
              </select>

              <label>Destination URL <span className="req">*</span></label>
              <input type="url" placeholder="https://slavensracing.com/product/..." value={form.link} onChange={(e) => set("link", e.target.value)} />

              <label>Daily budget ($)</label>
              <input type="number" min="1" value={form.budget} onChange={(e) => set("budget", e.target.value)} />

              <label>Headline</label>
              <input type="text" value={form.headline} onChange={(e) => set("headline", e.target.value)} />

              <label>Primary text</label>
              <textarea rows={3} value={form.primaryText} onChange={(e) => set("primaryText", e.target.value)} />

              <label>Images</label>
              <input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading} />
              {uploading && <div className="muted" style={{ fontSize: 11 }}>Uploading…</div>}
              {uploadedHashes.length > 0 && <div className="upload-ok">{uploadedHashes.length} image{uploadedHashes.length > 1 ? "s" : ""} uploaded{uploadedHashes.length >= 2 ? " · will build a carousel" : ""}</div>}
              <div className="muted" style={{ fontSize: 11, margin: "2px 0" }}>…or paste image URL(s), one per line:</div>
              <textarea rows={2} placeholder={"https://…/image.jpg"} value={form.images} onChange={(e) => set("images", e.target.value)} />

              {result?.error && <div className="push-err">{result.error}</div>}
              <div className="push-actions">
                <button className="push-create" onClick={create} disabled={busy || uploading}>{busy ? "Creating…" : "Create paused ad"}</button>
                <button className="push-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignStudio({ client, initialPlan, accountExt, existingCampaigns = [] }) {
  const [plan, setPlan] = useState(initialPlan || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setLoading(true); setErr("");
    try {
      const resp = await fetch("/api/campaign-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client }) });
      const data = await resp.json();
      if (data.error) setErr(data.error); else if (data.plan) setPlan(data.plan);
    } catch (e) { setErr(String(e)); } finally { setLoading(false); }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Campaign Studio</h2>
        <button className="studio-btn" onClick={generate} disabled={loading}>
          {loading ? "Building plan…" : plan ? "Regenerate plan" : "Generate campaign plan"}
        </button>
      </div>
      <p className="note">AI drafts campaigns to your best audiences. Review and edit any draft — pick a target audience, upload images (or paste URLs), tweak the copy — then push it to Meta as a PAUSED campaign for approval.</p>

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
                {plan.campaigns.map((c, i) => <DraftCard key={i} accountExt={accountExt} campaign={c} existingCampaigns={existingCampaigns} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
