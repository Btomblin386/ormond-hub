import { redirect } from "next/navigation";
import Shell from "../../components/Shell";
import AlertRulesManager from "../../components/AlertRulesManager";
import { getSession } from "../../lib/session";
import { listAlertRules, clientsList, alertActivity } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const s = getSession();
  if (s?.role !== "agency") redirect("/");

  const [rules, clients, activity] = await Promise.all([
    listAlertRules().catch(() => []),
    clientsList().catch(() => []),
    alertActivity().catch(() => []),
  ]);

  return (
    <Shell crumb={<b>Notifications</b>}>
      <h1>Notifications <span className="pill">email alerts</span></h1>
      <div className="sub">Pick calendars, who to notify, and when — the hub emails them automatically.</div>
      <AlertRulesManager rules={rules} clients={clients} activity={activity} />
    </Shell>
  );
}
