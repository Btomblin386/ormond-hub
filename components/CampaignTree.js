"use client";
import { useEffect, useState } from "react";

const KIND_LABEL = { image: "Picture", video: "Video", carousel: "Carousel", reel: "Reel" };
const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function StatusChip({ s }) {
  const label = s === "CAMPAIGN_PAUSED" ? "PAUSED ↑" : s === "ADSET_PAUSED" ? "PAUSED ↑" : s === "IN_PROCESS" ? "PROCESSING" : s;
  const cls = s === "ACTIVE" ? "published" : s === "IN_PROCESS" ? "publishing" : "draft";
  return <span className={"cbadge " + cls} title={s.includes("_PAUSED") ? "Paused because a parent is paused" : ""}>{label}</span>;
}

// Live campaign → ad set → ad browser with per-level controls, straight from Meta.
export default function CampaignTree({ accountExt, clientId }) {
  const [tree, setTree] = useState(null);
  const [err, setErr] = useState("");
  const [openCamps, setOpenCamps] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [budgets, setBudgets] = useState({});
  const [swapFor, setSwapFor] = useState(null); // ad id
  const [media, setMedia] = useState(null);
  const [mediaNote, setMediaNote] = useState("");
  const [swapMedia, setSwapMedia] = useState("");
  const [swapLink, setSwapLink] = useState("");

  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 9000); }

  async function api(body) {
    const r = await fetch("/api/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, account_ext: accountExt, client_id: clientId }) });
    return r.json();
  }
  async function load() {
    setErr("");
    const d = await api({ action: "list_tree" });
    if (d.error) setErr(d.error); else setTree(d.tree || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function act(body, confirmText, busyKey) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(busyKey);
    try {
      const d = await api(body);
      if (d.error) flash("Error: " + d.error);
      await load();
    } finally { setBusy(""); }
  }

  async function openSwap(adId) {
    setSwapFor(adId); setSwapMedia(""); setSwapLink("");
    if (!media) {
      const m = await api({ action: "list_ig_media" });
      setMedia(m.media || []);
      setMediaNote(m.note || (m.error ? `Instagram posts unavailable: ${m.error}` : ""));
    }
  }
  async function doSwap() {
    const m = (media || []).find((x) => x.id === swapMedia);
    if (!m) { flash("Pick a post first."); return; }
    setBusy("swap" + swapFor);
    try {
      const d = await api({ action: "swap_ad_creative", ad_id: swapFor, ig_media_id: m.id, ig_user_id: m.ig_user_id, page_id: m.page_id, ...(swapLink.trim() ? { link_url: swapLink.trim() } : {}) });
      if (d.error) flash("Error: " + d.error);
      else { flash("Creative swapped."); setSwapFor(null); await load(); }
    } finally { setBusy(""); }
  }

  const toggleBtns = (id, type, status, name) => (
    <span className="ctree-controls">
      {status === "ACTIVE"
        ? <button className="mng-pause" disabled={busy === id + "p"} onClick={() => act({ action: "update_status", target_id: id, target_type: type, status: "PAUSED" }, `Pause ${type} "${name}"?`, id + "p")}>Pause</button>
        : <button className="mng-resume" disabled={busy === id + "r"} onClick={() => act({ action: "update_status", target_id: id, target_type: type, status: "ACTIVE" }, `Set ${type} "${name}" ACTIVE? This can spend money.`, id + "r")}>Resume</button>}
      <button className="rule-del" disabled={busy === id + "d"} onClick={() => act({ action: "delete_campaign", target_id: id, target_type: type }, `Delete ${type} "${name}"? This can't be undone in Meta.`, id + "d")}>Delete</button>
    </span>
  );

  const budgetCtl = (id, type, current) => (
    <span className="ctree-budget">
      <span className="muted" style={{ fontSize: 12 }}>{current != null ? `${money(current)}/day` : ""}</span>
      <input type="number" min="1" placeholder="$" value={budgets[id] ?? ""} onChange={(e) => setBudgets({ ...budgets, [id]: e.target.value })} />
      <button className="social-btn" disabled={!budgets[id] || busy === id + "b"}
        onClick={() => act({ action: "update_budget", target_id: id, target_type: type, daily_budget: budgets[id] }, `Set ${money(budgets[id])}/day?`, id + "b")}>Set</button>
    </span>
  );

  if (err) return <div className="push-err" style={{ marginTop: 8 }}>{err}</div>;
  if (!tree) return <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Loading live campaign structure…</div>;
  if (!tree.length) return <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>No campaigns in this ad account yet — create one above.</div>;

  return (
    <div className="ctree">
      {msg && <div className="mng-msg">{msg}</div>}
      {tree.map((c) => (
        <div key={c.id} className="ctree-camp">
          <div className="ctree-row camp">
            <button className="ctree-chev" onClick={() => setOpenCamps({ ...openCamps, [c.id]: !openCamps[c.id] })}>{openCamps[c.id] ? "▾" : "▸"}</button>
            <StatusChip s={c.status} />
            <span className="ctree-name">{c.name}</span>
            <span className="muted ctree-meta">{String(c.objective || "").replace("OUTCOME_", "").toLowerCase()} · {c.adsets.length} ad set{c.adsets.length === 1 ? "" : "s"}</span>
            {budgetCtl(c.id, "campaign", c.daily_budget)}
            {toggleBtns(c.id, "campaign", c.status, c.name)}
          </div>
          {openCamps[c.id] && c.adsets.map((s) => (
            <div key={s.id}>
              <div className="ctree-row set">
                <StatusChip s={s.status} />
                <span className="ctree-name">{s.name}</span>
                {budgetCtl(s.id, "adset", s.daily_budget)}
                {toggleBtns(s.id, "adset", s.status, s.name)}
              </div>
              {s.ads.map((a) => (
                <div key={a.id}>
                  <div className="ctree-row ad">
                    {a.thumb ? <img className="ctree-thumb" src={a.thumb} alt="" /> : <span className="ctree-thumb none" />}
                    <StatusChip s={a.status} />
                    <span className="ctree-name">{a.ig_permalink ? <a href={a.ig_permalink} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</span>
                    <button className="social-btn" onClick={() => (swapFor === a.id ? setSwapFor(null) : openSwap(a.id))}>{swapFor === a.id ? "Cancel swap" : "Swap creative"}</button>
                    {toggleBtns(a.id, "ad", a.status, a.name)}
                  </div>
                  {swapFor === a.id && (
                    <div className="ctree-swap">
                      {mediaNote && <div className="muted" style={{ fontSize: 13 }}>{mediaNote}</div>}
                      {!media && !mediaNote && <div className="muted" style={{ fontSize: 13 }}>Loading Instagram posts…</div>}
                      {media && media.length > 0 && (
                        <>
                          <div className="launcher-grid">
                            {media.map((m) => (
                              <button key={m.id} className={"launcher-tile" + (swapMedia === m.id ? " sel" : "")} onClick={() => setSwapMedia(swapMedia === m.id ? "" : m.id)} title={m.caption}>
                                {m.thumb ? <img src={m.thumb} alt="" /> : <div className="launcher-noimg">no preview</div>}
                                <span className="mtag kind launcher-kind">{KIND_LABEL[m.kind] || m.kind}</span>
                              </button>
                            ))}
                          </div>
                          <div className="set-row" style={{ marginTop: 8 }}>
                            <input type="url" value={swapLink} onChange={(e) => setSwapLink(e.target.value)} placeholder="Destination link (needed for traffic/sales ads, e.g. https://…)" style={{ flex: 2 }} />
                            <button className="push-create" disabled={!swapMedia || busy === "swap" + a.id} onClick={doSwap}>{busy === "swap" + a.id ? "Swapping…" : "Swap creative"}</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
