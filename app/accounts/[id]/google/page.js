import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../../components/Shell";
import AccountTabs from "../../../../components/AccountTabs";
import ReconChart from "../../../../components/ReconChart";
import { accountById, ga4PropertyForClient, metaReportedDaily, ga4Daily, ga4Products } from "../../../../lib/db";
import { money, num, pct } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export default async function AccountGoogle({ params, searchParams }) {
  const days = Number(searchParams?.days) || 30;
  const acct = await accountById(params.id);
  if (!acct) notFound();

  const prop = await ga4PropertyForClient(acct.client_id);

  let series = [], sStore = 0, sClaim = 0, sPaid = 0, metaConv = 0, paidConv = 0, prod = [];
  if (prop) {
    const [metaDaily, ga, products] = await Promise.all([
      metaReportedDaily(acct.client, days),
      ga4Daily(acct.client, days),
      ga4Products(acct.client),
    ]);
    const map = {};
    for (const r of metaDaily) { (map[r.date] = map[r.date] || {}).claim = r.meta_claim; map[r.date].metaConv = r.meta_conv; }
    for (const r of ga) {
      map[r.date] = map[r.date] || {};
      if (r.segment === "total") map[r.date].store = r.v;
      else map[r.date].paid = r.v;
    }
    series = Object.keys(map).sort().map((d) => ({ date: d, store: map[d].store || 0, claim: map[d].claim || 0, paid: map[d].paid || 0 }));
    sStore = series.reduce((a, r) => a + r.store, 0);
    sClaim = series.reduce((a, r) => a + r.claim, 0);
    sPaid = series.reduce((a, r) => a + r.paid, 0);
    metaConv = metaDaily.reduce((a, r) => a + (r.meta_conv || 0), 0);
    paidConv = ga.filter((r) => r.segment === "meta_paid").reduce((a, r) => a + (r.p || 0), 0);
    prod = products.map((p) => ({ ...p, share: p.total > 0 ? p.meta_paid / p.total : 0 }));
  }
  const gap = sPaid > 0 ? (sClaim / sPaid).toFixed(1) + "x" : "—";
  const hasMeta = !!acct.ad_account_id;

  return (
    <Shell crumb={<><Link href="/accounts">Accounts</Link> · <b>{acct.client}</b> · Google</>}>
      <h1>{acct.client} <span className="pill google">google</span></h1>
      <div className="sub">Google Analytics &amp; Ads · last {days} days</div>

      <AccountTabs accountId={acct.id} active="google" days={days} />

      {!prop ? (
        <div className="panel">
          <h2>Google Analytics</h2>
          <p className="note">No GA4 property connected for {acct.client} yet. Connect one to unlock store revenue,
            Meta ↔ GA4 attribution reconciliation, product-level insight signals, and seasonality.</p>
          <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none" }} href="/onboard">Connect Google Analytics →</a>
        </div>
      ) : (
        <>
          <div className="social-status connected" style={{ marginBottom: 14 }}>
            <span className="social-ok">✓ GA4 connected</span>
            <span>Property {prop.property_id}{prop.domain ? ` · ${prop.domain}` : ""}</span>
            <span className="muted" style={{ fontSize: 11 }}>
              {prop.auth_kind === "oauth" ? `via Google login${prop.account_email ? " (" + prop.account_email + ")" : ""}` : "via service account"}
            </span>
          </div>

          {series.length === 0 ? (
            <div className="panel">
              <h2>Waiting on first data pull</h2>
              <p className="note">The property is connected — GA4 data lands on the next scheduled ingest (3×/day). Check back shortly.</p>
            </div>
          ) : (
            <>
              <div className="cards">
                <div className="card"><div className="label">Store revenue (GA4)</div><div className="value">{money(sStore)}</div><div className="foot">all sources</div></div>
                <div className="card"><div className="label">Meta claims</div><div className="value">{money(sClaim)}</div><div className="foot">{num(Math.round(metaConv))} orders claimed</div></div>
                <div className="card"><div className="label">Meta last-click (GA4)</div><div className="value">{money(sPaid)}</div><div className="foot">{num(paidConv)} orders last-click</div></div>
                <div className="card accent"><div className="label">Attribution gap</div><div className="value">{gap}</div><div className="foot">Meta claims ÷ GA4 last-click</div></div>
              </div>

              <div className="panel">
                <h2>Daily revenue — store{hasMeta ? " vs. Meta claims vs. Meta last-click" : ""}</h2>
                <p className="note">{hasMeta ? "The distance between the lines is the attribution gap." : "Store revenue from GA4. Connect a Meta ad account to see attribution comparisons."}</p>
                <ReconChart data={series} />
              </div>

              {prod.length > 0 && (
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
              )}
            </>
          )}
        </>
      )}

      <div className="panel">
        <h2>Google Ads</h2>
        <p className="note">
          {prop?.auth_kind === "oauth"
            ? "Access already granted with this Google connection. Ad performance lands here automatically once Google approves the Ads API developer token (application pending, typically 1–4 weeks)."
            : "Connect with Google on the onboarding page to grant Ads access — data flows once the Ads API developer token is approved."}
        </p>
      </div>
    </Shell>
  );
}
