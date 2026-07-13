import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../components/Shell";
import TrendChart from "../../../components/TrendChart";
import { accountById, accountTotals, accountTrend, accountCampaigns, clientsWithGa4, insightsForClient, insightsGeneratedAt } from "../../../lib/db";
import { money, num, roas, roasClass } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function AccountDetail({ params, searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const [totals, trend, campaigns, ga4Clients, insights, insightsAt] = await Promise.all([
    accountTotals(params.id, days),
    accountTrend(params.id, days),
    accountCampaigns(params.id, days),
    clientsWithGa4(),
    insightsForClient(acct.client),
    insightsGeneratedAt(acct.client),
  ]);

  const r = roas(totals.revenue, totals.spend);
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const hasGa4 = ga4Clients.includes(acct.client);

  return (
    <Shell crumb={<><Link href={`/accounts?days=${days}`}>Accounts</Link> · <b>{acct.client}</b></>}>
      <Link className="backlink" href={`/accounts?days=${days}`}>← All accounts</Link>
      <h1>
        {acct.client}{" "}
        <span className={"pill" + (acct.platform === "google" ? " google" : "")}>{acct.platform}</span>
      </h1>
      <div className="sub">
        Account {acct.external_account_id} · last {days} days
        {hasGa4 && (
          <> · <Link className="rowlink" href={`/reconciliation?client=${encodeURIComponent(acct.client)}&days=${days}`}>View Meta↔GA4 reconciliation →</Link></>
        )}
      </div>

      <div className="cards">
        <div className="card"><div className="label">Spend</div><div className="value">{money(totals.spend)}</div></div>
        <div className="card"><div className="label">Revenue</div><div className="value">{money(totals.revenue)}</div><div className="foot">Meta-reported</div></div>
        <div className="card"><div className="label">ROAS</div><div className={"value " + roasClass(r)}>{r.toFixed(1)}x</div></div>
        <div className="card"><div className="label">Conversions</div><div className="value">{num(Math.round(totals.conversions))}</div><div className="foot">CTR {ctr.toFixed(1)}%</div></div>
      </div>

      {insights.length > 0 && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2>Smart Insights</h2>
            {insightsAt && (
              <span className="note" style={{ margin: 0 }}>
                Updated {new Date(insightsAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="note">AI-flagged opportunities and issues from monthly sales trends (month-over-month + year-over-year).</p>
          <div className="insights-grid">
            {insights.map((n, i) => (
              <div key={i} className={"insight " + n.category}>
                <div className="ihead">
                  <span className={"badge " + n.category}>{n.category}</span>
                  <span className="sev">{n.severity}</span>
                </div>
                <div className="ititle">{n.title}</div>
                {n.scope && n.scope !== "account" && <div className="iscope">{n.scope}</div>}
                <div className="idetail">{n.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Daily spend vs. revenue</h2>
        <TrendChart data={trend} />
      </div>

      <div className="panel">
        <h2>Campaigns</h2>
        <p className="note">Active campaigns in this window, by spend.</p>
        <table>
          <thead>
            <tr><th>Campaign</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Conv.</th><th>Clicks</th><th>Impr.</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={7} className="muted">No campaign activity in this window.</td></tr>
            )}
            {campaigns.map((c, i) => {
              const cr = roas(c.revenue, c.spend);
              return (
                <tr key={i}>
                  <td>{c.campaign}</td>
                  <td>{money(c.spend)}</td>
                  <td>{money(c.revenue)}</td>
                  <td className={roasClass(cr)}>{cr.toFixed(1)}x</td>
                  <td>{num(Math.round(c.conversions))}</td>
                  <td>{num(Math.round(c.clicks))}</td>
                  <td>{num(Math.round(c.impressions))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
