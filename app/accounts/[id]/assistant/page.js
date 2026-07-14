import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import AssistantPanel from "../../../../components/AssistantPanel";
import { accountById, tasksForClient } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function AccountAssistant({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const tasks = await tasksForClient(acct.client_id);

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Assistant</>}>
      <h1>{acct.client} <span className="pill">assistant</span></h1>
      <div className="sub">AI tasks &amp; reminders for this brand</div>

      <AccountTabs accountId={acct.id} active="assistant" />

      <AssistantPanel clientId={acct.client_id} client={acct.client} tasks={tasks} />
    </Shell>
  );
}
