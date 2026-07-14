"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};

function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

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
      if (d.error) setMsg("Error: " + d.error);
      else setPages(d.pages || []);
    } finally { setBusy(false); }
  }
  async function connect(page_id) {
    setBusy(true);
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", client_id: clientId, page_id }) });
      const d = await r.json();
      if (d.error) setMsg("Error: " + d.error);
      else { router.refresh(); setPages(null); }
    } finally { setBusy(false); }
  }

  if (social?.fb_page_id) {
    return (
      <div className="social-status connected">
        <span className="social-ok">✓ Connected</span>
        <span>{social.fb_page_name}</span>
        {social.ig_username ? <span className="social-ig">@{social.ig_username}</span> : <span className="muted" style={{ fontSize: 11 }}>· no IG linked</span>}
        <button className="social-btn" onClick={discover} disabled={busy}>Change</button>
        {pages && <PagePicker pages={pages} onPick={connect} busy={busy} />}
        {msg && <div className="push-err">{msg}</div>}
      </div>
    );
  }
  return (
    <div className="social-status">
      <span className="muted" style={{ fontSize: 12.5 }}>No Facebook Page connected for {client}. Publishing needs one.</span>
      <button className="social-btn" onClick={discover} disabled={busy}>{busy ? "Loading…" : "Connect a Page"}</button>
      {pages && <PagePicker pages={pages} onPick={connect} busy={busy} />}
      {msg && <div className="push-err">{msg}</div>}
    </div>
  );
}

function PagePicker({ pages, onPick, busy }) {
  if (!pages.length) return <div className="muted" style={{ fontSize: 12 }}>No Pages available on the connected token. Make sure the Page is shared to your business.</div>;
  return (
    <div className="page-picker">
      {pages.map((p) => (
        <button key={p.id} className="page-opt" disabled={busy} onClick={() => onPick(p.id)}>
          {p.name}{p.ig_username ? ` · @${p.ig_username}` : ""}
        </button>
      ))}
    </div>
  );
}

export default function ContentManager({ clientId, client, items, social }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ caption: "", link: "", channels: ["facebook"], media: [], scheduledAt: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  function toggleChannel(c) {
    setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }));
  }

  async function onFiles(e) {
    const files = [...e.target.files];
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const b64 = await fileToB64(f);
        const r = await fetch("/api/content-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: b64, filename: f.name }) });
        const d = await r.json();
        if (d.url) setForm((ff) => ({ ...ff, media: [...ff.media, d.url] }));
        else flash("Upload failed: " + (d.error || "unknown"));
      }
    } finally { setUploading(false); }
  }

  async function save(status) {
    if (!form.channels.length) { flash("Pick at least one channel."); return; }
    if (form.channels.includes("instagram") && form.media.length === 0) { flash("Instagram posts need at least one image."); return; }
    setBusy(status);
    try {
      const r = await fetch("/api/content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", clientId, caption: form.caption, link: form.link || null, channels: form.channels, mediaUrls: form.media, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null, status }),
      });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { flash(status === "draft" ? "Saved as draft." : status === "needs_approval" ? "Submitted for approval." : "Approved & scheduled."); setForm({ caption: "", link: "", channels: ["facebook"], media: [], scheduledAt: "" }); setOpen(false); router.refresh(); }
    } finally { setBusy(""); }
  }

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
        <button className="studio-btn" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ New post"}</button>
      </div>
      <p className="note">Compose, schedule, and approve social posts for {client}. Approved posts publish automatically at their scheduled time to the connected Page and Instagram.</p>

      <SocialConnect clientId={clientId} client={client} social={social} />

      {msg && <div className="mng-msg">{msg}</div>}

      {open && (
        <div className="rule-form">
          <label>Channels</label>
          <div className="chan-row">
            <label className="rule-check"><input type="checkbox" checked={form.channels.includes("facebook")} onChange={() => toggleChannel("facebook")} /> Facebook</label>
            <label className="rule-check"><input type="checkbox" checked={form.channels.includes("instagram")} onChange={() => toggleChannel("instagram")} /> Instagram</label>
          </div>

          <label>Caption</label>
          <textarea rows={4} value={form.caption} onChange={(e) => set("caption", e.target.value)} placeholder="Write the post…" />

          <label>Link (optional, Facebook only)</label>
          <input type="url" value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />

          <label>Images</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading} />
          {uploading && <div className="muted" style={{ fontSize: 11 }}>Uploading…</div>}
          {form.media.length > 0 && (
            <div className="cal-modal-media">{form.media.map((u, j) => <img key={j} src={u} alt="" />)}</div>
          )}

          <label>Schedule for</label>
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Leave blank to publish as soon as it&apos;s approved.</div>

          <div className="push-actions" style={{ marginTop: 12 }}>
            <button className="push-cancel" onClick={() => save("draft")} disabled={busy}>Save draft</button>
            <button className="push-open" style={{ width: "auto" }} onClick={() => save("needs_approval")} disabled={busy}>Submit for approval</button>
            <button className="push-create" onClick={() => save("approved")} disabled={busy}>Approve &amp; schedule</button>
          </div>
        </div>
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
