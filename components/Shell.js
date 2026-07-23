"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const PAID_SECTIONS = [
  { hash: "performance", label: "Performance" },
  { hash: "insights", label: "Smart Insights" },
  { hash: "studio", label: "Campaign Studio" },
  { hash: "campaigns", label: "Campaigns" },
  { hash: "ads", label: "Ads Manager" },
  { hash: "rules", label: "Automated Rules" },
  { hash: "leads", label: "Leads" },
];
const CONTENT_SECTIONS = [
  { hash: "posts", label: "Posts" },
  { hash: "calendar", label: "Calendar" },
];
const ENGAGE_SECTIONS = [
  { hash: "listener", label: "Brand Listener" },
  { hash: "repurpose", label: "Repurpose Studio" },
];

export default function Shell({ crumb, children, wide }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const days = params.get("days") || "30";
  const [accounts, setAccounts] = useState([]);
  const [acctOpen, setAcctOpen] = useState(true);
  const [role, setRole] = useState("agency");

  useEffect(() => {
    fetch("/api/nav").then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {});
    fetch("/api/me").then((r) => r.json()).then((d) => setRole(d.role || "agency")).catch(() => {});
  }, []);
  const isAgency = role === "agency";
  const isManager = role === "manager";
  const isClient = role === "client";

  const setDays = (d) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set("days", d);
    router.push(`${path}?${p.toString()}`);
  };

  // Are we inside a specific account?
  const parts = path.split("/");
  const inAccount = parts[1] === "accounts" && parts[2];
  const acctId = inAccount ? parts[2] : null;
  const onContent = inAccount && parts[3] === "content";
  const onEngage = inAccount && parts[3] === "engage";
  const onPaid = inAccount && !parts[3];
  const acctName = accounts.find((a) => a.id === acctId)?.client || "Account";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">Ormond Hub</div>

        {inAccount ? (
          <nav>
            <Link href="/" className="navlink subtle">← Agency Overview</Link>
            <div className="acct-name">{acctName}</div>

            {isAgency && (
              <div className="navgroup">
                <Link href={`/accounts/${acctId}?days=${days}`} className={"navlink navgroup-title" + (onPaid ? " active" : "")}>
                  Paid Marketing
                </Link>
                {onPaid && (
                  <div className="navsub">
                    {PAID_SECTIONS.map((s) => (
                      <Link key={s.hash} href={`/accounts/${acctId}?days=${days}#${s.hash}`} className="navsublink">{s.label}</Link>
                    ))}
                    <Link href={`/accounts/${acctId}/google?days=${days}`} className="navsublink">Google · GA4</Link>
                  </div>
                )}
              </div>
            )}

            <div className="navgroup">
              <Link href={`/accounts/${acctId}/content`} className={"navlink navgroup-title" + (onContent ? " active" : "")}>
                Content
              </Link>
              {onContent && (
                <div className="navsub">
                  {CONTENT_SECTIONS.map((s) => (
                    <Link key={s.hash} href={`/accounts/${acctId}/content#${s.hash}`} className="navsublink">{s.label}</Link>
                  ))}
                </div>
              )}
            </div>

            {!isClient && (
              <div className="navgroup">
                <Link href={`/accounts/${acctId}/engage`} className={"navlink navgroup-title" + (onEngage ? " active" : "")}>
                  Listen &amp; Create
                </Link>
                {onEngage && (
                  <div className="navsub">
                    {ENGAGE_SECTIONS.map((s) => (
                      <Link key={s.hash} href={`/accounts/${acctId}/engage#${s.hash}`} className="navsublink">{s.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        ) : (
          <nav>
            {(isAgency || isManager) && <Link href="/" className={"navlink" + (path === "/" ? " active" : "")}>Agency Overview</Link>}
            <div className="navgroup">
              <button className={"navlink navgroup-head" + (path.startsWith("/accounts") ? " active" : "")} onClick={() => setAcctOpen((o) => !o)}>
                <span>Accounts</span>
                <span className={"caret" + (acctOpen ? " open" : "")}>▾</span>
              </button>
              {acctOpen && (
                <div className="navsub">
                  <Link href={`/accounts?days=${days}`} className={"navsublink" + (path === "/accounts" ? " active" : "")}>All accounts</Link>
                  {accounts.map((a) => (
                    <Link key={a.id} href={`/accounts/${a.id}?days=${days}`} className="navsublink">{a.client}</Link>
                  ))}
                </div>
              )}
            </div>
            {/* Reconciliation moved into each account's Google tab; route kept for deep links */}
            {isAgency && <Link href="/onboard" className={"navlink" + (path.startsWith("/onboard") ? " active" : "")}>+ Connect accounts</Link>}
            {isAgency && <Link href="/assistant" className={"navlink" + (path.startsWith("/assistant") ? " active" : "")}>Assistant</Link>}
            {isAgency && <Link href="/settings" className={"navlink" + (path.startsWith("/settings") || path.startsWith("/team") ? " active" : "")}>Settings</Link>}
          </nav>
        )}

        <div className="bottom">
          <a className="navlink logout" href="/api/logout">Log out</a>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="crumb">{crumb}</div>
          <div className="range">
            {["7", "30", "90"].map((d) => (
              <button key={d} className={days === d ? "active" : ""} onClick={() => setDays(d)}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className={"content" + (wide ? " wide" : "")}>{children}</div>
      </main>
    </div>
  );
}
