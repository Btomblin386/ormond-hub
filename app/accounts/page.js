import Link from "next/link";
import Shell from "../../components/Shell";
import { accountsList } from "../../lib/db";
import { money, num, roas, roasClass } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function Accounts({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const accounts = await accountsList(days);

  return (
    <Shell crumb={<><b>Accounts</b></>}>
      <h1>Accounts</h1>
      <div className="sub">{accounts.length} accounts · last {days} days · click to open</div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Account</th><th>Platform</th><th>Spend</th><th>Revenue</th>
              <th>ROAS</th><th>Conv.</th><th>Clicks</th><th>Impr.</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const r = roas(a.revenue, a.spend);
              return (
                <tr key={a.id} className="clickable">
                  <td><Link className="rowlink" href={`/accounts/${a.id}?days=${days}`}>{a.client}</Link></td>
                  <td><span className={"pill" + (a.platform === "google" ? " google" : "")}>{a.platform}</span></td>
                  <td>{money(a.spend)}</td>
                  <td>{money(a.revenue)}</td>
                  <td className={roasClass(r)}>{r.toFixed(1)}x</td>
                  <td>{num(Math.round(a.conversions))}</td>
                  <td>{num(Math.round(a.clicks))}</td>
                  <td>{num(Math.round(a.impressions))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
