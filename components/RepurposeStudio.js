"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function fileToB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
function loadImg(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = url; });
}

export default function RepurposeStudio({ clientId, client, brand, seed, seedImage }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [settings, setSettings] = useState({
    background_url: brand?.background_url || "", logo_url: brand?.logo_url || "",
    brand_color: brand?.brand_color || "#111827", brand_voice: brand?.brand_voice || "",
    business_desc: brand?.business_desc || "",
  });
  const [ugc, setUgc] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [lastDraftId, setLastDraftId] = useState(null);
  const [kitOpen, setKitOpen] = useState(false);
  const [text, setText] = useState(seed || "");
  const [variants, setVariants] = useState([]);
  const [caption, setCaption] = useState("");

  useEffect(() => { if (seed) { setText(seed); } }, [seed]);
  useEffect(() => {
    if (!seedImage) return;
    // Copy the mention's image into our bucket (Meta URLs expire + block canvas export)
    (async () => {
      setBusy("ugc");
      try {
        const r = await fetch("/api/content-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: seedImage, filename: "ugc" }) });
        const d = await r.json();
        setUgc(d.url || seedImage);
      } catch { setUgc(seedImage); } finally { setBusy(""); }
    })();
  }, [seedImage]);
  useEffect(() => { draw(); /* eslint-disable-next-line */ }, [ugc, settings.background_url, settings.logo_url, settings.brand_color]);
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  async function upload(dataUrl, name) {
    const r = await fetch("/api/content-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: dataUrl, filename: name }) });
    const d = await r.json();
    if (!d.url) throw new Error(d.error || "upload failed");
    return d.url;
  }
  async function onUpload(e, kind) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(kind);
    try {
      const b64 = await fileToB64(f);
      const url = await upload(b64, f.name);
      if (kind === "ugc") setUgc(url);
      else set(kind === "bg" ? "background_url" : "logo_url", url);
    } catch (err) { flash("Upload failed: " + err); } finally { setBusy(""); }
  }

  async function draw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); const S = 1080; c.width = S; c.height = S;
    ctx.fillStyle = settings.brand_color || "#111827"; ctx.fillRect(0, 0, S, S);
    try {
      if (settings.background_url) {
        const bg = await loadImg(settings.background_url);
        const scale = Math.max(S / bg.width, S / bg.height);
        const w = bg.width * scale, h = bg.height * scale;
        ctx.drawImage(bg, (S - w) / 2, (S - h) / 2, w, h);
      }
      if (ugc) {
        const im = await loadImg(ugc);
        const pad = 120, box = S - pad * 2;
        const scale = Math.min(box / im.width, box / im.height);
        const w = im.width * scale, h = im.height * scale;
        const x = (S - w) / 2, y = (S - h) / 2;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
        ctx.fillStyle = "#fff"; ctx.fillRect(x - 14, y - 14, w + 28, h + 28);
        ctx.restore();
        ctx.drawImage(im, x, y, w, h);
      }
      if (settings.logo_url) {
        const lg = await loadImg(settings.logo_url);
        const lw = 150, lh = lg.height * (lw / lg.width);
        ctx.drawImage(lg, S - lw - 40, S - lh - 40, lw, lh);
      }
    } catch { /* tainted or missing image; preview may be partial */ }
  }

  async function saveKit() {
    setBusy("kit");
    try {
      await fetch("/api/brand-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, settings }) });
      flash("Brand kit saved."); router.refresh();
    } finally { setBusy(""); }
  }

  async function generate() {
    setBusy("gen"); setVariants([]);
    try {
      const r = await fetch("/api/repurpose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client, source_text: text, brand_voice: settings.brand_voice }) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else if (!d.variants?.length) flash("The caption model came back empty — try Generate again.");
      else { setVariants(d.variants); setCaption(d.variants[0].caption); }
    } finally { setBusy(""); }
  }

  async function createDraft(applyKit) {
    if (!ugc) { flash("Add a UGC image first."); return; }
    if (!caption.trim()) { flash("Pick or write a caption."); return; }
    setBusy(applyKit ? "draft" : "asis");
    try {
      let media = ugc;
      if (applyKit) {
        try {
          const c = canvasRef.current;
          media = await upload(c.toDataURL("image/png"), "repurposed.png");
        } catch { flash("Couldn't composite (image blocked cross-origin) — saved the raw image instead."); }
      }
      const r = await fetch("/api/content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", clientId, caption, channels: ["instagram", "facebook"], mediaUrls: [media], status: "draft" }),
      });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { setLastDraftId(d.id || null); flash("Draft created."); router.refresh(); }
    } finally { setBusy(""); }
  }

  return (
    <div id="repurpose" className="panel">
      <h2>Repurpose Studio</h2>
      <p className="note">Turn UGC into an on-brand post: drop the customer photo onto {client}&apos;s branded background, generate a caption in your voice, and save it as a draft. Set the brand kit once and every repurpose stays on-brand.</p>

      {msg && <div className="mng-msg">{msg}</div>}

      <button className="rep-kit-toggle" onClick={() => setKitOpen((o) => !o)}>{kitOpen ? "▾ Brand kit" : "▸ Brand kit"} — background, logo, color, voice</button>
      {kitOpen && (
        <div className="rule-form">
          <div className="rule-grid">
            <div>
              <label>Background image</label>
              <input type="file" accept="image/*" onChange={(e) => onUpload(e, "bg")} disabled={busy === "bg"} />
            </div>
            <div>
              <label>Logo (PNG)</label>
              <input type="file" accept="image/*" onChange={(e) => onUpload(e, "logo")} disabled={busy === "logo"} />
            </div>
            <div>
              <label>Brand color</label>
              <input type="color" value={settings.brand_color} onChange={(e) => set("brand_color", e.target.value)} />
            </div>
          </div>
          <label>What this business sells (guides ALL AI — chat, campaign plans, insights)</label>
          <textarea rows={2} value={settings.business_desc} onChange={(e) => set("business_desc", e.target.value)} placeholder="e.g. an adventure-motorcycle luggage and soft-bag maker for long-distance riders" />
          <label>Brand voice (guides captions)</label>
          <textarea rows={2} value={settings.brand_voice} onChange={(e) => set("brand_voice", e.target.value)} placeholder="e.g. Rugged, rider-to-rider, no hype. Speaks to serious dirt-bike racers." />
          <button className="push-create" style={{ marginTop: 8 }} onClick={saveKit} disabled={busy === "kit"}>{busy === "kit" ? "Saving…" : "Save brand kit"}</button>
        </div>
      )}

      <div className="rep-grid">
        <div className="rep-left">
          <label className="rep-label">UGC image</label>
          <input type="file" accept="image/*" onChange={(e) => onUpload(e, "ugc")} disabled={busy === "ugc"} />

          <label className="rep-label">Source / context</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the customer's post, review, or a note about the photo…" />
          <button className="social-btn" onClick={generate} disabled={busy === "gen"}>{busy === "gen" ? "Writing…" : "Generate captions"}</button>

          {variants.length > 0 && (
            <div className="rep-variants">
              {variants.map((v, i) => (
                <button key={i} className={"rep-variant" + (caption === v.caption ? " sel" : "")} onClick={() => setCaption(v.caption)}>
                  <span className="rep-plat">{v.platform}</span>{v.caption}
                </button>
              ))}
            </div>
          )}

          <label className="rep-label">Caption</label>
          <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Final caption…" />
          <div className="rep-create">
            <button className="push-create" onClick={() => createDraft(true)} disabled={!!busy}>{busy === "draft" ? "Saving…" : "Create branded draft"}</button>
            <button className="cmp-btn ghost" onClick={() => createDraft(false)} disabled={!!busy}>{busy === "asis" ? "Saving…" : "Post image as-is"}</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Branded = UGC on your brand background. As-is = the original image, untouched.</div>
          {lastDraftId && (
            <a className="rowlink" style={{ display: "inline-block", marginTop: 8, fontWeight: 700 }} href={`/accounts/${clientId}/content?edit=${lastDraftId}`}>
              Open the new draft in the composer →
            </a>
          )}
        </div>
        <div className="rep-right">
          <canvas ref={canvasRef} className="rep-canvas" />
          <div className="muted" style={{ fontSize: 11 }}>Live preview at 1080×1080. Saved as the post image.</div>
        </div>
      </div>
    </div>
  );
}
