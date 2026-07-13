import Nav from "../../components/Nav";
import ReconChart from "../../components/ReconChart";
import { metaReportedDaily, ga4Daily, ga4Products } from "../../lib/db";

export const dynamic = "force-dynamic";

const CLIENT = "Slavens Racing";
const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString();

export default async function Reconciliation({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const [metaDaily, ga, products] = await Promise.all([
    metaReportedDaily(CLIENT, days),
    ga4Daily(CLIENT, days),
    ga4Products(CLIENT),
  ]);

  const map = {};
  for (const r of metaDaily) {
    map[r.date] = map[r.date] || {};
    map[r.date].claim = r.meta_claim;
    map[r.date].metaConv = r.meta_conv;
  }
  for (const r of ga) {
    map[r.date] = map[r.date] || {};
    if (r.segment === "total") map[r.date].store = r.v;
    else { map[r.date].paid = r.v; map[r.date].paidP = r.p; }
  }
  const dates = Object.keys(map).sort();
  const series = dates.map((d) => ({
    date: d,
    store: map[d].store || 0,
    claim: map[d].claim || 0,
    paid: map[d].paid || 0,
  }));

  const sStore = series.reduce((a, r) => a + r.store, 0);
  const sClaim = series.reduce((a, r) => a + r.claim, 0);
  const sPaid = series.reduce((a, r) => a + r.paid, 0);
  const metaConv = metaDaily.reduce((a, r) => a + (r.meta_conv || 0), 0);
  const paidConv = ga.filter((r) => r.segment === "meta_paid").reduce((a, r) => a + (r.p || 0), 0);
  const gap = sPaid > 0 ? (sClaim / sPaid).toFixed(1) + "x" : "—";

  const prod = products
    .map((p) => ({ ...p, share: p.total > 0 ? p.meta_paid / p.total : 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <Nav active="reconciliation" />
      <div className="wrap">
        <header className="page">
          <h1>Meta ↔ GA4 Reconciliation — Slavens Racing</h1>
          <div className="rangebar">
            {[30, 90].map((d) => (
              <a key={d} href={`/reconciliation?days=${d}`} className={d === days ? "active" : ""}>{d}d</a>
            ))}
          </div>
        </header>
        <div className="sub">What Meta claims vs. what Google Analytics attributes · last {days} days</div>

        <div className="callout">
          <b>How to read this:</b> &quot;Meta claims&quot; is Meta&apos;s own pixel (view-through + 7-day-click, often over-counts).
          &quot;GA4 last-click&quot; credits Meta only when it was the last click before purchase (often under-counts).
          Your true incremental number sits between them.
        </div>

        <div className="cards">
          <div className="card"><div className="label">Store revenue (GA4)</div><div className="value">{money(sStore)}</div><div className="foot">all sources</div></div>
          <div className="card"><div className="label">Meta claims</div><div className="value">{money(sClaim)}</div><div className="foot">{num(Math.round(metaConv))} orders claimed</div></div>
          <div className="card"><div className="label">Meta last-click (GA4)</div><div className="value">{money(sPaid)}</div><div className="foot">{num(paidConv)} orders last-click</div></div>
          <div className="card accent"><div className="label">Attribution gap</div><div className="value">{gap}</div><div className="foot">Meta claims ÷ GA4 last-click</div></div>
        </div>

        <div className="panel">
          <h2>Daily revenue — store vs. Meta claims vs. Meta last-click</h2>
          <p className="note">The distance between the lines is the attribution gap.</p>
          <ReconChart data={series} />
        </div>

        <div className="panel">
          <h2>By product — where Meta actually drives sales</h2>
          <p className="note">Last 30 days · store revenue vs. GA4 last-click Meta revenue · sorted by store revenue</p>
          <table>
            <thead>
              <tr><th>Product</th><th>Store rev</th><th>Meta last-click</th><th>Meta share</th></tr>
            </thead>
            <tbody>
              {prod.map((r, i) => (
                <tr key={i}>
                  <td>{r.item_name}</td>
                  <td>{money(r.total)}</td>
                  <td>{money(r.meta_paid)}</td>
                  <td>{Math.round(r.share * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
