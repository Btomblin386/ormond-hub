"use client";
import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = [
  "What changes would you recommend to improve performance?",
  "Add a URL parameter to the Facebook campaign to improve GA4 source matching.",
  "Which products should I be advertising right now, and to whom?",
  "Is the Products campaign actually driving incremental sales?",
];

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

export default function AccountChat({ client }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
        body: JSON.stringify({ client, messages: next }),
      });
      const data = await resp.json();
      const reply = data.reply || (data.error ? `Error: ${data.error}` : "No response.");
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Ask about this account</h2>
      <p className="note">Answers use this account&apos;s live data — metrics, campaigns, insights, reconciliation, and seasonality.</p>

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
            <div className="bubble" dangerouslySetInnerHTML={{ __html: renderLite(m.content) }} />
          </div>
        ))}
        {loading && <div className="chat-msg assistant"><div className="bubble muted">Thinking…</div></div>}
      </div>

      <div className="chat-input">
        <textarea
          rows={2}
          value={input}
          placeholder="Ask a question about this account…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}
