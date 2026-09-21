// Landing page for action links inside alert emails (the Approve button).
//
// LOADING THIS PAGE MUST NEVER CHANGE ANYTHING. Mail security scanners
// (Proofpoint, Safe Links) open every link in an email within seconds of
// delivery — when this page approved on load, the scanner approved every
// alerted post before a human saw the email. So the page only *peeks* at the
// token (read-only) and shows the post with an Approve button; the approval
// itself happens in ./approve/route.js, reachable only by that button's POST.
//
// It lives in the app because *.supabase.co rewrites text/html responses to
// text/plain (anti-phishing), so edge functions can't render pages.
import { FN, ANON } from "./fn";

export const dynamic = "force-dynamic";

function Card({ icon, title, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 460, width: "100%", boxSizing: "border-box", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 32, textAlign: "center", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#111827" }}>{title}</h2>
        <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

const A = ({ href, children }) => <a href={href} style={{ color: "#4f46e5" }}>{children}</a>;

export default async function EmailAction({ searchParams }) {
  const t = searchParams?.t || "";
  const justApproved = searchParams?.r === "approved"; // set by ./approve after the button's POST
  let d = { result: "expired" };
  if (t) {
    try {
      const r = await fetch(FN, {
        method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "peek_token", t }),
      });
      d = await r.json();
    } catch { d = { result: "error" }; }
  }
  const retry = searchParams?.r === "error"; // the button's POST failed — let them press it again

  const review = d.reviewUrl ? <><br /><br /><A href={d.reviewUrl}>Open it in Ormond Hub</A></> : null;

  if (d.result === "pending")
    return (
      <Card icon="📝" title={`Approve this ${d.client} post?`}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", background: "#f9fafb", textAlign: "left", margin: "14px 0 18px" }}>
          <div style={{ color: "#6b7280", fontSize: 12.5, marginBottom: 8 }}>
            {[d.channels, d.postType, d.whenAbs || "no date", d.status].filter(Boolean).join(" · ")}
          </div>
          {d.thumb && <img src={d.thumb} alt="" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, display: "block", marginBottom: 8 }} />}
          <div style={{ whiteSpace: "pre-wrap", color: "#111827", overflowWrap: "anywhere" }}>{d.caption || "(no caption)"}{d.captionCut ? "…" : ""}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          {d.overdue
            ? <span style={{ color: "#b45309" }}>Its scheduled time passed {d.when} — approving publishes it within a few minutes.</span>
            : d.when ? <>Approving schedules it to publish <b>{d.when}</b>.</> : <>Approving publishes it within a few minutes.</>}
        </div>
        {retry && <div style={{ color: "#b91c1c", marginBottom: 12 }}>That didn&apos;t go through — please try again.</div>}
        <form method="POST" action="/email-action/approve" style={{ margin: 0 }}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" style={{ display: "block", width: "100%", background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 15, padding: "12px 22px", border: 0, borderRadius: 9, cursor: "pointer" }}>✓ Approve this post</button>
        </form>
        <div style={{ marginTop: 14 }}><A href={d.reviewUrl}>Review or edit it in Ormond Hub instead</A></div>
      </Card>
    );
  if (d.result === "already_approved" && justApproved)
    return <Card icon="✅" title="Approved ✓">The {d.client} post is approved and will publish {d.when || "within the next few minutes"}.{review}</Card>;
  if (d.result === "already_approved")
    return <Card icon="✅" title="Already approved">This {d.client} post is already approved and will publish {d.when || "shortly"}.{review}</Card>;
  if (d.result === "already_published")
    return <Card icon="✅" title={d.publishing ? "Publishing now" : "Already published"}>{`This ${d.client} post ${d.publishing ? "is publishing right now" : "has already been published"}. Nothing else to do.`}{review}</Card>;
  if (d.result === "not_found")
    return <Card icon="⚠️" title="Post not found">It may have been deleted.</Card>;
  if (d.result === "error")
    return <Card icon="⚠️" title="Something went wrong">{d.error || "Please try again in a minute."}</Card>;
  return <Card icon="⚠️" title="This link has expired">Approve links expire after a week for safety. <A href="/">Open Ormond Hub</A> and approve the post there.</Card>;
}
