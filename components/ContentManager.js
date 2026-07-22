"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fileToB64, uploadImage, uploadVideoSigned, imageSize, IG_FEED_MIN, IG_FEED_MAX, videoMeta, validateReel } from "../lib/media";
import DropboxPicker from "./DropboxPicker";
import ImageEditor from "./ImageEditor";

/* --------- Text formatting (Instagram/Facebook show no markdown, so bold and
   italic are done with Unicode math alphabet characters that survive posting). */
function makeMap(fromA, fromZ, toAStart, alsoDigits) {
  const m = {};
  for (let c = fromA.charCodeAt(0); c <= fromZ.charCodeAt(0); c++) m[String.fromCharCode(c)] = String.fromCodePoint(toAStart + (c - fromA.charCodeAt(0)));
  return m;
}
const BOLD = { ...makeMap("A", "Z", 0x1d5d4), ...makeMap("a", "z", 0x1d5ee), ...makeMap("0", "9", 0x1d7ec) };
const ITALIC = { ...makeMap("A", "Z", 0x1d608), ...makeMap("a", "z", 0x1d622) };
// Reverse map: any styled char -> plain ASCII, so "clear" works and re-styling
// bold→italic doesn't stack.
const TO_PLAIN = {};
for (const [plain, styled] of [...Object.entries(BOLD), ...Object.entries(ITALIC)]) TO_PLAIN[styled] = plain;
const stripStyle = (s) => [...s].map((ch) => TO_PLAIN[ch] || ch).join("");
const applyStyle = (s, map) => [...stripStyle(s)].map((ch) => map[ch] || ch).join("");

function FormatBar({ textareaRef, value, onChange }) {
  function transform(kind) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0, end = el.selectionEnd ?? 0;
    if (start === end) return; // needs a selection
    const sel = value.slice(start, end);
    const out = kind === "bold" ? applyStyle(sel, BOLD) : kind === "italic" ? applyStyle(sel, ITALIC) : stripStyle(sel);
    const next = value.slice(0, start) + out + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start, start + [...out].length); });
  }
  return (
    <div className="fmt-bar">
      <button type="button" title="Bold (select text first)" onClick={() => transform("bold")}><b>B</b></button>
      <button type="button" title="Italic (select text first)" onClick={() => transform("italic")}><i>I</i></button>
      <button type="button" title="Clear formatting" onClick={() => transform("clear")}>T×</button>
      <span className="fmt-hint">select text, then style — works in the live post</span>
    </div>
  );
}

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", needs_revisions: "Needs revisions", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const LIMITS = { instagram: 2200, facebook: 63206, tiktok: 2200 };
const CHAN_LABEL = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };
const TYPES = ["feed", "reel", "story"];
function isVideoUrl(u) {
  if (!u) return false;
  try { return /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(new URL(u).pathname); }
  catch { return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(u); }
}

// Styled file picker: the native <input type=file> button can't be restyled, so
// we hide it behind a label that matches the app's other buttons. Resets its
// value after each pick so choosing the same file again still fires onChange.
function FileButton({ accept, multiple, onChange, disabled, children }) {
  return (
    <label className={"file-btn" + (disabled ? " disabled" : "")}>
      {children}
      <input type="file" accept={accept} multiple={multiple} disabled={disabled}
        onChange={(e) => { onChange(e); e.target.value = ""; }} style={{ display: "none" }} />
    </label>
  );
}

/* ---------------- Social connection ---------------- */
function SocialConnect({ clientId, client, socials }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState(null);
  const [msg, setMsg] = useState("");

  async function discover() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover" }) });
      const d = await r.json();
      if (d.error) { setMsg("Error: " + d.error); return; }
      const list = d.pages || [];
      // discover auto-connects any Page whose id matches this brand's ad account —
      // surface that instead of leaving the picker open on the brand's own Page.
      const mine = list.find((p) => p.mapped_client === clientId);
      if (mine) {
        setMsg(`✓ Connected ${mine.name}${mine.ig_username ? " · @" + mine.ig_username : ""}.`);
        setPages(null);
        router.refresh();
      } else {
        setPages(list);
      }
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
  const sortedPages = pages ? [...pages].sort((a, b) => (b.mapped_client === clientId) - (a.mapped_client === clientId)) : [];
  const pageHelp = (
    <details className="page-help">
      <summary>Don&apos;t see {client}&apos;s Page?</summary>
      <div className="page-help-body">
        The Page has to be shared with the app&apos;s Meta <b>system user</b> in Business Settings:
        <ol>
          <li>Open <b>business.facebook.com → Business Settings</b>.</li>
          <li><b>Accounts → Pages</b>: make sure {client}&apos;s Page is added to your Business.</li>
          <li><b>Users → System Users</b>: pick the app&apos;s system user → <b>Add Assets → Pages</b> → select the Page → turn on <b>Manage Page</b>.</li>
          <li>Confirm the Instagram account is linked to that Page (needed for IG publishing).</li>
          <li>Come back and click <b>Connect a Page</b> again.</li>
        </ol>
      </div>
    </details>
  );
  const picker = pages && (
    <div className="page-picker">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 11 }}>Pick a Page to connect to {client}</span>
        <button className="cal-x" style={{ fontSize: 16 }} onClick={() => setPages(null)} title="Close">×</button>
      </div>
      {!pages.length
        ? <div className="muted" style={{ fontSize: 12 }}>No Pages available on the token — the Page must be shared with the app&apos;s Meta system user (see below).</div>
        : sortedPages.map((p) => {
            const isMine = p.mapped_client === clientId;
            const other = p.mapped_client && p.mapped_client !== clientId;
            return (
              <button key={p.id} className={"page-opt" + (isMine ? " match" : "")} disabled={busy} onClick={() => connect(p.id)}>
                <span>{p.name}{p.ig_username ? ` · @${p.ig_username}` : ""}</span>
                {isMine && <span className="page-tag">matches this brand</span>}
                {other && <span className="page-tag other">another brand</span>}
              </button>
            );
          })}
      {pageHelp}
    </div>
  );

  if (socials.length > 0) {
    return (
      <div className="social-status connected">
        <span className="social-ok">✓ Connected</span>
        {socials.map((s) => (
          <span key={s.id} className="ident-chip">
            {s.fb_page_name}
            {s.ig_username ? <span className="social-ig"> @{s.ig_username}</span> : null}
          </span>
        ))}
        <Link className="social-btn" href={`/accounts/${clientId}/settings`} style={{ textDecoration: "none" }}>Manage connections</Link>
        {msg && <div className="push-err">{msg}</div>}
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

// Selection keys are "<socialId>:<channel>" so one composer can target several
// connected identities (e.g. two Pages under one client). On save, keys are
// grouped by identity into one content item per identity.
function buildOptions(socials, tiktok) {
  const out = [];
  for (const s of socials) {
    if (s.fb_page_id) out.push({ key: `${s.id}:facebook`, socialId: s.id, ch: "facebook", label: s.fb_page_name || "Facebook Page", handle: "Facebook" });
    if (s.ig_user_id) out.push({ key: `${s.id}:instagram`, socialId: s.id, ch: "instagram", label: s.ig_username ? "@" + s.ig_username : "Instagram", handle: "Instagram" });
  }
  // TikTok is one identity per brand (separate table), video-only, drafts-upload.
  if (tiktok) out.push({ key: "tiktok:tiktok", socialId: "tiktok", ch: "tiktok", label: tiktok.username ? "@" + tiktok.username : (tiktok.display_name || "TikTok"), handle: "TikTok" });
  return out;
}

function Composer({ clientId, socials, tiktok, seedDate, editItem, onDone, onCancel, dropbox, dropboxFolder, brandLogo }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dbxOpen, setDbxOpen] = useState(false);
  const [dbxFolder, setDbxFolder] = useState(dropboxFolder || "");
  const [dragOver, setDragOver] = useState(false);
  const [vDragOver, setVDragOver] = useState(false);
  const [vUploading, setVUploading] = useState(false);
  const [vProgress, setVProgress] = useState(null);
  const options = useMemo(() => buildOptions(socials, tiktok), [socials, tiktok]);

  const [selKeys, setSelKeys] = useState(() => {
    if (editItem) {
      const sid = editItem.social_account_id || socials[0]?.id;
      return (editItem.channels || []).map((ch) => (ch === "tiktok" ? "tiktok:tiktok" : `${sid}:${ch}`)).filter((k) => options.some((o) => o.key === k));
    }
    // default: every channel of the primary identity
    const primary = socials[0]?.id;
    return options.filter((o) => o.socialId === primary).map((o) => o.key);
  });
  const selChans = useMemo(() => [...new Set(selKeys.map((k) => k.split(":")[1]))], [selKeys]);

  // Guard against legacy rows where variants was stored as a jsonb string/array
  const editVariants = editItem?.variants && typeof editItem.variants === "object" && !Array.isArray(editItem.variants) ? editItem.variants : {};
  const [customize, setCustomize] = useState(() => Object.keys(editVariants).length > 0);
  const [caption, setCaption] = useState(editItem?.caption || "");
  const [variants, setVariants] = useState(() => ({
    facebook: { caption: editVariants.facebook?.caption || "", post_type: editVariants.facebook?.post_type || "feed" },
    instagram: { caption: editVariants.instagram?.caption || "", post_type: editVariants.instagram?.post_type || "feed" },
  }));
  const [baseType, setBaseType] = useState(editItem?.post_type || "feed");
  const [link, setLink] = useState(editItem?.link || "");
  // A video post stores its video in media_urls[0]; split it back out for editing.
  const editVideo = editItem && isVideoUrl(editItem.media_urls?.[0]) ? editItem.media_urls[0] : "";
  const [media, setMedia] = useState(editVideo ? [] : (editItem?.media_urls || []));
  const [videoUrl, setVideoUrl] = useState(editVideo);
  const [coverUrl, setCoverUrl] = useState(editItem?.cover_url || "");
  const [cUploading, setCUploading] = useState(false);
  // Feed post carrying a video (FB feed video / IG reel) rather than images.
  const [feedVideo, setFeedVideo] = useState(!!editVideo && (editItem?.post_type || "feed") === "feed");
  const [firstComment, setFirstComment] = useState(editItem?.first_comment || "");
  const [scheduledAt, setScheduledAt] = useState(seedDate || (editItem?.scheduled_at ? toLocalInput(editItem.scheduled_at) : nowPlus30()));
  const [activeTab, setActiveTab] = useState(selChans[0] || "facebook");
  const [editorIdx, setEditorIdx] = useState(null);
  const [progress, setProgress] = useState({});
  const [igWarn, setIgWarn] = useState("");
  const [videoWarn, setVideoWarn] = useState("");
  const sharedRef = useRef(null);
  const tabRef = useRef(null);
  const [restored, setRestored] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showFirst, setShowFirst] = useState(false);
  const [previewCh, setPreviewCh] = useState("instagram");
  const hydratedRef = useRef(false);
  const draftKey = `hub:composer:${clientId}`;

  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 7000); }
  function toggleKey(k) {
    setSelKeys((ks) => ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]);
    const ch = k.split(":")[1];
    if (!selKeys.includes(k)) setActiveTab(ch);
  }
  const setVar = (ch, k, v) => setVariants((s) => ({ ...s, [ch]: { ...s[ch], [k]: v } }));

  // Turning on per-channel editing seeds each channel from what's already in the
  // shared caption/type, so nothing you've written disappears. Turning it back
  // off restores the shared caption from whichever channel you were editing.
  function toggleCustomize(on) {
    if (on) {
      setVariants((s) => {
        const next = { ...s };
        for (const ch of selChans) {
          const cur = s[ch] || {};
          next[ch] = {
            caption: cur.caption?.trim() ? cur.caption : caption,
            post_type: cur.post_type || baseType,
          };
        }
        return next;
      });
    } else {
      const src = variants[activeTab]?.caption ?? variants[selChans[0]]?.caption;
      if (src && !caption.trim()) setCaption(src);
    }
    setCustomize(on);
  }

  // effective {caption, type} per selected channel type. TikTok is always a
  // single video (no feed/reel/story choice), so it forces the video path.
  const plan = useMemo(() => selChans.map((ch) => ({
    ch,
    caption: customize ? (variants[ch]?.caption || "") : caption,
    type: ch === "tiktok" ? "tiktok" : (customize ? (variants[ch]?.post_type || "feed") : baseType),
  })), [selChans, customize, variants, caption, baseType]);

  const feedActive = plan.some((p) => p.type === "feed" && p.ch !== "tiktok");
  const usesVideo = plan.some((p) => p.type === "reel" || p.ch === "tiktok") || (feedVideo && feedActive);
  const usesImage = plan.some((p) => p.type === "story") || (!feedVideo && feedActive);
  const ttActive = selChans.includes("tiktok");
  const reelActive = plan.some((p) => p.type === "reel") || (feedVideo && feedActive);
  const coverApplies = usesVideo && (selChans.includes("instagram") || selChans.includes("facebook")) && !(ttActive && selChans.length === 1);

  useEffect(() => {
    if (!usesVideo || !videoUrl.trim()) { setVideoWarn(""); return; }
    let cancel = false;
    videoMeta(videoUrl.trim()).then((m) => { if (!cancel) setVideoWarn(validateReel(m) || ""); });
    return () => { cancel = true; };
  }, [usesVideo, videoUrl]);

  // Draft persistence: a new post survives navigating away (Listen & Create,
  // GA tab, etc.) and coming back. Keyed per client; never touches edit mode.
  useEffect(() => {
    if (editItem) { hydratedRef.current = true; return; }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          if (typeof d.caption === "string") setCaption(d.caption);
          if (d.variants && typeof d.variants === "object") setVariants((s) => ({ ...s, ...d.variants }));
          if (d.baseType) setBaseType(d.baseType);
          if (typeof d.link === "string") setLink(d.link);
          if (Array.isArray(d.media)) setMedia(d.media);
          if (typeof d.videoUrl === "string") setVideoUrl(d.videoUrl);
          if (typeof d.coverUrl === "string") setCoverUrl(d.coverUrl);
          if (typeof d.feedVideo === "boolean") setFeedVideo(d.feedVideo);
          if (typeof d.firstComment === "string") setFirstComment(d.firstComment);
          if (Array.isArray(d.selKeys)) { const k = d.selKeys.filter((x) => options.some((o) => o.key === x)); if (k.length) setSelKeys(k); }
          if (typeof d.customize === "boolean") setCustomize(d.customize);
          setRestored(true);
        }
      }
    } catch {}
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editItem || !hydratedRef.current) return;
    const hasContent = caption.trim() || media.length || videoUrl.trim() || firstComment.trim() ||
      Object.values(variants).some((v) => v?.caption?.trim());
    try {
      if (hasContent) localStorage.setItem(draftKey, JSON.stringify({ caption, variants, baseType, link, media, videoUrl, coverUrl, feedVideo, firstComment, selKeys, customize }));
      else localStorage.removeItem(draftKey);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItem, caption, variants, baseType, link, media, videoUrl, coverUrl, feedVideo, firstComment, selKeys, customize]);

  function discardDraft() {
    try { localStorage.removeItem(draftKey); } catch {}
    setCaption(""); setVariants({ facebook: { caption: "", post_type: "feed" }, instagram: { caption: "", post_type: "feed" } });
    setBaseType("feed"); setLink(""); setMedia([]); setVideoUrl(""); setCoverUrl(""); setFeedVideo(false); setFirstComment(""); setCustomize(false); setRestored(false);
  }

  async function onFiles(e) {
    await uploadFiles([...e.target.files]);
  }
  async function uploadFiles(files) {
    files = files.filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setUploading(true); setIgWarn("");
    try {
      for (const f of files) {
        const b64 = await fileToB64(f);
        if (selChans.includes("instagram")) {
          try {
            const s = await imageSize(b64);
            if (baseType === "feed" && (s.ratio < IG_FEED_MIN - 0.02 || s.ratio > IG_FEED_MAX + 0.02))
              setIgWarn("This image's shape is outside Instagram feed limits (portrait 4:5 to landscape 1.91:1). Click ✎ Edit in Studio to reframe it so it isn't rejected.");
            else if (s.w < 1080)
              setIgWarn(`This image is only ${s.w}px wide. Instagram displays feed images at 1080px, so it'll be upscaled and look soft — use a source at least 1080px wide for the sharpest result.`);
          } catch {}
        }
        setProgress((p) => ({ ...p, [f.name]: 0 }));
        const d = await uploadImage({ image_base64: b64, filename: f.name, onProgress: (pct) => setProgress((p) => ({ ...p, [f.name]: pct })) });
        if (d.url) setMedia((m) => [...m, d.url]);
        setProgress((p) => { const n = { ...p }; delete n[f.name]; return n; });
      }
    } catch (err) { flash("Upload failed: " + (err.message || err)); } finally { setUploading(false); }
  }

  async function onVideoFiles(files) {
    const f = [...files].find((x) => x.type.startsWith("video/"));
    if (!f) { flash("That file isn't a video. Reels and TikTok need an MP4/MOV."); return; }
    setVUploading(true); setVProgress(0); setVideoWarn("");
    try {
      const d = await uploadVideoSigned({ file: f, onProgress: (pct) => setVProgress(pct) });
      if (d.url) setVideoUrl(d.url);
    } catch (err) {
      flash("Video upload failed: " + (err.message || err));
    } finally { setVUploading(false); setVProgress(null); }
  }
  function onVideoInput(e) { if (e.target.files?.length) onVideoFiles(e.target.files); }

  async function onCoverInput(e) {
    const f = [...e.target.files].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setCUploading(true);
    try {
      const b64 = await fileToB64(f);
      const d = await uploadImage({ image_base64: b64, filename: f.name });
      if (d.url) setCoverUrl(d.url);
    } catch (err) { flash("Cover upload failed: " + (err.message || err)); } finally { setCUploading(false); }
  }

  function validate() {
    if (!selKeys.length) return "Pick at least one account.";
    if (usesVideo && usesImage) return "TikTok and Reels are video; Feed/Story are images — they can't share one post. Make separate posts.";
    const chIsVideo = (p) => p.type === "reel" || p.ch === "tiktok" || (feedVideo && p.type === "feed");
    for (const p of plan) {
      if (p.caption.length > LIMITS[p.ch]) return `${CHAN_LABEL[p.ch]} caption is over the ${LIMITS[p.ch].toLocaleString()}-character limit.`;
      if (p.ch === "tiktok" && !videoUrl.trim()) return "TikTok posts need a video URL (TikTok is video only).";
      if (p.ch === "instagram") {
        if (chIsVideo(p)) { if (!videoUrl.trim()) return "Instagram video posts need a video."; }
        else {
          if (media.length === 0) return "Instagram posts need at least one image.";
          if (p.type === "story" && media.length > 1) return "A Story is a single image — remove the extras.";
          if (media.length > 10) return "Instagram allows up to 10 images per post.";
        }
      }
      if (p.ch === "facebook") {
        if (chIsVideo(p)) { if (!videoUrl.trim()) return "Facebook video posts need a video."; }
        else if (p.type === "story" && media.length === 0) return "A Facebook Story needs an image.";
      }
    }
    return null;
  }

  async function save(status, publishNow = false) {
    const err = validate(); if (err) { flash(err); return; }
    if (publishNow && !window.confirm("Publish now to the live account(s)? This posts immediately.")) return;
    setBusy(publishNow ? "now" : status);
    const mediaUrls = usesVideo ? [videoUrl.trim()] : media;
    const payloadVariants = customize
      ? Object.fromEntries(selChans.map((ch) => [ch, { caption: variants[ch]?.caption || "", post_type: variants[ch]?.post_type || "feed" }]))
      : {};
    // Post Now = approved with an immediate (past) schedule so the publisher grabs it this run.
    const shared = {
      clientId, caption, link: link || null, mediaUrls, coverUrl: (usesVideo && coverUrl) ? coverUrl : null,
      postType: baseType, variants: payloadVariants, firstComment: firstComment || null,
      scheduledAt: publishNow ? new Date().toISOString() : (scheduledAt ? new Date(scheduledAt).toISOString() : null),
      publishNow,
    };
    // one content item per selected identity; TikTok has no Meta social_accounts
    // row, so its group saves with socialAccountId null (publisher looks it up by
    // client_id).
    const groups = [];
    for (const k of selKeys) {
      const [sid, ch] = k.split(":");
      const groupSid = sid === "tiktok" ? null : sid;
      let g = groups.find((x) => x.socialAccountId === groupSid);
      if (!g) { g = { socialAccountId: groupSid, channels: [] }; groups.push(g); }
      if (!g.channels.includes(ch)) g.channels.push(ch);
    }
    const effStatus = publishNow ? "approved" : status;
    const label = publishNow ? "Publishing now…" : (editItem && status === editItem.status) ? "Changes saved." : status === "draft" ? "Saved as draft." : status === "needs_approval" ? "Submitted for approval." : "Approved & scheduled.";
    try {
      let firstErr = null;
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        let d;
        if (editItem && i === 0) {
          const r1 = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "update", id: editItem.id, ...shared, channels: g.channels, socialAccountId: g.socialAccountId }) });
          d = await r1.json();
          if (!d.error) {
            const r2 = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id: editItem.id, status: effStatus, approvedBy: "agency", publishNow }) });
            d = await r2.json();
          }
        } else {
          const r = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "create", ...shared, channels: g.channels, socialAccountId: g.socialAccountId, status: effStatus }) });
          d = await r.json();
        }
        if (d.error && !firstErr) firstErr = d.error;
      }
      if (firstErr) flash("Error: " + firstErr);
      else {
        if (!editItem) { try { localStorage.removeItem(draftKey); } catch {} }
        onDone(groups.length > 1 ? `${label} (${groups.length} accounts)` : label);
        router.refresh();
      }
    } finally { setBusy(""); }
  }

  const igActive = selChans.includes("instagram");

  // Live preview: which channel's card to show + its effective caption/media.
  const pvCh = selChans.includes(previewCh) ? previewCh : (selChans[0] || null);
  const previewCaption = customize ? (variants[pvCh]?.caption || "") : caption;
  const previewType = pvCh === "tiktok" ? "tiktok" : (customize ? (variants[pvCh]?.post_type || "feed") : baseType);

  return (
    <div className="composer">
      <div className="cmp-main">
      {restored && !editItem && (
        <div className="cmp-restored">
          ↩ Restored your unsaved draft.
          <button type="button" onClick={discardDraft}>Start fresh</button>
        </div>
      )}
      <div className="cmp-row">
        <div className="cmp-field" style={{ flex: 1, minWidth: 260 }}>
          <label>Post to</label>
          <AccountSelect options={options} selKeys={selKeys} onToggle={toggleKey}
            onAll={() => setSelKeys(options.map((o) => o.key))} onClear={() => setSelKeys([])} />
        </div>
        {selChans.length > 1 && (
          <label className="cmp-toggle">
            <input type="checkbox" checked={customize} onChange={(e) => toggleCustomize(e.target.checked)} /> Customize per channel
          </label>
        )}
      </div>

      {!customize ? (
        <>
          <div className="cmp-field">
            <div className="cmp-label-row">
              <label>Caption</label>
              <CharCount value={caption} channels={selChans} />
            </div>
            <FormatBar textareaRef={sharedRef} value={caption} onChange={setCaption} />
            <textarea ref={sharedRef} rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write the post…" />
          </div>
          <div className="cmp-field">
            <label>Post type</label>
            <TypePicker value={baseType} onChange={setBaseType} />
          </div>
        </>
      ) : (
        <div className="cmp-field">
          <div className="cmp-tabs">
            {selChans.map((ch) => <button key={ch} type="button" className={"cmp-tab" + (activeTab === ch ? " active" : "")} onClick={() => setActiveTab(ch)}>{CHAN_LABEL[ch]}</button>)}
          </div>
          {selChans.filter((ch) => ch === activeTab).map((ch) => (
            <div key={ch}>
              <div className="cmp-label-row">
                <label>{CHAN_LABEL[ch]} caption</label>
                <span className={"charcount" + ((variants[ch]?.caption || "").length > LIMITS[ch] ? " over" : "")}>{(variants[ch]?.caption || "").length}/{LIMITS[ch].toLocaleString()}</span>
              </div>
              <FormatBar textareaRef={tabRef} value={variants[ch]?.caption || ""} onChange={(v) => setVar(ch, "caption", v)} />
              <textarea ref={tabRef} rows={5} value={variants[ch]?.caption || ""} onChange={(e) => setVar(ch, "caption", e.target.value)} placeholder={ch === "instagram" ? "IG caption — @mentions, #hashtags…" : ch === "tiktok" ? "TikTok caption — becomes the video description in drafts…" : "Facebook caption…"} />
              {ch !== "tiktok" && <div style={{ marginTop: 8 }}><label>Post type</label><TypePicker value={variants[ch]?.post_type || "feed"} onChange={(v) => setVar(ch, "post_type", v)} /></div>}
            </div>
          ))}
        </div>
      )}

      {feedActive && (
        <div className="cmp-field">
          <label>Feed media</label>
          <div className="type-picker">
            <button type="button" className={"type-opt" + (!feedVideo ? " active" : "")} onClick={() => setFeedVideo(false)}>Images</button>
            <button type="button" className={"type-opt" + (feedVideo ? " active" : "")} onClick={() => setFeedVideo(true)}>Video</button>
          </div>
          {feedVideo && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Posts as a Facebook feed video{selChans.includes("instagram") ? "; Instagram publishes it as a Reel (IG has no feed-video API)" : ""}.</div>}
        </div>
      )}

      {usesVideo ? (
        <div className={"cmp-field cmp-dropzone" + (vDragOver ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setVDragOver(true); }}
          onDragLeave={() => setVDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setVDragOver(false); onVideoFiles(e.dataTransfer.files); }}>
          <div className="cmp-label-row">
            <label>Video {ttActive ? "(Reel / TikTok)" : "(Reel)"} <span className="muted">· drag &amp; drop, choose a file, or paste a URL</span></label>
            <span className="muted" style={{ fontSize: 11 }}>≤ 90s, 9:16, 1080px wide</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <FileButton accept="video/*" onChange={onVideoInput} disabled={vUploading}>🎬 Choose video</FileButton>
          </div>
          {vUploading && (
            <div className="upl-prog">
              <div className="upl-bar"><div className="upl-fill" style={{ width: (vProgress || 0) + "%" }} /></div>
              <span className="upl-pct">{vProgress || 0}%</span>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="…or paste a public MP4 URL" style={{ width: "100%" }} />
          </div>
          {videoUrl && !vUploading && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <video src={videoUrl} controls playsInline preload="metadata" style={{ width: 180, maxHeight: 320, borderRadius: 10, background: "#000", border: "1px solid #e6e8eb" }} />
              <button type="button" className="social-btn" onClick={() => setVideoUrl("")}>Remove video</button>
            </div>
          )}
          {coverApplies && (
            <div style={{ marginTop: 12 }}>
              <label>Cover photo <span className="muted">(optional — the {reelActive ? "Reel" : "video"} thumbnail{selChans.includes("instagram") ? " on Instagram" : ""})</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <FileButton accept="image/*" onChange={onCoverInput} disabled={cUploading}>🖼 Choose cover</FileButton>
                {cUploading && <span className="muted" style={{ fontSize: 11 }}>Uploading…</span>}
                {coverUrl && !cUploading && (
                  <div className="cmp-thumb" style={{ width: 60, height: 60 }}>
                    <img src={coverUrl} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                    <button type="button" onClick={() => setCoverUrl("")}>×</button>
                  </div>
                )}
              </div>
              {selChans.includes("facebook") && !selChans.includes("instagram") && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Facebook picks the cover automatically — this applies on Instagram.</div>}
            </div>
          )}
          {ttActive && <div className="cmp-warn" style={{ background: "#f5f3ff", borderColor: "#ddd6fe", color: "#5b21b6" }}>ℹ TikTok sends the video to the brand&apos;s TikTok <b>drafts</b> — someone finishes posting in the TikTok app (where they can add music &amp; effects). Direct-to-feed unlocks after TikTok approves the app.</div>}
          {videoWarn && <div className="cmp-warn">⚠ {videoWarn}</div>}
        </div>
      ) : (
        <div className={"cmp-field cmp-dropzone" + (dragOver ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles([...e.dataTransfer.files]); }}>
          <div className="cmp-label-row">
            <label>Images {igActive && <span className="muted">· 1 for a Story, up to 10 for a carousel · or drag &amp; drop here</span>}</label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <FileButton accept="image/*" multiple onChange={onFiles} disabled={uploading}>🖼 Choose image{"(s)"}</FileButton>
            {dropbox && <button type="button" className="social-btn" onClick={() => setDbxOpen(true)}>📦 Add from Dropbox</button>}
          </div>
          {dbxOpen && <DropboxPicker clientId={clientId} startPath={dbxFolder} onDefaultSaved={(p) => setDbxFolder(p)} onAdd={(url) => setMedia((m) => [...m, url])} onClose={() => setDbxOpen(false)} />}
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
                <div key={j} className="cmp-thumb-col">
                  <div className="cmp-thumb">
                    <img src={u} alt="" />
                    <button type="button" onClick={() => setMedia((m) => m.filter((_, i) => i !== j))}>×</button>
                  </div>
                  <button type="button" className="studio-edit-btn" onClick={() => setEditorIdx(j)}>✎ Edit in Studio</button>
                </div>
              ))}
            </div>
          )}
          {editorIdx !== null && media[editorIdx] && (
            <ImageEditor src={media[editorIdx]} brandLogo={brandLogo}
              onApply={async (dataUrl) => {
                setUploading(true);
                try {
                  const d = await uploadImage({ image_base64: dataUrl, filename: "edited.jpg" });
                  if (d.url) setMedia((m) => m.map((u, i) => (i === editorIdx ? d.url : u)));
                } finally { setUploading(false); }
              }}
              onClose={() => setEditorIdx(null)} />
          )}
        </div>
      )}

      {plan.some((p) => p.ch === "facebook" && p.type === "feed") && (
        (showLink || link) ? (
          <div className="cmp-field">
            <div className="cmp-label-row">
              <label>Link <span className="muted">(Facebook feed only)</span></label>
              <button type="button" className="cmp-collapse" onClick={() => { setLink(""); setShowLink(false); }}>Remove</button>
            </div>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          </div>
        ) : (
          <button type="button" className="cmp-add" onClick={() => setShowLink(true)}>+ Add a link <span className="muted" style={{ fontWeight: 400 }}>(Facebook feed only)</span></button>
        )
      )}

      {(showFirst || firstComment) ? (
        <div className="cmp-field">
          <div className="cmp-label-row">
            <label>First comment <span className="muted">(posted right after)</span></label>
            <button type="button" className="cmp-collapse" onClick={() => { setFirstComment(""); setShowFirst(false); }}>Remove</button>
          </div>
          <textarea rows={2} value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="Drop links or extra hashtags here…" />
        </div>
      ) : (
        <button type="button" className="cmp-add" onClick={() => setShowFirst(true)}>+ Add a first comment</button>
      )}

      <div className="cmp-field">
        <label>Schedule for</label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Leave blank to publish as soon as it&apos;s approved.</div>
      </div>

      {msg && <div className="push-err">{msg}</div>}
      <div className="cmp-actions">
        {onCancel && <button className="cmp-btn ghost" onClick={onCancel} disabled={!!busy}>Cancel</button>}
        {editItem && editItem.status !== "draft" && (
          <button className="cmp-btn solid" onClick={() => save(editItem.status)} disabled={!!busy} title="Save your edits (time, caption, media) without changing the approval status">
            {busy === editItem.status ? "Saving…" : "Save changes"}
          </button>
        )}
        <button className="cmp-btn ghost" onClick={() => save("draft")} disabled={!!busy}>Save draft</button>
        <button className="cmp-btn outline" onClick={() => save("needs_approval")} disabled={!!busy}>Submit for approval</button>
        <button className="cmp-btn solid" onClick={() => save("approved")} disabled={!!busy}>{busy === "approved" ? "Scheduling…" : "Approve & schedule"}</button>
        <button className="cmp-btn now" onClick={() => save("approved", true)} disabled={!!busy} title="Publish immediately to the live account(s)">{busy === "now" ? "Publishing…" : "⚡ Post now"}</button>
      </div>
      </div>

      <aside className="cmp-preview">
        <div className="pv-bar">
          <span className="pv-title">Preview</span>
          {selChans.length > 1 && (
            <div className="pv-tabs">
              {selChans.map((ch) => <button key={ch} type="button" className={"pv-tab" + (pvCh === ch ? " on" : "")} onClick={() => setPreviewCh(ch)}>{CHAN_LABEL[ch]}</button>)}
            </div>
          )}
        </div>
        {pvCh
          ? <ComposerPreview channel={pvCh} options={options} brandLogo={brandLogo} caption={previewCaption} postType={previewType} usesVideo={usesVideo} videoUrl={videoUrl} coverUrl={coverUrl} media={media} />
          : <div className="muted" style={{ fontSize: 12, padding: 12 }}>Pick an account to see a preview.</div>}
        <div className="pv-hint">Line breaks &amp; paragraphs show exactly as they&apos;ll post. Instagram &amp; Facebook collapse long captions after ~125 characters with a “more” link.</div>
      </aside>
    </div>
  );
}

/* ---------------- Live post preview ---------------- */
function ComposerPreview({ channel, options, brandLogo, caption, postType, usesVideo, videoUrl, coverUrl, media }) {
  const opt = options.find((o) => o.ch === channel);
  const isIG = channel === "instagram";
  const isTT = channel === "tiktok";
  const rawHandle = opt?.label || (isIG ? "instagram" : isTT ? "tiktok" : "Facebook Page");
  const handle = rawHandle.replace(/^@/, "");
  const showVideo = usesVideo && !!videoUrl;
  const imgs = Array.isArray(media) ? media : [];
  const TRUNC = 125;
  const text = caption || "";
  const feedTrunc = !isTT && [...text].length > TRUNC ? [...text].slice(0, TRUNC).join("") : null;

  return (
    <div className={"pv-card " + channel}>
      <div className="pv-head">
        <div className="pv-avatar">{brandLogo ? <img src={brandLogo} alt="" /> : <span>{handle.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="pv-name">{isIG || isTT ? handle : rawHandle}</div>
        <span className="pv-more">⋯</span>
      </div>
      <div className={"pv-media" + (showVideo || postType === "reel" || postType === "story" ? " tall" : "")}>
        {showVideo
          ? <video src={videoUrl} muted playsInline preload="metadata" poster={coverUrl || undefined} />
          : imgs.length
            ? <img src={imgs[0]} alt="" />
            : <div className="pv-media-empty">Media preview</div>}
        {!showVideo && imgs.length > 1 && <span className="pv-count">1 / {imgs.length}</span>}
      </div>
      <div className="pv-body">
        <div className="pv-caption">
          {(isIG || isTT) && text && <b className="pv-user">{handle}</b>}
          {text
            ? <span className="pv-cap-text">{text}</span>
            : <span className="pv-cap-text muted">Your caption will render here — with the exact line breaks and spacing it&apos;ll post with.</span>}
        </div>
        {feedTrunc && (
          <div className="pv-feednote">
            In the feed it collapses to:<br />
            <span className="pv-feedtext">{feedTrunc}…</span> <b>more</b>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSelect({ options, selKeys, onToggle, onAll, onClear }) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => selKeys.includes(o.key));
  return (
    <div className="acctsel">
      <button type="button" className="acctsel-control" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? <span className="acctsel-ph">Select an account</span> : (
          <span className="acctsel-chips">
            {selected.map((o) => (
              <span key={o.key} className={"acctsel-chip " + o.ch}>
                {o.label}
                <span className="acctsel-x" onClick={(e) => { e.stopPropagation(); onToggle(o.key); }}>×</span>
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
          {options.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "6px 10px" }}>No accounts connected yet.</div>}
          {options.map((o) => (
            <label key={o.key} className="acctsel-opt">
              <input type="checkbox" checked={selKeys.includes(o.key)} onChange={() => onToggle(o.key)} />
              <span className={"acctsel-dot " + o.ch} />
              <span className="acctsel-lbl">{o.label}</span>
              <span className="acctsel-plat">{o.handle}</span>
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
export default function ContentManager({ clientId, client, items, socials, tiktok, open: openProp, setOpen: setOpenProp, seedDate, editId, dropbox, dropboxFolder, brandLogo }) {
  const router = useRouter();
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = setOpenProp || setOpenLocal;
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [checked, setChecked] = useState([]);
  const multiIdent = socials.length > 1;
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }
  const toggleCheck = (id) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const selectable = items.filter((it) => it.status !== "published" && it.status !== "publishing").map((it) => it.id);

  async function bulk(op, opts = {}) {
    if (!checked.length) return;
    if (op === "delete" && !window.confirm(`Delete ${checked.length} item(s)?`)) return;
    setBusy("bulk");
    try {
      for (const id of checked) {
        await fetch("/api/content", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op === "delete" ? { op: "delete", id } : { op: "status", id, status: op, approvedBy: "agency", ...opts }),
        });
      }
      flash(`${checked.length} item(s) ${op === "delete" ? "deleted" : op === "approved" ? "approved" : "submitted"}.`);
      setChecked([]);
      router.refresh();
    } finally { setBusy(""); }
  }

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
  async function retryChannelAction(id, channel) {
    setBusy(id + "rc" + channel);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "retry_channel", id, channel }) });
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

      <SocialConnect clientId={clientId} client={client} socials={socials} />
      {msg && <div className="mng-msg">{msg}</div>}

      {open && (
        <>
          {editItem && <div className="cmp-editing">Editing an existing {STATUS_LABEL[editItem.status]?.toLowerCase()} post</div>}
          <Composer key={editItem?.id || "new"} clientId={clientId} socials={socials} tiktok={tiktok} seedDate={seedDate} editItem={editItem} dropbox={dropbox} dropboxFolder={dropboxFolder} brandLogo={brandLogo} onDone={(m) => { flash(m); setOpen(false); setEditItem(null); }} onCancel={() => { setOpen(false); setEditItem(null); }} />
        </>
      )}

      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>No content yet.</div>
      ) : (
        <>
        {selectable.length > 0 && (
          <div className="bulk-bar">
            <label className="bulk-all">
              <input type="checkbox"
                checked={checked.length > 0 && checked.length === selectable.length}
                onChange={(e) => setChecked(e.target.checked ? selectable : [])} />
              {checked.length ? `${checked.length} selected` : "Select all"}
            </label>
            {checked.length > 0 && (
              <div className="bulk-actions">
                <button className="social-btn" disabled={busy === "bulk"} onClick={() => bulk("needs_approval")}>Submit</button>
                <button className="cal-approve" disabled={busy === "bulk"} onClick={() => bulk("approved")}>Approve</button>
                <button className="rule-del" disabled={busy === "bulk"} onClick={() => bulk("delete")}>Delete</button>
              </div>
            )}
          </div>
        )}
        <div className="content-list">
          {items.map((it) => (
            <div key={it.id} className="content-row">
              {it.status !== "published" && it.status !== "publishing" && (
                <input type="checkbox" className="row-check" checked={checked.includes(it.id)} onChange={() => toggleCheck(it.id)} />
              )}
              {(() => {
                const canEdit = it.status !== "published" && it.status !== "publishing";
                const cls = "content-thumb" + (canEdit ? " clickable" : "");
                const onClick = canEdit ? () => startEdit(it) : undefined;
                const title = canEdit ? "Open this post" : undefined;
                if (!it.media_urls?.[0]) return null;
                if (it.cover_url) return <img className={cls} src={it.cover_url} alt="" onClick={onClick} title={title} />;
                if (isVideoUrl(it.media_urls[0])) return <video className={cls} src={it.media_urls[0]} muted playsInline preload="metadata" onClick={onClick} title={title} />;
                return <img className={cls} src={it.media_urls[0]} alt="" onClick={onClick} title={title} />;
              })()}
              <div className="content-main">
                <div className="content-top">
                  <span className={"cbadge " + it.status}>{STATUS_LABEL[it.status]}</span>
                  {multiIdent && it.identity_name && <span className="content-ident">{it.identity_name}</span>}
                  <span className="content-chan">{(it.channels || []).join(" + ")}</span>
                  {it.post_type && it.post_type !== "feed" && <span className="content-type">{it.post_type}</span>}
                  <span className="content-when">{it.scheduled_at ? new Date(it.scheduled_at).toLocaleString() : it.published_at ? "Published " + new Date(it.published_at).toLocaleDateString() : "no date"}</span>
                </div>
                <div className={"content-cap" + (it.status !== "published" && it.status !== "publishing" ? " clickable" : "")}
                  onClick={it.status !== "published" && it.status !== "publishing" ? () => startEdit(it) : undefined}>{it.caption?.slice(0, 140) || "(no caption)"}</div>
                {it.note && <div className="content-note">📝 {it.note}</div>}
                {it.error && (
                  <div className={"content-err " + (it.error_kind || "permanent")}>
                    <span className="err-flag">{it.error_kind === "transient" ? "⏳ Temporary — retry shortly" : "⚠ Needs a fix"}</span>
                    <span className="err-txt">{it.error}</span>
                  </div>
                )}
                {it.status === "failed" && it.channels?.length > 0 && (
                  <div className="chan-retry">
                    {it.channels.map((ch) => {
                      const posted = { facebook: it.fb_post_id, instagram: it.ig_post_id, tiktok: it.tiktok_publish_id }[ch];
                      return posted
                        ? <span key={ch} className="chan-chip ok" title="Already published — won't re-post">{CHAN_LABEL[ch] || ch} ✓</span>
                        : <button key={ch} className="chan-chip retry" disabled={busy === it.id + "rc" + ch} onClick={() => retryChannelAction(it.id, ch)}>↻ Retry {CHAN_LABEL[ch] || ch}</button>;
                    })}
                  </div>
                )}
              </div>
              <div className="content-actions">
                {it.status !== "published" && it.status !== "publishing" && <button onClick={() => startEdit(it)}>Edit</button>}
                {(it.status === "draft" || it.status === "needs_revisions") && <button disabled={busy === it.id + "needs_approval"} onClick={() => itemAction(it.id, "needs_approval")}>Submit</button>}
                {it.status === "needs_approval" && <button disabled={busy === it.id + "rev"} onClick={() => requestRevisions(it.id)}>Request revisions</button>}
                {(it.status === "draft" || it.status === "needs_approval" || it.status === "needs_revisions") && <button className="cal-approve" disabled={busy === it.id + "approved"} onClick={() => itemAction(it.id, "approved")}>Approve</button>}
                {["approved", "scheduled"].includes(it.status) && <button disabled={busy === it.id + "draft"} onClick={() => itemAction(it.id, "draft")}>Unschedule</button>}
                {it.status !== "published" && <button className="rule-del" disabled={busy === it.id + "del"} onClick={() => del(it.id)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
