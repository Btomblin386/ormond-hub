import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../components/Shell";
import TrendChart from "../../../components/TrendChart";
import SeasonalityChart from "../../../components/SeasonalityChart";
import InsightCard from "../../../components/InsightCard";
import PinnedItem from "../../../components/PinnedItem";
import AccountChat from "../../../components/AccountChat";
import CampaignStudio from "../../../components/CampaignStudio";
import AdsManager from "../../../components/AdsManager";
import { accountById, accountTotals, accountTrend, accountCampaigns, clientsWithGa4, insightsForClient, insightsGeneratedAt, storeMonthly, pinnedForClient, campaignPlanForClient, accountCampaignsManaged, adWritesForAccount } from "../../../lib/db";
import { money, num, roas, roasClass } from "../../../lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROUPS = [
  { key: "opportunity", label: "Opportunities" },
  { key: "issue", label: "Issues" },
  { key: "trend", label: "Trends" },
  { key: "info", label: "Other" },
];

export const dynamic = "force-dynamic";

export default async function AccountDetail({ params, searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const [totals, trend, campaigns, ga4Clients, insights, insightsAt, store, pinned, campaignPlan, managedCampaigns, adWrites] = await Promise.all([
    accountTotals(params.id, days),
    accountTrend(params.id, days),
    accountCampaigns(params.id, days),
    clientsWithGa4(),
    insightsForClient(acct.client),
    insightsGeneratedAt(acct.client),
    storeMonthly(acct.client),
    pinnedForClient(acct.client),
    campaignPlanForClient(acct.client),
    accountCampaignsManaged(params.id, days),
    adWritesForAccount(params.id),
  ]);

  const pinnedTitles = new Set(pinned.map((p) => p.title));

  const r = roas(totals.revenue, totals.spend);
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  // Build year-over-year seasonality overlay (last up to 3 years, complete months only)
  const seasonYears = [...new Set(store.map((s) => String(s.year)))].sort().slice(-3);
  const seasonal = MONTHS.map((m, i) => {
    const row = { month: m };
    for (const s of store) {
      if (s.mon === i + 1 && seasonYears.includes(String(s.year))) row[String(s.year)] = Math.round(s.revenue);
    }
    return row;
  });
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

      {pinned.length > 0 && (
        <div className="panel">
          <h2>Pinned — tracking impact over time</h2>
          <p className="note">Baseline captured when you pinned. Compare against the latest month to see if your changes moved it.</p>
          {pinned.map((p) => (
            <PinnedItem key={p.id} client={acct.client} item={p} />
          ))}
        </div>
      )}

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
          <p className="note">AI-flagged from monthly sales trends (month-over-month + year-over-year), judged against the business seasonality. Pin any card to track it.</p>
          {GROUPS.map((g) => {
            const items = insights.filter((n) => n.category === g.key);
            if (items.length === 0) return null;
            return (
              <div key={g.key}>
                <div className={"insight-group-title " + g.key}>{g.label}</div>
                <div className="insights-grid">
                  {items.map((n, i) => (
                    <InsightCard key={i} client={acct.client} insight={n} pinned={pinnedTitles.has(n.title)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CampaignStudio client={acct.client} initialPlan={campaignPlan} accountExt={acct.external_account_id} />

      <AccountChat client={acct.client} />

      {store.length > 0 && (
        <div className="panel">
          <h2>Business seasonality — total store revenue by month (year over year)</h2>
          <p className="note">The whole business&apos;s seasonal shape. Use it to judge whether a product&apos;s move is real or just the season.</p>
          <SeasonalityChart data={seasonal} years={seasonYears} />
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

      <AdsManager
        accountId={acct.id}
        accountExt={acct.external_account_id}
        cap={acct.max_daily_budget}
        campaigns={managedCampaigns}
        writes={adWrites}
      />
    </Shell>
  );
}
