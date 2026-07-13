import Link from "next/link";

export default function Nav({ active }) {
  return (
    <div className="nav">
      <span className="brand">Ormond Hub</span>
      <Link className={"tab" + (active === "dashboard" ? " active" : "")} href="/">
        Dashboard
      </Link>
      <Link
        className={"tab" + (active === "reconciliation" ? " active" : "")}
        href="/reconciliation"
      >
        Reconciliation
      </Link>
      <span className="spacer" />
      <a className="logout" href="/api/logout">
        Log out
      </a>
    </div>
  );
}
