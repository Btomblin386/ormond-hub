"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL = { image: "Picture", video: "Video", carousel: "Carousel", reel: "Reel" };

// Create a Meta campaign two ways — duplicate an existing one (ad sets, targeting,
// budgets) or start from scratch (objective + budget + geo/age) — with a brand
// Instagram post as the creative. Everything is created PAUSED; spending requires
// an explicit "Set live" with its own confirm.
export default function CampaignLauncher({ accountExt, clientId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("dup"); // dup | fresh
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [media, setMedia] = useState([]);
  const [note, setNote] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [link, setLink] = useState("");
  const [objective, setObjective] = useState("traffic");
  const [countries, setCountries] = useState("US");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 12000); }

  async function api(body) {
    const r = await fetch("/api/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, account_ext: accountExt, client_id: clientId }) });
    return r.json();
  }

  async function openLauncher() {
    setOpen(true); setLoading(true);
    try {
      const [c, m] = await Promise.all([api({ action: "list_campaigns" }), api({ action: "list_ig_media" })]);
      if (c.error) flash("Error: " + c.error);
      setCampaigns(c.campaigns || []);
      setMedia(m.media || []);
      setNote(m.note || (m.error ? `Instagram posts unavailable: ${m.error}` : ""));
    } finally { setLoading(false); }
  }

  function pickSource(id) {
    setSourceId(id);
    const src = campaigns.find((c) => c.id === id);
    if (src && !name) {
      const d = new Date();
      setName(`${src.name.replace(/ - Copy$/i, "")} — ${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(-2)}`);
    }
  }

  async function create() {
    if (mode === "dup" && !sourceId) { flash("Pick a campaign to duplicate."); return; }
    if (mode === "fresh" && !mediaId) { flash("Pick an Instagram post — from-scratch campaigns run one as the ad."); return; }
    if (mode === "fresh" && !budget) { flash("Set a daily budget."); return; }
    setBusy("create");
    try {
      const m = media.find((x) => x.id === mediaId);
      const common = {
        name: name.trim() || undefined,
        daily_budget: budget ? Number(budget) : undefined,
        ...(link.trim() ? { link_url: link.trim() } : {}),
        ...(m ? { ig_media_id: m.id, ig_user_id: m.ig_user_id, page_id: m.page_id } : {}),
      };
      const d = mode === "dup"
        ? await api({ action: "duplicate_campaign", source_campaign_id: sourceId, ...common })
        : await api({ action: "create_full_campaign", objective, countries, age_min: ageMin || undefined, age_max: ageMax || undefined, ...common });
      if (d.error) { flash("Error: " + d.error); return; }
      setResult(d);
      router.refresh();
    } finally { setBusy(""); }
  }

  async function setLive() {
    if (!window.confirm("Set this campaign ACTIVE? It will start spending money.")) return;
    setBusy("live");
    try {
      const d = await api({ action: "update_status", target_id: result.id, target_type: "campaign", status: "ACTIVE" });
      if (d.error) flash("Error: " + d.error);
      else { setResult({ ...result, status: "ACTIVE" }); flash("Campaign is live."); }
    } finally { setBusy(""); }
  }

  async function discard() {
    if (!window.confirm("Delete this draft campaign?")) return;
    setBusy("discard");
    try {
      const d = await api({ action: "delete_campaign", target_id: result.id });
      if (d.error) flash("Error: " + d.error);
      else { setResult(null); flash("Draft deleted."); }
    } finally { setBusy(""); }
  }

  if (!open) {
    return <button className="push-create" onClick={openLauncher}>＋ New campaign</button>;
  }

  const mediaGrid = (
    <>
      {note && <div className="muted" style={{ fontSize: 13, margin: "6px 0" }}>{note}</div>}
      {media.length > 0 && (
        <div className="launcher-grid">
          {media.map((m) => (
            <button key={m.id} className={"launcher-tile" + (mediaId === m.id ? " sel" : "")} onClick={() => setMediaId(mediaId === m.id ? "" : m.id)} title={m.caption}>
              {m.thumb ? <img src={m.thumb} alt="" /> : <div className="launcher-noimg">no preview</div>}
              <span className="mtag kind launcher-kind">{KIND_LABEL[m.kind] || m.kind}</span>
              {m.caption && <span className="launcher-cap">{m.caption.slice(0, 60)}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="launcher">
      <div className="launcher-head">
        <b>New campaign</b>
        <button className="cal-x" onClick={() => { setOpen(false); setResult(null); }}>×</button>
      </div>
      {msg && <div className="mng-msg">{msg}</div>}
      {loading && <div className="muted" style={{ fontSize: 13 }}>Loading campaigns and Instagram posts…</div>}

      {!loading && !result && (
        <>
          <div className="launcher-tabs">
            <button className={"lf-btn" + (mode === "dup" ? " active" : "")} onClick={() => setMode("dup")}>Duplicate existing</button>
            <button className={"lf-btn" + (mode === "fresh" ? " active" : "")} onClick={() => setMode("fresh")}>Start from scratch</button>
          </div>

          {mode === "dup" ? (
            <>
              <p className="note" style={{ marginTop: 6 }}>Copies the campaign&apos;s ad sets — targeting, budgets, placements — and runs the Instagram post you pick as a fresh ad in each. Created <b>paused</b>.</p>
              <div className="rule-grid">
                <div>
                  <label>Duplicate from</label>
                  <select value={sourceId} onChange={(e) => pickSource(e.target.value)}>
                    <option value="">— pick a campaign —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} · {c.status}{c.daily_budget ? ` · $${c.daily_budget}/day` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>New name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="note" style={{ marginTop: 6 }}>Builds a campaign, one ad set with your targeting, and an ad from the Instagram post you pick — all <b>paused</b>.</p>
              <div className="rule-grid">
                <div>
                  <label>Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
                </div>
                <div>
                  <label>Objective</label>
                  <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                    <option value="traffic">Traffic — clicks to your site</option>
                    <option value="engagement">Engagement — reactions &amp; reach</option>
                    <option value="sales">Sales — purchases (needs pixel)</option>
                  </select>
                </div>
              </div>
              <div className="rule-grid" style={{ marginTop: 8 }}>
                <div>
                  <label>Countries</label>
                  <input type="text" value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, CA" />
                </div>
                <div>
                  <label>Age range <span className="muted" style={{ fontWeight: 400 }}>(blank = 18–65+, Advantage audience)</span></label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="number" min="18" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="18" style={{ width: 80 }} />
                    <span>–</span>
                    <input type="number" min="18" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="65" style={{ width: 80 }} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mng-cap" style={{ marginTop: 8 }}>
            <label>Daily budget</label>
            <span className="mng-dollar">$</span>
            <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={mode === "dup" ? "keep copied" : "required"} />
            <span className="mng-hint">{mode === "dup" ? "Blank keeps the copied budgets. Account cap applies." : "Ad set budget. Account cap applies."}</span>
          </div>
          <div className="mng-cap">
            <label>Destination link</label>
            <input type="url" style={{ width: 300 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://yourstore.com/collection" />
            <span className="mng-hint">Needed for Traffic/Sales ads (Reels always need one). Saved URL params are auto-appended.</span>
          </div>

          <div className="studio-h" style={{ marginTop: 12 }}>
            Instagram post to run{mode === "dup" && media.length > 0 && <span className="muted" style={{ fontWeight: 400 }}> — optional; without one, the original ads are copied when Meta allows it</span>}
          </div>
          {mediaGrid}

          <button className="push-create" style={{ marginTop: 12 }} onClick={create} disabled={busy === "create" || (mode === "dup" ? !sourceId : !mediaId)}>
            {busy === "create" ? "Creating (paused)…" : "Create paused campaign"}
          </button>
        </>
      )}

      {result && (
        <div className="launcher-result">
          <div><b>{name || "Campaign"}</b> created — <span className={"cbadge " + (result.status === "ACTIVE" ? "published" : "draft")}>{result.status === "ACTIVE" ? "LIVE" : "PAUSED"}</span></div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {result.sets_copied} ad set{result.sets_copied === 1 ? "" : "s"}{result.ads_created ? ` · ${result.ads_created} ad${result.ads_created === 1 ? "" : "s"} from the Instagram post` : ""}. It appears in the campaign structure below; performance shows after the next data sync.
          </div>
          {(result.warnings || []).length > 0 && (
            <ul className="prop-details" style={{ marginTop: 6 }}>
              {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
          <div className="mng-controls" style={{ marginTop: 10 }}>
            {result.status !== "ACTIVE" && <button className="mng-resume" disabled={busy === "live"} onClick={setLive}>{busy === "live" ? "…" : "▶ Set live"}</button>}
            {result.status !== "ACTIVE" && <button className="rule-del" disabled={busy === "discard"} onClick={discard}>Delete draft</button>}
            <button className="social-btn" onClick={() => { setResult(null); setSourceId(""); setMediaId(""); setName(""); setBudget(""); }}>Start another</button>
          </div>
        </div>
      )}
    </div>
  );
}
