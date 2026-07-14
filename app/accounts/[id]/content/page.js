import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import ContentBoard from "../../../../components/ContentBoard";
import { accountById, contentForClient, socialForClient } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function AccountContent({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const [items, social] = await Promise.all([
    contentForClient(acct.client_id),
    socialForClient(acct.client_id),
  ]);

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Content</>}>
      <h1>{acct.client} <span className="pill">content</span></h1>
      <div className="sub">Posts &amp; calendar</div>

      <AccountTabs accountId={acct.id} active="content" />

      <ContentBoard clientId={acct.client_id} client={acct.client} items={items} social={social} />
    </Shell>
  );
}
