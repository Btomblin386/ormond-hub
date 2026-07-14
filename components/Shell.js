"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

export default function Shell({ crumb, children }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const days = params.get("days") || "30";
  const [accounts, setAccounts] = useState([]);
  const [acctOpen, setAcctOpen] = useState(true);

  useEffect(() => {
    fetch("/api/nav").then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {});
  }, []);

  const setDays = (d) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set("days", d);
    router.push(`${path}?${p.toString()}`);
  };
  const onAccounts = path.startsWith("/accounts");
  const activeAcct = onAccounts ? path.split("/")[2] : null;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">Ormond Hub</div>
        <nav>
          <Link href="/" className={"navlink" + (path === "/" ? " active" : "")}>Agency Overview</Link>

          <div className="navgroup">
            <button className={"navlink navgroup-head" + (onAccounts ? " active" : "")} onClick={() => setAcctOpen((o) => !o)}>
              <span>Accounts</span>
              <span className={"caret" + (acctOpen ? " open" : "")}>▾</span>
            </button>
            {acctOpen && (
              <div className="navsub">
                <Link href={`/accounts?days=${days}`} className={"navsublink" + (path === "/accounts" ? " active" : "")}>All accounts</Link>
                {accounts.map((a) => (
                  <Link key={a.id} href={`/accounts/${a.id}?days=${days}`}
                    className={"navsublink" + (activeAcct === a.id ? " active" : "")}>
                    {a.client}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/reconciliation" className={"navlink" + (path.startsWith("/reconciliation") ? " active" : "")}>Reconciliation</Link>
        </nav>
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
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
