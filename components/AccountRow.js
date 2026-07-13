"use client";
import { useRouter } from "next/navigation";
import { money, num, roas, roasClass } from "../lib/format";

export default function AccountRow({ account, days }) {
  const router = useRouter();
  const r = roas(account.revenue, account.spend);
  const go = () => router.push(`/accounts/${account.id}?days=${days}`);

  return (
    <tr className="clickable" onClick={go}>
      <td>
        <span className="rowlink">{account.client}</span>{" "}
        <span className={"pill" + (account.platform === "google" ? " google" : "")}>{account.platform}</span>
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
