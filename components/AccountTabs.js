import Link from "next/link";

export default function AccountTabs({ accountId, active, days = 30 }) {
  return (
    <div className="acct-tabs">
      <Link href={`/accounts/${accountId}?days=${days}`} className={"acct-tab" + (active === "paid" ? " active" : "")}>
        Paid Marketing
      </Link>
      <Link href={`/accounts/${accountId}/content`} className={"acct-tab" + (active === "content" ? " active" : "")}>
        Content Marketing
      </Link>
    </div>
  );
}
