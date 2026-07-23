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
import RulesManager from "../../../components/RulesManager";
import AccountTabs from "../../../components/AccountTabs";
import LeadsPanel from "../../../components/LeadsPanel";
import { accountById, accountTotals, accountTrend, accountCampaigns, clientsWithGa4, insightsForClient, insightsGeneratedAt, storeMonthly, pinnedForClient, campaignPlanForClient, accountCampaignsManaged, adWritesForAccount, rulesForAccount, ruleEventsForAccount, chatHistory, leadsForClient, brandSettings, emailEverSent } from "../../../lib/db";
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
  const adId = acct.ad_account_id;

  const [ga4Clients, insights, insightsAt, store, pinned, campaignPlan, chatMsgs, leads, brand, emailOk] = await Promise.all([
    clientsWithGa4(),
    insightsForClient(acct.client),
    insightsGeneratedAt(acct.client),
    storeMonthly(acct.client),
    pinnedForClient(acct.client),
    campaignPlanForClient(acct.client),
    chatHistory(acct.id).catch(() => []),
    leadsForClient(acct.client_id).catch(() => []),
    brandSettings(acct.client_id).catch(() => ({})),
    emailEverSent().catch(() => false),
  ]);

  let totals = { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 };
  let trend = [], campaigns = [], managedCampaigns = [], adWrites = [], rules = [], ruleEvents = [];
  if (adId) {
    [totals, trend, campaigns, managedCampaigns, adWrites, rules, ruleEvents] = await Promise.all([
      accountTotals(adId, days),
      accountTrend(adId, days),
      accountCampaigns(adId, days),
      accountCampaignsManaged(adId, days),
      adWritesForAccount(adId),
      rulesForAccount(adId),
      ruleEventsForAccount(adId),
    ]);
  }

  const pinnedTitles = new Set(pinned.map((p) => p.title));
  const r = roas(totals.revenue, totals.spend);
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

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
    <Shell crumb={<><Link href={`/accounts?days=${days}`}>Accounts</Link> · <b>{acct.client}</b> · Paid Marketing</>}>
      <h1>
        {acct.client}{" "}
        {acct.platform && <span className={"pill" + (acct.platform === "google" ? " google" : "")}>{acct.platform}</span>}
      </h1>
      <div className="sub">{adId ? `Account ${acct.external_account_id} · ` : ""}Paid Marketing · last {days} days</div>

      <AccountTabs accountId={acct.id} active="paid" days={days} />

      {!adId && (
        <div className="panel">
          <h2>No ad account connected</h2>
          <p className="note">This brand is set up for content only. Head to <b>Content Marketing</b> to compose and schedule posts, or connect a Meta ad account to unlock paid performance, Campaign Studio, and rules here.</p>
          <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none" }} href="/onboard">Connect accounts →</a>
        </div>
      )}

      {adId && (
      <>
      <div id="performance" className="cards">
        <div className="card"><div className="label">Spend</div><div className="value">{money(totals.spend)}</div></div>
        <div className="card"><div className="label">Revenue</div><div className="value">{money(totals.revenue)}</div><div className="foot">Meta-reported</div></div>
        <div className="card"><div className="label">ROAS</div><div className={"value " + roasClass(r)}>{r.toFixed(1)}x</div></div>
        <div className="card"><div className="label">Conversions</div><div className="value">{num(Math.round(totals.conversions))}</div><div className="foot">CTR {ctr.toFixed(1)}%</div></div>
      </div>

      {hasGa4 && (
        <div className="sub" style={{ marginTop: -6 }}>
          <Link className="rowlink" href={`/accounts/${acct.id}/google?days=${days}`}>View Google Analytics &amp; attribution →</Link>
        </div>
      )}
      </>
      )}

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
        <div id="insights" className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2>Smart Insights</h2>
            {insightsAt && <span className="note" style={{ margin: 0 }}>Updated {new Date(insightsAt).toLocaleDateString()}</span>}
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

      {adId && (
        <div id="studio">
          <CampaignStudio client={acct.client} initialPlan={campaignPlan} accountExt={acct.external_account_id} existingCampaigns={managedCampaigns} />
        </div>
      )}

      <AccountChat client={acct.client} accountExt={acct.external_account_id} accountId={acct.ad_account_id} clientId={acct.id} initialMessages={chatMsgs} />

      {store.length > 0 && (
        <div className="panel">
          <h2>Business seasonality — total store revenue by month (year over year)</h2>
          <p className="note">The whole business&apos;s seasonal shape. Use it to judge whether a product&apos;s move is real or just the season.</p>
          <SeasonalityChart data={seasonal} years={seasonYears} />
        </div>
      )}

      {adId && (
      <>
      <div className="panel">
        <h2>Daily spend vs. revenue</h2>
        <TrendChart data={trend} />
      </div>

      <div id="campaigns" className="panel">
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

      <div id="ads">
        <AdsManager
          accountId={acct.ad_account_id}
          accountExt={acct.external_account_id}
          cap={acct.max_daily_budget}
          urlParams={acct.url_params}
          campaigns={managedCampaigns}
          writes={adWrites}
          clientId={acct.id}
        />
      </div>

      <div id="rules">
        <RulesManager accountId={acct.ad_account_id} rules={rules} events={ruleEvents} />
      </div>
      </>
      )}

      <div id="leads">
        <LeadsPanel clientId={acct.client_id} client={acct.client} leads={leads}
          leadEmails={brand?.lead_emails || []} emailConfigured={emailOk} />
      </div>
    </Shell>
  );
}
