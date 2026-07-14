import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import AccountSettings from "../../../../components/AccountSettings";
import { accountById, socialsForClient, ga4PropertyForClient, brandSettings, dropboxAccount } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const [socials, ga4, brand, dbx] = await Promise.all([
    socialsForClient(acct.client_id),
    ga4PropertyForClient(acct.client_id),
    brandSettings(acct.client_id),
    dropboxAccount().catch(() => null),
  ]);

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Settings</>}>
      <h1>{acct.client} <span className="pill">settings</span></h1>
      <div className="sub">Connections, naming, and guardrails for this brand</div>

      <AccountTabs accountId={acct.id} active="settings" />

      <AccountSettings acct={acct} socials={socials} ga4={ga4} brand={brand} dropboxEmail={dbx?.account_email || null} />
    </Shell>
  );
}
