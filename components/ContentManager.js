"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const LIMITS = { instagram: 2200, facebook: 63206 };
const CHAN_LABEL = { facebook: "Facebook", instagram: "Instagram" };
const TYPES = ["feed", "reel", "story"];

function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------------- Social connection ---------------- */
function SocialConnect({ clientId, client, social }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState(null);
  const [msg, setMsg] = useState("");

  async function discover() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover" }) });
      const d = await r.json();
      if (d.error) setMsg("Error: " + d.error); else setPages(d.pages || []);
    } finally { setBusy(false); }
  }
  async function connect(page_id) {
    setBusy(true);
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", client_id: clientId, page_id }) });
      const d = await r.json();
      if (d.error) setMsg("Error: " + d.error); else { router.refresh(); setPages(null); }
    } finally { setBusy(false); }
  }
  const picker = pages && (
    !pages.length ? <div className="muted" style={{ fontSize: 12 }}>No Pages available on the token. Make sure the Page is shared to your business.</div> : (
      <div className="page-picker">
        {pages.map((p) => <button key={p.id} className="page-opt" disabled={busy} onClick={() => connect(p.id)}>{p.name}{p.ig_username ? ` · @${p.ig_username}` : ""}</button>)}
      </div>
    )
  );

  if (social?.fb_page_id) {
    return (
      <div className="social-status connected">
        <span className="social-ok">✓ Connected</span>
        <span>{social.fb_page_name}</span>
        {social.ig_username ? <span className="social-ig">@{social.ig_username}</span> : <span className="muted" style={{ fontSize: 11 }}>· no IG linked</span>}
        <button className="social-btn" onClick={discover} disabled={busy}>Change</button>
        {picker}{msg && <div className="push-err">{msg}</div>}
      </div>
    );
  }
  return (
    <div className="social-status">
      <span className="muted" style={{ fontSize: 12.5 }}>No Facebook Page connected for {client}. Publishing needs one.</span>
      <button className="social-btn" onClick={discover} disabled={busy}>{busy ? "Loading…" : "Connect a Page"}</button>
      {picker}{msg && <div className="push-err">{msg}</div>}
    </div>
  );
}

/* ---------------- Composer ---------------- */
function Composer({ clientId, social, onDone }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [channels, setChannels] = useState(["facebook"]);
  const [customize, setCustomize] = useState(false);
  const [caption, setCaption] = useState("");
  const [variants, setVariants] = useState({ facebook: { caption: "", post_type: "feed" }, instagram: { caption: "", post_type: "feed" } });
  const [baseType, setBaseType] = useState("feed");
  const [link, setLink] = useState("");
  const [media, setMedia] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activeTab, setActiveTab] = useState("facebook");

  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 7000); }
  function toggleChannel(c) {
    setChannels((cs) => cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]);
    if (!channels.includes(c)) setActiveTab(c);
  }
  const setVar = (ch, k, v) => setVariants((s) => ({ ...s, [ch]: { ...s[ch], [k]: v } }));

  // effective {caption, type} per selected channel
  const plan = useMemo(() => channels.map((ch) => ({
    ch,
    caption: customize ? (variants[ch]?.caption || "") : caption,
    type: customize ? (variants[ch]?.post_type || "feed") : baseType,
  })), [channels, customize, variants, caption, baseType]);

  const usesVideo = plan.some((p) => p.type === "reel");
  const usesImage = plan.some((p) => p.type === "feed" || p.type === "story");

  async function onFiles(e) {
    const files = [...e.target.files]; if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const b64 = await fileToB64(f);
        const r = await fetch("/api/content-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: b64, filename: f.name }) });
        const d = await r.json();
        if (d.url) setMedia((m) => [...m, d.url]); else flash("Upload failed: " + (d.error || "unknown"));
      }
    } finally { setUploading(false); }
  }

  function validate() {
    if (!channels.length) return "Pick at least one channel.";
    if (usesVideo && usesImage) return "Mixing Reel (video) with Feed/Story (image) in one post isn't supported — make separate posts.";
    for (const p of plan) {
      if (p.caption.length > LIMITS[p.ch]) return `${CHAN_LABEL[p.ch]} caption is over the ${LIMITS[p.ch].toLocaleString()}-character limit.`;
      if (p.ch === "instagram") {
        if (p.type === "reel" && !videoUrl.trim()) return "Instagram Reels need a video URL.";
        if (p.type !== "reel" && media.length === 0) return "Instagram posts need at least one image.";
        if (p.type === "story" && media.length > 1) return "A Story is a single image — remove the extras.";
        if (media.length > 10) return "Instagram allows up to 10 images per post.";
      }
      if (p.ch === "facebook") {
        if (p.type === "story" && media.length === 0) return "A Facebook Story needs an image.";
        if (p.type === "reel" && !videoUrl.trim()) return "Facebook Reels need a video URL.";
      }
    }
    return null;
  }

  async function save(status) {
    const err = validate(); if (err) { flash(err); return; }
    setBusy(status);
    const mediaUrls = usesVideo ? [videoUrl.trim()] : media;
    const payloadVariants = customize
      ? Object.fromEntries(channels.map((ch) => [ch, { caption: variants[ch]?.caption || "", post_type: variants[ch]?.post_type || "feed" }]))
      : {};
    try {
      const r = await fetch("/api/content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create", clientId, channels, caption, link: link || null, mediaUrls,
          postType: baseType, variants: payloadVariants, firstComment: firstComment || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, status,
        }),
      });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { onDone(status === "draft" ? "Saved as draft." : status === "needs_approval" ? "Submitted for approval." : "Approved & scheduled."); router.refresh(); }
    } finally { setBusy(""); }
  }

  const igActive = channels.includes("instagram");

  return (
    <div className="composer">
      <div className="cmp-row">
        <div className="cmp-field">
          <label>Channels</label>
          <div className="chan-pills">
            {["facebook", "instagram"].map((c) => (
              <button key={c} type="button" className={"chan-pill" + (channels.includes(c) ? " on " + c : "")} onClick={() => toggleChannel(c)}>{CHAN_LABEL[c]}</button>
            ))}
          </div>
        </div>
        {channels.length > 1 && (
          <label className="cmp-toggle">
            <input type="checkbox" checked={customize} onChange={(e) => setCustomize(e.target.checked)} /> Customize per channel
          </label>
        )}
      </div>

      {!customize ? (
        <>
          <div className="cmp-field">
            <div className="cmp-label-row">
              <label>Caption</label>
              <CharCount value={caption} channels={channels} />
            </div>
            <textarea rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write the post…" />
          </div>
          <div className="cmp-field">
            <label>Post type</label>
            <TypePicker value={baseType} onChange={setBaseType} igOnly={false} />
          </div>
        </>
      ) : (
        <div className="cmp-field">
          <div className="cmp-tabs">
            {channels.map((ch) => <button key={ch} type="button" className={"cmp-tab" + (activeTab === ch ? " active" : "")} onClick={() => setActiveTab(ch)}>{CHAN_LABEL[ch]}</button>)}
          </div>
          {channels.filter((ch) => ch === activeTab).map((ch) => (
            <div key={ch}>
              <div className="cmp-label-row">
                <label>{CHAN_LABEL[ch]} caption</label>
                <span className={"charcount" + ((variants[ch]?.caption || "").length > LIMITS[ch] ? " over" : "")}>{(variants[ch]?.caption || "").length}/{LIMITS[ch].toLocaleString()}</span>
              </div>
              <textarea rows={5} value={variants[ch]?.caption || ""} onChange={(e) => setVar(ch, "caption", e.target.value)} placeholder={ch === "instagram" ? "IG caption — @mentions, #hashtags…" : "Facebook caption…"} />
              <div style={{ marginTop: 8 }}><label>Post type</label><TypePicker value={variants[ch]?.post_type || "feed"} onChange={(v) => setVar(ch, "post_type", v)} igOnly={ch === "instagram"} /></div>
            </div>
          ))}
        </div>
      )}

      {usesVideo ? (
        <div className="cmp-field">
          <label>Video URL (Reel)</label>
          <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…/video.mp4 (public MP4)" />
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Reels publish from a public MP4 URL. Direct video upload is coming soon.</div>
        </div>
      ) : (
        <div className="cmp-field">
          <label>Images {igActive && <span className="muted">· 1 for a Story, up to 10 for a carousel</span>}</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading} />
          {uploading && <div className="muted" style={{ fontSize: 11 }}>Uploading…</div>}
          {media.length > 0 && (
            <div className="cmp-thumbs">
              {media.map((u, j) => (
                <div key={j} className="cmp-thumb"><img src={u} alt="" /><button type="button" onClick={() => setMedia((m) => m.filter((_, i) => i !== j))}>×</button></div>
              ))}
            </div>
          )}
        </div>
      )}

      {channels.includes("facebook") && (
        <div className="cmp-field">
          <label>Link <span className="muted">(Facebook feed only)</span></label>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        </div>
      )}

      <div className="cmp-field">
        <label>First comment <span className="muted">(optional — posted right after)</span></label>
        <textarea rows={2} value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="Drop links or extra hashtags here…" />
      </div>

      <div className="cmp-field">
        <label>Schedule for</label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Leave blank to publish as soon as it&apos;s approved.</div>
      </div>

      {msg && <div className="push-err">{msg}</div>}
      <div className="cmp-actions">
        <button className="cmp-btn ghost" onClick={() => save("draft")} disabled={!!busy}>Save draft</button>
        <button className="cmp-btn outline" onClick={() => save("needs_approval")} disabled={!!busy}>Submit for approval</button>
        <button className="cmp-btn solid" onClick={() => save("approved")} disabled={!!busy}>{busy === "approved" ? "Scheduling…" : "Approve & schedule"}</button>
      </div>
    </div>
  );
}

function CharCount({ value, channels }) {
  const limit = Math.min(...channels.map((c) => LIMITS[c]));
  return <span className={"charcount" + (value.length > limit ? " over" : "")}>{value.length}/{limit.toLocaleString()}</span>;
}
function TypePicker({ value, onChange }) {
  return (
    <div className="type-picker">
      {TYPES.map((t) => (
        <button key={t} type="button" className={"type-opt" + (value === t ? " active" : "")} onClick={() => onChange(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
      ))}
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function ContentManager({ clientId, client, items, social }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  async function itemAction(id, status) {
    setBusy(id + status);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status, approvedBy: "agency" }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function del(id) {
    if (!window.confirm("Delete this content item?")) return;
    setBusy(id + "del");
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete", id }) });
      router.refresh();
    } finally { setBusy(""); }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Content</h2>
        <button className="studio-btn" onClick={() => setOpen((o) => !o)}>{open ? "Close composer" : "+ New post"}</button>
      </div>
      <p className="note">Compose, schedule, and approve social posts for {client}. Approved posts publish automatically at their scheduled time.</p>

      <SocialConnect clientId={clientId} client={client} social={social} />
      {msg && <div className="mng-msg">{msg}</div>}

      {open && <Composer clientId={clientId} social={social} onDone={(m) => { flash(m); setOpen(false); }} />}

      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>No content yet.</div>
      ) : (
        <div className="content-list">
          {items.map((it) => (
            <div key={it.id} className="content-row">
              {Array.isArray(it.media_urls) && it.media_urls[0] && <img className="content-thumb" src={it.media_urls[0]} alt="" />}
              <div className="content-main">
                <div className="content-top">
                  <span className={"cbadge " + it.status}>{STATUS_LABEL[it.status]}</span>
                  <span className="content-chan">{(it.channels || []).join(" + ")}</span>
                  {it.post_type && it.post_type !== "feed" && <span className="content-type">{it.post_type}</span>}
                  <span className="content-when">{it.scheduled_at ? new Date(it.scheduled_at).toLocaleString() : it.published_at ? "Published " + new Date(it.published_at).toLocaleDateString() : "no date"}</span>
                </div>
                <div className="content-cap">{it.caption?.slice(0, 140) || "(no caption)"}</div>
                {it.error && <div className="push-err">{it.error}</div>}
              </div>
              <div className="content-actions">
                {it.status === "needs_approval" && <button className="cal-approve" disabled={busy === it.id + "approved"} onClick={() => itemAction(it.id, "approved")}>Approve</button>}
                {["approved", "scheduled"].includes(it.status) && <button disabled={busy === it.id + "draft"} onClick={() => itemAction(it.id, "draft")}>Unschedule</button>}
                {it.status === "failed" && <button disabled={busy === it.id + "approved"} onClick={() => itemAction(it.id, "approved")}>Retry</button>}
                {it.status !== "published" && <button className="rule-del" disabled={busy === it.id + "del"} onClick={() => del(it.id)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
