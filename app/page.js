import Link from "next/link";
import Shell from "../components/Shell";
import TrendChart from "../components/TrendChart";
import { agencyTotals, spendTrend, accountsList } from "../lib/db";
import { money, num, roas, roasClass } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const [totals, trend, accounts] = await Promise.all([
    agencyTotals(days),
    spendTrend(days),
    accountsList(days),
  ]);

  const blended = roas(totals.revenue, totals.spend);

  return (
    <Shell crumb={<><b>Overview</b> · all accounts</>}>
      <h1>Overview</h1>
      <div className="sub">Agency-wide performance · last {days} days</div>

      <div className="cards">
        <div className="card"><div className="label">Spend</div><div className="value">{money(totals.spend)}</div></div>
        <div className="card"><div className="label">Revenue</div><div className="value">{money(totals.revenue)}</div></div>
        <div className="card"><div className="label">Blended ROAS</div><div className={"value " + roasClass(blended)}>{blended.toFixed(1)}x</div></div>
        <div className="card"><div className="label">Conversions</div><div className="value">{num(Math.round(totals.conversions))}</div></div>
      </div>

      <div className="panel">
        <h2>Daily spend vs. revenue</h2>
        <TrendChart data={trend} />
      </div>

      <div className="panel">
        <h2>Accounts</h2>
        <p className="note">Click an account to drill into its campaigns.</p>
        <table>
          <thead>
            <tr><th>Account</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Conv.</th><th>Clicks</th></tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const r = roas(a.revenue, a.spend);
              return (
                <tr key={a.id} className="clickable">
                  <td>
                    <Link className="rowlink" href={`/accounts/${a.id}?days=${days}`}>{a.client}</Link>{" "}
                    <span className={"pill" + (a.platform === "google" ? " google" : "")}>{a.platform}</span>
                  </td>
                  <td>{money(a.spend)}</td>
                  <td>{money(a.revenue)}</td>
                  <td className={roasClass(r)}>{r.toFixed(1)}x</td>
                  <td>{num(Math.round(a.conversions))}</td>
                  <td>{num(Math.round(a.clicks))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
