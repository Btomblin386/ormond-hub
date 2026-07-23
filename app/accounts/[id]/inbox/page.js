import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import InboxPanel from "../../../../components/InboxPanel";
import { accountById } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountInbox({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Inbox</>}>
      <h1>{acct.client} <span className="pill">inbox</span></h1>
      <div className="sub">Messenger &amp; Instagram DMs</div>

      <AccountTabs accountId={acct.id} active="inbox" role={role} />

      <InboxPanel clientId={acct.client_id} client={acct.client} />
    </Shell>
  );
}
