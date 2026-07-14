import Shell from "../components/Shell";
import TrendChart from "../components/TrendChart";
import AccountRow from "../components/AccountRow";
import NotificationsFeed from "../components/NotificationsFeed";
import ContentCalendar from "../components/ContentCalendar";
import { agencyTotals, spendTrend, accountsList, agencyNotifications, contentCalendar } from "../lib/db";
import { money, num, roas, roasClass } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const [totals, trend, accounts, notifications, calendar] = await Promise.all([
    agencyTotals(days),
    spendTrend(days),
    accountsList(days),
    agencyNotifications(),
    contentCalendar(),
  ]);

  const blended = roas(totals.revenue, totals.spend);
  const notifCount = notifications.todos.length + notifications.failed.length + notifications.ruleEvents.length + notifications.insights.length;

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
        <ContentCalendar items={calendar} />
      </div>

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
