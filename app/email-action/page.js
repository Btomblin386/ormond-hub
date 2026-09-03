// Landing page for action links inside alert emails (e.g. one-click Approve).
// The signed token is verified — and the action performed — by the
// content-alerts edge function; this page just asks it what happened and shows
// a human answer. It lives here because *.supabase.co rewrites text/html
// responses to text/plain (anti-phishing), so functions can't render pages.
export const dynamic = "force-dynamic";

const FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/content-alerts";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

function Card({ icon, title, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 460, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 32, textAlign: "center", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
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
  let d = { result: "expired" };
  if (t) {
    try {
      const r = await fetch(FN, {
        method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_token", t }),
      });
      d = await r.json();
    } catch { d = { result: "error" }; }
  }

  const review = d.reviewUrl ? <><br /><br /><A href={d.reviewUrl}>Open it in Ormond Hub</A></> : null;

  if (d.result === "approved")
    return <Card icon="✅" title="Approved ✓">The {d.client} post is approved and will publish {d.when}.{review}</Card>;
  if (d.result === "already_approved")
    return <Card icon="✅" title="Already approved">Someone beat you to it — this {d.client} post is approved and will publish {d.when || "shortly"}.{review}</Card>;
  if (d.result === "already_published")
    return <Card icon="✅" title={d.publishing ? "Publishing now" : "Already published"}>{`This ${d.client} post ${d.publishing ? "is publishing right now" : "has already been published"}. Nothing else to do.`}{review}</Card>;
  if (d.result === "not_found")
    return <Card icon="⚠️" title="Post not found">It may have been deleted.</Card>;
  if (d.result === "error")
    return <Card icon="⚠️" title="Something went wrong">{d.error || "Please try again in a minute."}</Card>;
  return <Card icon="⚠️" title="This link has expired">Approve links work once and expire after a while for safety. <A href="/">Open Ormond Hub</A> and approve the post there.</Card>;
}
