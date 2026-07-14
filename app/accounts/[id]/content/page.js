import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import ContentMarketing from "../../../../components/ContentMarketing";
import { accountById, contentForClient, socialForClient, mentionsForClient, brandSourcesForClient, brandSettings } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function AccountContent({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const [items, social, mentions, sources, brand] = await Promise.all([
    contentForClient(acct.client_id),
    socialForClient(acct.client_id),
    mentionsForClient(acct.client_id),
    brandSourcesForClient(acct.client_id),
    brandSettings(acct.client_id),
  ]);

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Content Marketing</>}>
      <h1>{acct.client} <span className="pill">content</span></h1>
      <div className="sub">Content Marketing — posts, calendar, brand listening, and repurposing</div>

      <AccountTabs accountId={acct.id} active="content" />

      <ContentMarketing
        clientId={acct.client_id}
        client={acct.client}
        items={items}
        social={social}
        mentions={mentions}
        sources={sources}
        brand={brand}
      />
    </Shell>
  );
}
