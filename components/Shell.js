"use client";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/reconciliation", label: "Reconciliation" },
];

export default function Shell({ crumb, children }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const days = params.get("days") || "30";

  const setDays = (d) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set("days", d);
    router.push(`${path}?${p.toString()}`);
  };
  const isActive = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">Ormond Hub</div>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={"navlink" + (isActive(n.href) ? " active" : "")}>
              {n.label}
            </Link>
          ))}
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
