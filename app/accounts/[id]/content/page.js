import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import ContentBoard from "../../../../components/ContentBoard";
import { accountById, contentForClient, socialsForClient, tasksForClient, listUsers, brandSettings, dropboxAccount } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function AccountContent({ params, searchParams }) {
  const acct = await accountById(params.id);
  if (!acct) notFound();
  const role = getSession()?.role || "agency";

  const [items, socials, tasks, users, brand, dbx] = await Promise.all([
    contentForClient(acct.client_id),
    socialsForClient(acct.client_id),
    tasksForClient(acct.client_id),
    listUsers().catch(() => []),
    brandSettings(acct.client_id).catch(() => ({})),
    dropboxAccount().catch(() => null),
  ]);
  const notes = tasks.filter((t) => t.kind === "reminder" && t.status === "pending" && t.due_at);
  const teamMembers = [...new Set(users.filter((u) => u.active !== false).map((u) => u.name || u.email).filter(Boolean))];

  return (
    <Shell wide crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Content</>}>
      <h1>{acct.client} <span className="pill">content</span></h1>
      <div className="sub">Posts &amp; calendar</div>

      <AccountTabs accountId={acct.id} active="content" role={role} />

      <ContentBoard clientId={acct.client_id} client={acct.client} items={items} socials={socials} editId={searchParams?.edit || null} notes={notes} teamMembers={teamMembers}
        dropbox={!!dbx} dropboxFolder={brand?.dropbox_folder || ""} brandLogo={brand?.logo_url || null} />
    </Shell>
  );
}
