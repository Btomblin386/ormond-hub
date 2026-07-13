import Shell from "../../components/Shell";
import AccountRow from "../../components/AccountRow";
import { accountsList } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function Accounts({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const accounts = await accountsList(days);

  return (
    <Shell crumb={<><b>Accounts</b></>}>
      <h1>Accounts</h1>
      <div className="sub">{accounts.length} accounts · last {days} days · click a row to open</div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Account</th><th>Spend</th><th>Revenue</th>
              <th>ROAS</th><th>Conv.</th><th>Clicks</th><th>Impr.</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} days={days} />
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
