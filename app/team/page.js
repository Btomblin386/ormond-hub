import { notFound } from "next/navigation";
import Shell from "../../components/Shell";
import TeamManager from "../../components/TeamManager";
import { getSession } from "../../lib/session";
import { listUsers, clientsList } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const s = getSession();
  if (s?.role !== "agency") notFound();

  const [users, clients] = await Promise.all([listUsers(), clientsList()]);

  return (
    <Shell crumb={<><b>Team</b> · users &amp; roles</>}>
      <h1>Team &amp; access</h1>
      <div className="sub">Create logins and set what each person can see.</div>
      <TeamManager users={users} clients={clients} />
    </Shell>
  );
}
