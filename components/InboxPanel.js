"use client";
import { useEffect, useRef, useState } from "react";

function fmtWhen(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default function InboxPanel({ clientId, client }) {
  const [convos, setConvos] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const threadRef = useRef(null);

  async function call(body) {
    const r = await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, ...body }) });
    return r.json();
  }
  async function load() {
    setBusy("list"); setErr("");
    try {
      const d = await call({ action: "list" });
      if (d.error) setErr(d.error);
      else { setConvos(d.conversations || []); setWarnings(d.warnings || []); }
    } finally { setBusy(""); }
  }
  async function openThread(c) {
    setSel(c); setMsgs(null); setErr("");
    const d = await call({ action: "messages", conversation_id: c.id });
    if (d.error) setErr(d.error);
    else setMsgs(d.messages || []);
    requestAnimationFrame(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; });
  }
  async function send() {
    if (!reply.trim() || !sel?.who_id) return;
    setBusy("send");
    try {
      const d = await call({ action: "reply", recipient_id: sel.who_id, text: reply });
      if (d.error) setErr(d.error);
      else { setReply(""); await openThread(sel); }
    } finally { setBusy(""); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Inbox</h2>
        <button className="social-btn" disabled={busy === "list"} onClick={load}>{busy === "list" ? "Refreshing…" : "↻ Refresh"}</button>
      </div>
      <p className="note">Facebook Messenger + Instagram DMs for {client}, in one place. Replies send from the brand&apos;s account (Meta allows replies within 24h of the customer&apos;s last message).</p>

      {warnings.length > 0 && (
        <div className="cmp-warn" style={{ marginBottom: 10 }}>
          ⚠ Meta blocked part of the inbox: {warnings.join(" · ")}
          <div style={{ marginTop: 4, fontSize: 11.5 }}>Usually this means message access for connected tools isn&apos;t enabled on the Page / Instagram account yet (Page settings → messaging access; Instagram app → Settings → Messages → Connected tools).</div>
        </div>
      )}
      {err && <div className="push-err">{err}</div>}

      <div className="inbox-grid">
        <div className="inbox-list">
          {convos === null ? (
            <div className="muted" style={{ fontSize: 13, padding: 10 }}>Loading conversations…</div>
          ) : convos.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: 10 }}>No conversations yet.</div>
          ) : convos.map((c) => (
            <button key={c.id} className={"inbox-convo" + (sel?.id === c.id ? " active" : "")} onClick={() => openThread(c)}>
              <span className={"acctsel-dot " + (c.platform === "instagram" ? "instagram" : "facebook")} />
              <span className="inbox-who">{c.who}{c.unread > 0 && <span className="inbox-unread">{c.unread}</span>}</span>
              <span className="inbox-snippet">{c.snippet}</span>
              <span className="inbox-when">{fmtWhen(c.updated_time)}</span>
            </button>
          ))}
        </div>
        <div className="inbox-thread-wrap">
          {!sel ? (
            <div className="muted" style={{ fontSize: 13, padding: 16 }}>Pick a conversation to read and reply.</div>
          ) : (
            <>
              <div className="inbox-thread-head">{sel.who} <span className="muted" style={{ fontSize: 11.5 }}>· {sel.platform === "instagram" ? "Instagram" : "Messenger"}</span></div>
              <div className="inbox-thread" ref={threadRef}>
                {msgs === null ? (
                  <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
                ) : msgs.map((m) => (
                  <div key={m.id} className={"bubble" + (m.mine ? " mine" : "")}>
                    {m.attachment && <img src={m.attachment} alt="" style={{ maxWidth: 180, borderRadius: 8, display: "block", marginBottom: m.text ? 6 : 0 }} />}
                    {m.text}
                    <div className="bubble-when">{fmtWhen(m.created_time)}</div>
                  </div>
                ))}
              </div>
              <div className="inbox-replybar">
                <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply as ${client}…`}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
                <button className="push-create" disabled={busy === "send" || !reply.trim()} onClick={send}>{busy === "send" ? "Sending…" : "Send"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
