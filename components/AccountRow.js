"use client";
import { useRouter } from "next/navigation";
import { money, num, roas, roasClass } from "../lib/format";

export default function AccountRow({ account, days }) {
  const router = useRouter();
  const r = roas(account.revenue, account.spend);
  const go = () => router.push(`/accounts/${account.id}?days=${days}`);

  async function rename(e) {
    e.stopPropagation();
    const name = window.prompt("Rename this brand (display name everywhere in the hub):", account.client);
    if (name === null) return;
    const t = name.trim();
    if (!t || t === account.client) return;
    const res = await fetch("/api/account-settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: account.id, name: t }),
    });
    const d = await res.json();
    if (d.error) window.alert("Rename failed: " + d.error);
    else window.location.reload(); // full reload so the sidebar nav (client-fetched) picks up the new name too
  }

  return (
    <tr className="clickable" onClick={go}>
      <td>
        <span className="rowlink">{account.client}</span>{" "}
        {account.platform
          ? <span className={"pill" + (account.platform === "google" ? " google" : "")}>{account.platform}</span>
          : <span className="pill content">content</span>}
        <button className="row-rename" title="Rename brand" onClick={rename}>✎</button>
      </td>
      <td>{money(account.spend)}</td>
      <td>{money(account.revenue)}</td>
      <td className={roasClass(r)}>{r.toFixed(1)}x</td>
      <td>{num(Math.round(account.conversions))}</td>
      <td>{num(Math.round(account.clicks))}</td>
      <td>{num(Math.round(account.impressions || 0))}</td>
    </tr>
  );
}
