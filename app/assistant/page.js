import { notFound } from "next/navigation";
import Shell from "../../components/Shell";
import AssistantPanel from "../../components/AssistantPanel";
import { getSession } from "../../lib/session";
import { agencyTasks } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function AgencyAssistant() {
  const s = getSession();
  if (s?.role !== "agency") notFound();

  const tasks = await agencyTasks();

  return (
    <Shell crumb={<><b>Assistant</b> · agency-wide</>}>
      <h1>Agency Assistant</h1>
      <div className="sub">Tasks that span every brand — it knows the full roster and files drafts &amp; reminders per brand</div>

      <AssistantPanel clientId={null} client="the agency" tasks={tasks} agency />
    </Shell>
  );
}
