import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import EngageBoard from "../../../../components/EngageBoard";
import { accountById, mentionsForClient, brandSourcesForClient, brandSettings } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountEngage({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  const [mentions, sources, brand] = await Promise.all([
    mentionsForClient(acct.client_id),
    brandSourcesForClient(acct.client_id),
    brandSettings(acct.client_id),
  ]);

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Listen &amp; Create</>}>
      <h1>{acct.client} <span className="pill">listen &amp; create</span></h1>
      <div className="sub">Brand listening and content repurposing</div>

      <AccountTabs accountId={acct.id} active="engage" role={role} />

      <EngageBoard clientId={acct.client_id} client={acct.client} mentions={mentions} sources={sources} brand={brand} />
    </Shell>
  );
}
