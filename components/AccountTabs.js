import Link from "next/link";

export default function AccountTabs({ accountId, active, days = 30, role = "agency" }) {
  return (
    <div className="acct-tabs">
      {role === "agency" && (
        <Link href={`/accounts/${accountId}?days=${days}`} className={"acct-tab" + (active === "paid" ? " active" : "")}>
          Paid Marketing
        </Link>
      )}
      <Link href={`/accounts/${accountId}/content`} className={"acct-tab" + (active === "content" ? " active" : "")}>
        Content
      </Link>
      {role !== "client" && (
        <Link href={`/accounts/${accountId}/engage`} className={"acct-tab" + (active === "engage" ? " active" : "")}>
          Listen &amp; Create
        </Link>
      )}
    </div>
  );
}
