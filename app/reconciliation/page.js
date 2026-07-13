import Shell from "../../components/Shell";
import ReconChart from "../../components/ReconChart";
import ClientPicker from "../../components/ClientPicker";
import { clientsWithGa4, metaReportedDaily, ga4Daily, ga4Products } from "../../lib/db";
import { money, num, pct } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function Reconciliation({ searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const clients = await clientsWithGa4();

  if (clients.length === 0) {
    return (
      <Shell crumb={<><b>Reconciliation</b></>}>
        <h1>Meta ↔ GA4 Reconciliation</h1>
        <div className="sub">No clients have GA4 connected yet.</div>
      </Shell>
    );
  }

  const client = clients.includes(searchParams?.client) ? searchParams.client : clients[0];
  const [metaDaily, ga, products] = await Promise.all([
    metaReportedDaily(client, days),
    ga4Daily(client, days),
    ga4Products(client),
  ]);

  const map = {};
  for (const r of metaDaily) { (map[r.date] = map[r.date] || {}).claim = r.meta_claim; map[r.date].metaConv = r.meta_conv; }
  for (const r of ga) {
    map[r.date] = map[r.date] || {};
    if (r.segment === "total") map[r.date].store = r.v;
    else { map[r.date].paid = r.v; }
  }
  const dates = Object.keys(map).sort();
  const series = dates.map((d) => ({ date: d, store: map[d].store || 0, claim: map[d].claim || 0, paid: map[d].paid || 0 }));

  const sStore = series.reduce((a, r) => a + r.store, 0);
  const sClaim = series.reduce((a, r) => a + r.claim, 0);
  const sPaid = series.reduce((a, r) => a + r.paid, 0);
  const metaConv = metaDaily.reduce((a, r) => a + (r.meta_conv || 0), 0);
  const paidConv = ga.filter((r) => r.segment === "meta_paid").reduce((a, r) => a + (r.p || 0), 0);
  const gap = sPaid > 0 ? (sClaim / sPaid).toFixed(1) + "x" : "—";

  const prod = products.map((p) => ({ ...p, share: p.total > 0 ? p.meta_paid / p.total : 0 }));

  return (
    <Shell crumb={<><b>Reconciliation</b> · {client}</>}>
      <h1>Meta ↔ GA4 Reconciliation</h1>
      <ClientPicker clients={clients} current={client} />
      <div className="sub">What Meta claims vs. what Google Analytics attributes · last {days} days</div>

      <div className="callout">
        <b>How to read this:</b> &quot;Meta claims&quot; is Meta&apos;s own pixel (view-through + 7-day-click, often over-counts).
        &quot;GA4 last-click&quot; credits Meta only when it was the last click before purchase (often under-counts).
        The truth sits between them.
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
                <td>{pct(r.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
