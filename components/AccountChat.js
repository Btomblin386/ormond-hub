"use client";
import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = [
  "What changes would you recommend to improve performance?",
  "Add a URL parameter to the Facebook campaign to improve GA4 source matching.",
  "Which products should I be advertising right now, and to whom?",
  "Is the Products campaign actually driving incremental sales?",
];

const ALLOWED_ACTIONS = ["update_status", "update_budget", "create_campaign", "set_url_params"];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderLite(text) {
  let h = escapeHtml(text);
  h = h.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.trim()}</pre>`);
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\n/g, "<br>");
  return h;
}

// Pull a ```proposal {json} ``` fence out of the reply; the prose stays in the bubble.
function extractProposal(reply) {
  const m = reply.match(/```proposal\s*([\s\S]*?)```/);
  if (!m) return { text: reply, proposal: null };
  const text = reply.replace(m[0], "").trim();
  try {
    const p = JSON.parse(m[1]);
    if (!ALLOWED_ACTIONS.includes(p.action)) return { text: reply, proposal: null };
    return { text, proposal: p };
  } catch {
    return { text: reply, proposal: null };
  }
}

function proposalDetails(p) {
  if (p.action === "update_status") return [`Campaign ${p.target_id}`, `Set ${String(p.status || "").toUpperCase()}`];
  if (p.action === "update_budget") return [`Campaign ${p.target_id}`, `Daily budget → $${p.daily_budget} (account cap enforced)`];
  if (p.action === "create_campaign") return [`New campaign "${p.name}"`, `Objective: ${p.objective || "sales"} · created PAUSED`];
  if (p.action === "set_url_params") return ["Default URL params for new ads", p.params || ""];
  return [];
}

function ProposalCard({ proposal, applied, busy, onConfirm, onDismiss }) {
  return (
    <div className="chat-proposal">
      <div className="prop-head">
        <span className="prop-flag">Proposed change</span>
        <span className="prop-label">{proposal.label || proposal.action}</span>
      </div>
      <ul className="prop-details">
        {proposalDetails(proposal).map((d, i) => <li key={i}>{d}</li>)}
      </ul>
      {applied ? (
        <div className={"prop-done " + (applied === "ok" ? "ok" : "err")}>{applied === "ok" ? "✓ Applied — logged to the change log." : applied}</div>
      ) : (
        <div className="prop-actions">
          <button className="cal-approve" disabled={busy} onClick={onConfirm}>{busy ? "Applying…" : "Confirm & apply"}</button>
          <button className="cal-reject" disabled={busy} onClick={onDismiss}>Not now</button>
        </div>
      )}
      <div className="prop-note">Nothing runs without this confirmation. Budget caps + audit log apply.</div>
    </div>
  );
}

export default function AccountChat({ client, accountExt, accountId, clientId, initialMessages }) {
  // History is stored per client and reloaded on every visit, so the thread
  // survives navigating to other tabs. Proposal cards are re-extracted from the
  // stored assistant replies.
  const [messages, setMessages] = useState(() =>
    (initialMessages || []).map((m) => {
      if (m.role !== "assistant") return { role: m.role, content: m.content };
      const { text, proposal } = extractProposal(m.content);
      return { role: "assistant", content: text || m.content, proposal, applied: null };
    })
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, clientId, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await resp.json();
      const reply = data.reply || (data.error ? `Error: ${data.error}` : "No response.");
      const { text: prose, proposal } = extractProposal(reply);
      setMessages([...next, { role: "assistant", content: prose || reply, proposal, applied: null }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  }

  function setApplied(idx, val) {
    setMessages((ms) => ms.map((m, i) => (i === idx ? { ...m, applied: val } : m)));
  }

  async function confirmProposal(idx) {
    const p = messages[idx]?.proposal;
    if (!p || applyBusy) return;
    setApplyBusy(true);
    try {
      let resp;
      if (p.action === "set_url_params") {
        if (!accountId) throw new Error("No ad account connected for this brand.");
        resp = await fetch("/api/account-settings", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, urlParams: p.params || "" }),
        });
      } else {
        if (!accountExt) throw new Error("No ad account connected for this brand.");
        const payload = { action: p.action, account_ext: accountExt, source: "chat" };
        if (p.action === "update_status") Object.assign(payload, { target_type: p.target_type || "campaign", target_id: p.target_id, status: p.status });
        if (p.action === "update_budget") Object.assign(payload, { target_type: p.target_type || "campaign", target_id: p.target_id, daily_budget: p.daily_budget });
        if (p.action === "create_campaign") Object.assign(payload, { name: p.name, objective: p.objective });
        resp = await fetch("/api/manage", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const d = await resp.json();
      if (d.error) setApplied(idx, "✗ " + d.error);
      else setApplied(idx, "ok");
    } catch (e) {
      setApplied(idx, "✗ " + String(e.message || e));
    } finally {
      setApplyBusy(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear this account's chat history?")) return;
    await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "clear", clientId }) });
    setMessages([]);
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2>Ask about this account</h2>
        {messages.length > 0 && <button className="social-btn" onClick={clearHistory}>Clear chat</button>}
      </div>
      <p className="note">Answers use this account&apos;s live data — including day-by-day GA4 traffic and source/medium breakdowns. The conversation is saved with the account, so it&apos;s still here after you visit other tabs. The assistant can also propose changes — pause/resume a campaign, set a budget, draft a paused campaign, set URL params — which run only after you confirm.</p>

      <div className="chat-log" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-suggest">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"chat-msg " + m.role}>
            <div className="bubble">
              <span dangerouslySetInnerHTML={{ __html: renderLite(m.content) }} />
              {m.proposal && (
                <ProposalCard proposal={m.proposal} applied={m.applied} busy={applyBusy}
                  onConfirm={() => confirmProposal(i)} onDismiss={() => setApplied(i, "Dismissed.")} />
              )}
            </div>
          </div>
        ))}
        {loading && <div className="chat-msg assistant"><div className="bubble muted">Thinking…</div></div>}
      </div>

      <div className="chat-input">
        <textarea
          rows={2}
          value={input}
          placeholder="Ask a question, or tell it what to change…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}
