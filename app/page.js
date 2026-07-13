import Nav from "../components/Nav";
import TrendChart from "../components/TrendChart";
import { accountRollup, spendTrend } from "../lib/db";

export const dynamic = "force-dynamic";

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString();
const roasClass = (r) => (r >= 4 ? "roas-good" : r >= 1.5 ? "roas-mid" : "roas-low");

export default async function Dashboard({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const [rows, trend] = await Promise.all([accountRollup(days), spendTrend(days)]);

  const withRoas = rows.map((r) => ({ ...r, roas: r.spend > 0 ? r.revenue / r.spend : 0 }));
  const totalSpend = withRoas.reduce((a, r) => a + r.spend, 0);
  const totalRev = withRoas.reduce((a, r) => a + r.revenue, 0);
  const totalConv = withRoas.reduce((a, r) => a + r.conversions, 0);
  const blended = totalSpend > 0 ? totalRev / totalSpend : 0;

  return (
    <>
      <Nav active="dashboard" />
      <div className="wrap">
        <header className="page">
          <h1>Ad Dashboard</h1>
          <div className="rangebar">
            {[7, 30, 90].map((d) => (
              <a key={d} href={`/?days=${d}`} className={d === days ? "active" : ""}>{d}d</a>
            ))}
          </div>
        </header>
        <div className="sub">Live from Meta · {withRoas.length} accounts · last {days} days</div>

        <div className="cards">
          <div className="card"><div className="label">Spend</div><div className="value">{money(totalSpend)}</div></div>
          <div className="card"><div className="label">Revenue</div><div className="value">{money(totalRev)}</div></div>
          <div className="card"><div className="label">Blended ROAS</div><div className={"value " + roasClass(blended)}>{blended.toFixed(1)}x</div></div>
          <div className="card"><div className="label">Conversions</div><div className="value">{num(Math.round(totalConv))}</div></div>
        </div>

        <div className="panel">
          <h2>Daily spend vs. revenue</h2>
          <TrendChart data={trend} />
        </div>

        <div className="panel">
          <h2>By account</h2>
          <table>
            <thead>
              <tr><th>Account</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Conv.</th><th>Clicks</th></tr>
            </thead>
            <tbody>
              {withRoas.map((r, i) => (
                <tr key={i}>
                  <td>{r.client} <span className="pill">{r.platform}</span></td>
                  <td>{money(r.spend)}</td>
                  <td>{money(r.revenue)}</td>
                  <td className={roasClass(r.roas)}>{r.roas.toFixed(1)}x</td>
                  <td>{num(Math.round(r.conversions))}</td>
                  <td>{num(Math.round(r.clicks))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
