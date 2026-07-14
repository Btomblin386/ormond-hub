"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToB64, cropToRatio, uploadImage, imageSize, IG_RATIOS, IG_FEED_MIN, IG_FEED_MAX, videoMeta, validateReel } from "../lib/media";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", needs_revisions: "Needs revisions", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const LIMITS = { instagram: 2200, facebook: 63206 };
const CHAN_LABEL = { facebook: "Facebook", instagram: "Instagram" };
const TYPES = ["feed", "reel", "story"];
const CROP_OPTS = [["original", "Original"], ["1:1", "Square 1:1"], ["4:5", "Portrait 4:5"], ["1.91:1", "Landscape 1.91:1"], ["9:16", "Story/Reel 9:16"]];

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
function nowPlus30() {
  const d = new Date(Date.now() + 30 * 60000 - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function Composer({ clientId, social, seedDate, editItem, onDone }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  // Which channels are actually connected for this client
  const accounts = useMemo(() => {
    const a = [];
    if (social?.fb_page_id) a.push({ key: "facebook", label: social.fb_page_name || "Facebook Page", handle: "Facebook" });
    if (social?.ig_user_id) a.push({ key: "instagram", label: social.ig_username ? "@" + social.ig_username : "Instagram", handle: "Instagram" });
    return a;
  }, [social]);
  const [channels, setChannels] = useState(() => {
    if (editItem?.channels?.length) return editItem.channels;
    const all = [];
    if (social?.fb_page_id) all.push("facebook");
    if (social?.ig_user_id) all.push("instagram");
    return all; // default: all connected channels selected
  });
  const [customize, setCustomize] = useState(() => !!(editItem?.variants && Object.keys(editItem.variants).length));
  const [caption, setCaption] = useState(editItem?.caption || "");
  const [variants, setVariants] = useState(() => ({
    facebook: { caption: editItem?.variants?.facebook?.caption || "", post_type: editItem?.variants?.facebook?.post_type || "feed" },
    instagram: { caption: editItem?.variants?.instagram?.caption || "", post_type: editItem?.variants?.instagram?.post_type || "feed" },
  }));
  const [baseType, setBaseType] = useState(editItem?.post_type || "feed");
  const [link, setLink] = useState(editItem?.link || "");
  const [media, setMedia] = useState(editItem?.media_urls || []);
  const [videoUrl, setVideoUrl] = useState("");
  const [firstComment, setFirstComment] = useState(editItem?.first_comment || "");
  const [scheduledAt, setScheduledAt] = useState(seedDate || (editItem?.scheduled_at ? toLocalInput(editItem.scheduled_at) : nowPlus30()));
  const [activeTab, setActiveTab] = useState(channels[0] || "facebook");
  const [cropRatio, setCropRatio] = useState("original");
  const [progress, setProgress] = useState({});
  const [igWarn, setIgWarn] = useState("");
  const [videoWarn, setVideoWarn] = useState("");

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

  // Validate reel video specs (best-effort; cross-origin may block metadata)
  useEffect(() => {
    if (!usesVideo || !videoUrl.trim()) { setVideoWarn(""); return; }
    let cancel = false;
    videoMeta(videoUrl.trim()).then((m) => { if (!cancel) setVideoWarn(validateReel(m) || ""); });
    return () => { cancel = true; };
  }, [usesVideo, videoUrl]);

  async function onFiles(e) {
    const files = [...e.target.files]; if (!files.length) return;
    setUploading(true); setIgWarn("");
    try {
      for (const f of files) {
        let b64 = await fileToB64(f);
        if (cropRatio !== "original") b64 = await cropToRatio(b64, IG_RATIOS[cropRatio]);
        if (channels.includes("instagram") && baseType === "feed") {
          try {
            const s = await imageSize(b64);
            if (s.ratio < IG_FEED_MIN - 0.02 || s.ratio > IG_FEED_MAX + 0.02) setIgWarn("This image's shape is outside Instagram feed limits (portrait 4:5 to landscape 1.91:1). Pick a crop above so it isn't rejected.");
          } catch {}
        }
        setProgress((p) => ({ ...p, [f.name]: 0 }));
        const d = await uploadImage({ image_base64: b64, filename: f.name, onProgress: (pct) => setProgress((p) => ({ ...p, [f.name]: pct })) });
        if (d.url) setMedia((m) => [...m, d.url]);
        setProgress((p) => { const n = { ...p }; delete n[f.name]; return n; });
      }
    } catch (err) { flash("Upload failed: " + (err.message || err)); } finally { setUploading(false); }
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
    const fields = {
      clientId, channels, caption, link: link || null, mediaUrls,
      postType: baseType, variants: payloadVariants, firstComment: firstComment || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    const label = status === "draft" ? "Saved as draft." : status === "needs_approval" ? "Submitted for approval." : "Approved & scheduled.";
    try {
      let d;
      if (editItem) {
        const r1 = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "update", id: editItem.id, ...fields }) });
        d = await r1.json();
        if (!d.error) {
          const r2 = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id: editItem.id, status, approvedBy: "agency" }) });
          d = await r2.json();
        }
      } else {
        const r = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "create", ...fields, status }) });
        d = await r.json();
      }
      if (d.error) flash("Error: " + d.error);
      else { onDone(label); router.refresh(); }
    } finally { setBusy(""); }
  }

  const igActive = channels.includes("instagram");

  return (
    <div className="composer">
      <div className="cmp-row">
        <div className="cmp-field" style={{ flex: 1, minWidth: 260 }}>
          <label>Post to</label>
          <AccountSelect accounts={accounts} channels={channels} onToggle={toggleChannel}
            onAll={() => setChannels(accounts.map((a) => a.key))} onClear={() => setChannels([])} />
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
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Reels publish from a public MP4 URL. Instagram: ≤ 90s, 9:16, 1080px wide. Direct upload coming soon.</div>
          {videoWarn && <div className="cmp-warn">⚠ {videoWarn}</div>}
        </div>
      ) : (
        <div className="cmp-field">
          <div className="cmp-label-row">
            <label>Images {igActive && <span className="muted">· 1 for a Story, up to 10 for a carousel</span>}</label>
            <div className="crop-sel">
              <span className="muted" style={{ fontSize: 11 }}>Crop:</span>
              <select value={cropRatio} onChange={(e) => setCropRatio(e.target.value)}>
                {CROP_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          <input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading} />
          {Object.entries(progress).map(([name, pct]) => (
            <div key={name} className="upl-prog">
              <div className="upl-bar"><div className="upl-fill" style={{ width: pct + "%" }} /></div>
              <span className="upl-pct">{pct}%</span>
            </div>
          ))}
          {igWarn && <div className="cmp-warn">⚠ {igWarn}</div>}
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

function AccountSelect({ accounts, channels, onToggle, onAll, onClear }) {
  const [open, setOpen] = useState(false);
  const selected = accounts.filter((a) => channels.includes(a.key));
  return (
    <div className="acctsel">
      <button type="button" className="acctsel-control" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? <span className="acctsel-ph">Select an account</span> : (
          <span className="acctsel-chips">
            {selected.map((a) => (
              <span key={a.key} className={"acctsel-chip " + a.key}>
                {a.label}
                <span className="acctsel-x" onClick={(e) => { e.stopPropagation(); onToggle(a.key); }}>×</span>
              </span>
            ))}
          </span>
        )}
        <span className="acctsel-caret">▾</span>
      </button>
      {open && (
        <div className="acctsel-menu" onMouseLeave={() => setOpen(false)}>
          <div className="acctsel-actions">
            <button type="button" onClick={onAll}>Select all</button>
            <button type="button" onClick={onClear}>Clear</button>
          </div>
          {accounts.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "6px 10px" }}>No accounts connected yet.</div>}
          {accounts.map((a) => (
            <label key={a.key} className="acctsel-opt">
              <input type="checkbox" checked={channels.includes(a.key)} onChange={() => onToggle(a.key)} />
              <span className={"acctsel-dot " + a.key} />
              <span className="acctsel-lbl">{a.label}</span>
              <span className="acctsel-plat">{a.handle}</span>
            </label>
          ))}
          <div className="acctsel-soon">TikTok — coming soon</div>
        </div>
      )}
    </div>
  );
}

function CharCount({ value, channels }) {
  if (!channels.length) return null;
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
export default function ContentManager({ clientId, client, items, social, open: openProp, setOpen: setOpenProp, seedDate, editId }) {
  const router = useRouter();
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = setOpenProp || setOpenLocal;
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [editItem, setEditItem] = useState(null);
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  function startEdit(it) {
    setEditItem(it);
    setOpen(true);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
  }

  // Open composer in edit mode when arriving with ?edit=<id> (e.g. from the Agency calendar)
  useEffect(() => {
    if (!editId) return;
    const it = items.find((x) => x.id === editId);
    if (it) startEdit(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function itemAction(id, status) {
    setBusy(id + status);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status, approvedBy: "agency" }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function requestRevisions(id) {
    const note = window.prompt("What needs changing? (leave a note for the creator)");
    if (note === null) return;
    setBusy(id + "rev");
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "revisions", id, note }) });
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
        <button className="studio-btn" onClick={() => { setEditItem(null); setOpen((o) => !o); }}>{open ? "Close composer" : "+ New post"}</button>
      </div>
      <p className="note">Compose, schedule, and approve social posts for {client}. Approved posts publish automatically at their scheduled time.</p>

      <SocialConnect clientId={clientId} client={client} social={social} />
      {msg && <div className="mng-msg">{msg}</div>}

      {open && (
        <>
          {editItem && <div className="cmp-editing">Editing an existing {STATUS_LABEL[editItem.status]?.toLowerCase()} post</div>}
          <Composer key={editItem?.id || "new"} clientId={clientId} social={social} seedDate={seedDate} editItem={editItem} onDone={(m) => { flash(m); setOpen(false); setEditItem(null); }} />
        </>
      )}

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
                {it.note && <div className="content-note">📝 {it.note}</div>}
                {it.error && (
                  <div className={"content-err " + (it.error_kind || "permanent")}>
                    <span className="err-flag">{it.error_kind === "transient" ? "⏳ Temporary — retry shortly" : "⚠ Needs a fix"}</span>
                    <span className="err-txt">{it.error}</span>
                  </div>
                )}
              </div>
              <div className="content-actions">
                {it.status !== "published" && it.status !== "publishing" && <button onClick={() => startEdit(it)}>Edit</button>}
                {(it.status === "draft" || it.status === "needs_revisions") && <button disabled={busy === it.id + "needs_approval"} onClick={() => itemAction(it.id, "needs_approval")}>Submit</button>}
                {it.status === "needs_approval" && <button disabled={busy === it.id + "rev"} onClick={() => requestRevisions(it.id)}>Request revisions</button>}
                {(it.status === "draft" || it.status === "needs_approval" || it.status === "needs_revisions") && <button className="cal-approve" disabled={busy === it.id + "approved"} onClick={() => itemAction(it.id, "approved")}>Approve</button>}
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
