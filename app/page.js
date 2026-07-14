import Shell from "../components/Shell";
import AccountRow from "../components/AccountRow";
import AccountTrends from "../components/AccountTrends";
import NotificationsFeed from "../components/NotificationsFeed";
import ContentCalendar from "../components/ContentCalendar";
import { agencyTotals, accountsList, accountsTrendDaily, agencyNotifications, contentCalendar, lastFullDataDate, agencyNotes } from "../lib/db";
import { money, num, roas, roasClass } from "../lib/format";
import { getSession } from "../lib/session";

export const dynamic = "force-dynamic";

// Public landing (the OAuth consent screen's "application home page").
// The dashboard below only renders for a valid session.
function Landing() {
  return (
    <div className="landing">
      <h1>Ormond Hub</h1>
      <p className="landing-tag">Ormond Brand Consulting&apos;s private client platform — ad performance analytics,
        Meta ↔ GA4 reconciliation, content scheduling &amp; approvals, and brand listening for the businesses we manage.</p>
      <a className="landing-btn" href="/login">Log in</a>
      <div className="landing-links">
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/data-deletion">Data Deletion</a>
        {" "}· <a href="mailto:brooks@ormondbrandconsulting.com">Contact</a>
      </div>
    </div>
  );
}

export default async function Overview({ searchParams }) {
  if (!getSession()) return <Landing />;
  const days = Number(searchParams?.days) || 30;
  const [totals, trendRows, accounts, notifications, calendar, lastFull, notes] = await Promise.all([
    agencyTotals(days),
    accountsTrendDaily(16),
    accountsList(days),
    agencyNotifications(),
    contentCalendar(),
    lastFullDataDate(),
    agencyNotes(),
  ]);

  const blended = roas(totals.revenue, totals.spend);
  const notifCount = notifications.todos.length + notifications.failed.length + notifications.ruleEvents.length + notifications.insights.length + (notifications.overdue?.length || 0) + (notifications.stuck?.length || 0) + (notifications.reminders?.length || 0) + (notifications.taskResults?.length || 0);

  return (
    <Shell crumb={<><b>Agency Overview</b></>}>
      <h1>Agency Overview</h1>
      <div className="sub">Everything that needs you, across all accounts · last {days} days</div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>Notifications</h2>
          {notifCount > 0 && <span className="notif-count">{notifCount}</span>}
        </div>
        <p className="note">Approvals, failed posts, rule activity, and smart-insight flags — so you never have to click into each account to find them.</p>
        <NotificationsFeed data={notifications} />
      </div>

      <div className="panel">
        <h2>Content calendar</h2>
        <p className="note">All accounts&apos; scheduled and pending content in one place. Click any item to approve or send back.</p>
        <ContentCalendar items={calendar} notes={notes} showClient />
      </div>

      <div className="cards">
        <div className="card"><div className="label">Spend</div><div className="value">{money(totals.spend)}</div></div>
        <div className="card"><div className="label">Revenue</div><div className="value">{money(totals.revenue)}</div></div>
        <div className="card"><div className="label">Blended ROAS</div><div className={"value " + roasClass(blended)}>{blended.toFixed(1)}x</div></div>
        <div className="card"><div className="label">Conversions</div><div className="value">{num(Math.round(totals.conversions))}</div></div>
      </div>

      <div className="panel">
        <h2>Account trends · last 7 full days</h2>
        <p className="note">Spend (purple) &amp; revenue (green) per account vs. the prior 7 days{lastFull ? `, through ${lastFull} (last complete ingest day)` : ""}. Click a card for quick analytics.</p>
        <AccountTrends accounts={accounts.filter((a) => a.has_ads)} trends={trendRows} endDate={lastFull} />
      </div>

      <div className="panel">
        <h2>Accounts</h2>
        <p className="note">Click an account to drill into its campaigns.</p>
        <table>
          <thead>
            <tr><th>Account</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Conv.</th><th>Clicks</th><th>Impr.</th></tr>
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
