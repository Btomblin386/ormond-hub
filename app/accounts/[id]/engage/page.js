import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import EngageBoard from "../../../../components/EngageBoard";
import PageGrowth from "../../../../components/PageGrowth";
import { accountById, mentionsForClient, brandSourcesForClient, brandSettings, pageStatsForClient, socialsForClient } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountEngage({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  const [mentions, sources, brand, stats, socials] = await Promise.all([
    mentionsForClient(acct.client_id),
    brandSourcesForClient(acct.client_id),
    brandSettings(acct.client_id),
    pageStatsForClient(acct.client_id).catch(() => []),
    socialsForClient(acct.client_id).catch(() => []),
  ]);

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Listen &amp; Create</>}>
      <h1>{acct.client} <span className="pill">listen &amp; create</span></h1>
      <div className="sub">Brand listening and content repurposing</div>

      <AccountTabs accountId={acct.id} active="engage" role={role} />

      <PageGrowth stats={stats} igUsername={socials?.[0]?.ig_username || null} />

      <EngageBoard clientId={acct.client_id} client={acct.client} mentions={mentions} sources={sources} brand={brand} />
    </Shell>
  );
}
