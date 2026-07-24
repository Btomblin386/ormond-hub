import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import ClientDashboard from "../../../../components/ClientDashboard";
import { accountById, ensureDefaultDashboard, dashboardRaw } from "../../../../lib/db";
import { computeSections, rawSpan } from "../../../../lib/metrics";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 60, 90];

export default async function AccountDashboard({ params, searchParams }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";
  const canEdit = role === "agency" || role === "manager";

  const days = RANGES.includes(Number(searchParams?.days)) ? Number(searchParams.days) : 30;
  const dash = await ensureDefaultDashboard(acct.client_id);
  const raw = await dashboardRaw(acct.client_id, rawSpan(dash.widgets, days));
  const sections = computeSections(dash.widgets, raw, days);

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Dashboard</>}>
      <h1>{acct.client} <span className="pill">dashboard</span></h1>
      <div className="sub">Live analytics across every connected channel — compared with the previous period.</div>

      <AccountTabs accountId={acct.id} active="dashboard" role={role} />

      <ClientDashboard accountId={acct.id} clientId={acct.client_id} dashboardId={dash.id} sections={sections} days={days} ranges={RANGES} canEdit={canEdit} />
    </Shell>
  );
}
