"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function timeAgo(s) {
  if (!s) return "";
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 3600) return Math.round(d / 60) + "m ago";
  if (d < 86400) return Math.round(d / 3600) + "h ago";
  return Math.round(d / 86400) + "d ago";
}

export default function BrandListener({ clientId, sources, mentions, onRepurpose }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "rss", label: "", url: "", query: "", provider: "" });
  const [filter, setFilter] = useState("all");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }
  const hasMeta = sources.some((s) => s.kind === "meta");

  const platformOf = (m) => (String(m.mtype || "").startsWith("fb") ? "facebook" : String(m.mtype || "").startsWith("ig") ? "instagram" : "web");
  const counts = mentions.reduce((a, m) => { const p = platformOf(m); a[p] = (a[p] || 0) + 1; return a; }, {});
  const shown = filter === "all" ? mentions : mentions.filter((m) => platformOf(m) === filter);
  const FILTERS = [["all", "All", mentions.length], ["facebook", "Facebook", counts.facebook || 0], ["instagram", "Instagram", counts.instagram || 0], ["web", "Web", counts.web || 0]];

  async function post(payload) {
    const r = await fetch("/api/brand-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  }
  async function connectMeta() {
    setBusy("meta");
    try {
      const d = await post({ op: "add", clientId, kind: "meta", label: "Facebook + Instagram mentions" });
      if (d.error) flash("Error: " + d.error);
      else { await post({ op: "poll", clientId }); flash("Connected — pulling Facebook & Instagram mentions."); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function add() {
    if (form.kind === "rss" && !form.url) { flash("Add the feed URL."); return; }
    if (form.kind === "hashtag" && !form.query) { flash("Enter a hashtag."); return; }
    setBusy("add");
    try {
      const label = form.label || (form.kind === "hashtag" ? form.query : "");
      const d = await post({ op: "add", clientId, ...form, label });
      if (d.error) flash("Error: " + d.error);
      else { setForm({ kind: "rss", label: "", url: "", query: "", provider: "" }); setOpen(false); await post({ op: "poll", clientId }); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function poll() {
    setBusy("poll"); flash("Checking feeds…");
    try {
      const d = await post({ op: "poll", clientId });
      if (d.error) flash("Error: " + d.error);
      else { flash("Feeds refreshed."); router.refresh(); }
    } finally { setBusy(""); }
  }

  return (
    <div id="listener" className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Brand Listener</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="social-btn" onClick={poll} disabled={busy === "poll"}>{busy === "poll" ? "Checking…" : "Refresh now"}</button>
          <button className="studio-btn" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add source"}</button>
        </div>
      </div>
      <p className="note">Mentions and tags for this brand — native Facebook + Instagram tags/posts, plus any RSS feeds you add (Google Alerts, Reddit, YouTube, blogs).</p>

      {msg && <div className="mng-msg">{msg}</div>}

      {!hasMeta && (
        <div className="meta-connect">
          <div>
            <b>Facebook + Instagram mentions</b>
            <div className="muted" style={{ fontSize: 12 }}>Pull posts your Page is tagged in, visitor posts, and Instagram tags automatically.</div>
          </div>
          <button className="push-create" onClick={connectMeta} disabled={busy === "meta"}>{busy === "meta" ? "Connecting…" : "Connect"}</button>
        </div>
      )}

      {open && (
        <div className="rule-form">
          <div className="rule-grid">
            <div>
              <label>Type</label>
              <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                <option value="rss">RSS feed</option>
                <option value="hashtag">Instagram hashtag</option>
                <option value="api">Provider API</option>
              </select>
            </div>
            <div>
              <label>Label</label>
              <input type="text" value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Google Alerts – brand" />
            </div>
          </div>
          {form.kind === "rss" ? (
            <>
              <label>Feed URL</label>
              <input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.google.com/alerts/feeds/…" />
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Tip: create a Google Alert → deliver to “RSS feed” → paste the feed URL here. Reddit: add .rss to a search URL.</div>
            </>
          ) : form.kind === "hashtag" ? (
            <>
              <label>Hashtag</label>
              <input type="text" value={form.query} onChange={(e) => set("query", e.target.value)} placeholder="#slavensracing" />
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Pulls recent public Instagram posts using this hashtag (via your connected IG account).</div>
            </>
          ) : (
            <>
              <label>Provider</label>
              <input type="text" value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="brand24 / mention / talkwalker" />
              <label>Search query</label>
              <input type="text" value={form.query} onChange={(e) => set("query", e.target.value)} placeholder="brand name, product, @handle" />
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Needs a provider API key set in the backend to activate.</div>
            </>
          )}
          <button className="push-create" style={{ marginTop: 10 }} onClick={add} disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add source"}</button>
        </div>
      )}

      {sources.length > 0 && (
        <div className="src-row-wrap">
          {sources.map((s) => (
            <div key={s.id} className={"src-chip" + (s.enabled ? "" : " off")}>
              <span className="src-kind">{s.kind}</span>
              <span className="src-label">{s.label || s.url || s.query}</span>
              <button className={"src-toggle " + (s.enabled ? "on" : "off")} title={s.enabled ? "Enabled — click to pause" : "Paused — click to enable"}
                onClick={async () => { setBusy(s.id); await post({ op: "toggle", id: s.id, enabled: !s.enabled }); router.refresh(); setBusy(""); }}>
                {s.enabled ? "On" : "Off"}
              </button>
              <button className="src-remove" title="Remove source" onClick={async () => { if (!confirm("Remove this source?")) return; setBusy(s.id); await post({ op: "delete", id: s.id }); router.refresh(); setBusy(""); }}>×</button>
            </div>
          ))}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="listen-filter">
          {FILTERS.map(([k, label, n]) => (
            <button key={k} className={"lf-btn" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>{label} <span className="lf-count">{n}</span></button>
          ))}
        </div>
      )}

      {mentions.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>No mentions yet. Add a source and hit “Refresh now.”</div>
      ) : (
        <div className="mention-list">
          {shown.map((m) => (
            <Mention key={m.id} clientId={clientId} m={m} onRepurpose={onRepurpose} />
          ))}
        </div>
      )}
    </div>
  );
}

function Mention({ clientId, m, onRepurpose }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const isFb = String(m.mtype || "").startsWith("fb");
  const canReply = ["fb_tag", "fb_visitor", "fb_mention", "ig_tag", "ig_comment", "ig_mention"].includes(m.mtype);
  const KIND_LABEL = { image: "Picture", video: "Video", carousel: "Carousel", reel: "Reel", story: "Story" };
  const isVideo = m.media_kind === "video" || m.media_kind === "reel";

  async function act(action, message) {
    setBusy(action);
    try {
      const r = await fetch("/api/mention-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, mention_id: m.id, message }) });
      const d = await r.json();
      if (d.error) setNote(d.error);
      else { setReplying(false); setText(""); router.refresh(); }
    } finally { setBusy(""); }
  }

  return (
    <div className="mention">
      <span className={"sent " + (m.sentiment || "neutral")} />
      {isVideo && m.media_url ? (
        <video className="mention-media" src={m.media_url} controls muted playsInline poster={m.media_urls?.[0] || undefined} />
      ) : Array.isArray(m.media_urls) && m.media_urls.length > 1 ? (
        <div className="mention-strip">
          {m.media_urls.slice(0, 5).map((u, i) => <img key={i} className="mention-media" src={u} alt="" />)}
          {m.media_urls.length > 5 && <span className="cal-more">+{m.media_urls.length - 5}</span>}
        </div>
      ) : m.media_url ? (
        <img className="mention-media" src={m.media_url} alt="" />
      ) : null}
      <div className="mention-body">
        <div className="mention-top">
          {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="mention-title">{m.title}</a> : <span className="mention-title">{m.title}</span>}
          <span className="mention-when">{timeAgo(m.published_at || m.created_at)}</span>
        </div>
        {m.snippet && <div className="mention-snip">{m.snippet.slice(0, 240)}</div>}
        <div className="mention-tags">
          {m.media_kind && <span className="mtag kind">{KIND_LABEL[m.media_kind] || m.media_kind}</span>}
          {(m.tags || []).map((t) => <span key={t} className="mtag">{t}</span>)}
          {m.author && <span className="mention-author">{m.author}</span>}
          {m.responded && <span className="mtag replied">replied</span>}
        </div>
        <div className="mention-actions">
          {canReply && <button onClick={() => setReplying((r) => !r)}>{replying ? "Cancel" : "Reply"}</button>}
          {isFb && <button disabled={busy === "like"} onClick={() => act("like")}>{busy === "like" ? "…" : "Like"}</button>}
          <button className="mention-repurpose" onClick={() => onRepurpose({ text: `${m.title}. ${m.snippet || ""}`, image: m.media_url || "" })}>Repurpose →</button>
        </div>
        {replying && (
          <div className="mention-reply">
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" />
            <button className="push-create" disabled={busy === "reply" || !text.trim()} onClick={() => act("reply", text)}>{busy === "reply" ? "Sending…" : "Send reply"}</button>
          </div>
        )}
        {note && <div className="push-err">{note}</div>}
      </div>
    </div>
  );
}
