import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import NotesBoard from "../../../../components/NotesBoard";
import { accountById, notesBoard, listUsers } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountNotes({ params }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  const [groups, users] = await Promise.all([
    notesBoard(acct.client_id),
    listUsers().catch(() => []),
  ]);
  const teamMembers = [...new Set(users.filter((u) => u.active !== false).map((u) => u.name || u.email).filter(Boolean))];

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Notes</>}>
      <h1>{acct.client} <span className="pill">notes</span></h1>
      <div className="sub">Internal running notes — follow-ups, ideas, requests. Reminders surface in Notifications when due.</div>

      <AccountTabs accountId={acct.id} active="notes" role={role} />

      <div className="panel">
        <NotesBoard clientId={acct.client_id} groups={groups} teamMembers={teamMembers} />
      </div>
    </Shell>
  );
}
