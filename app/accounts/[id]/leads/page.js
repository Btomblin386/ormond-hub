import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import LeadsPanel from "../../../../components/LeadsPanel";
import { accountById, leadsForClient, brandSettings, emailEverSent } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountLeads({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  const [leads, brand, emailOk] = await Promise.all([
    leadsForClient(acct.client_id),
    brandSettings(acct.client_id).catch(() => ({})),
    emailEverSent().catch(() => false),
  ]);

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Leads</>}>
      <h1>{acct.client} <span className="pill">leads</span></h1>
      <div className="sub">Lead-form submissions from Meta ads</div>

      <AccountTabs accountId={acct.id} active="leads" role={role} />

      <LeadsPanel clientId={acct.client_id} client={acct.client} leads={leads}
        leadEmails={brand?.lead_emails || []} emailConfigured={emailOk} />
    </Shell>
  );
}
