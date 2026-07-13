import postgres from "postgres";

// Single shared connection. Supabase transaction pooler needs prepare:false.
const globalForSql = globalThis;
const sql =
  globalForSql._sql ||
  postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false, max: 3 });
if (!globalForSql._sql) globalForSql._sql = sql;

export default sql;

/* ---------- Agency overview ---------- */

export async function agencyTotals(days) {
  const [row] = await sql`
    select coalesce(sum(dm.spend),0)::float       as spend,
           coalesce(sum(dm.revenue),0)::float     as revenue,
           coalesce(sum(dm.conversions),0)::float as conversions,
           coalesce(sum(dm.clicks),0)::float      as clicks
    from daily_metrics dm
    where dm.date >= current_date - ${days}::int`;
  return row;
}

export async function spendTrend(days) {
  return sql`
    select dm.date::text as date,
           sum(dm.spend)::float   as spend,
           sum(dm.revenue)::float as revenue
    from daily_metrics dm
    where dm.date >= current_date - ${days}::int
    group by dm.date order by dm.date`;
}

export async function accountsList(days) {
  return sql`
    select a.id, c.name as client, a.platform,
           coalesce(sum(dm.spend),0)::float       as spend,
           coalesce(sum(dm.revenue),0)::float     as revenue,
           coalesce(sum(dm.conversions),0)::float as conversions,
           coalesce(sum(dm.clicks),0)::float      as clicks,
           coalesce(sum(dm.impressions),0)::float as impressions
    from ad_accounts a
    join clients c on c.id = a.client_id
    left join daily_metrics dm
      on dm.ad_account_id = a.id and dm.date >= current_date - ${days}::int
    group by a.id, c.name, a.platform
    order by spend desc`;
}

/* ---------- Single account ---------- */

export async function accountById(id) {
  const [row] = await sql`
    select a.id, c.name as client, a.platform, a.external_account_id, a.currency
    from ad_accounts a
    join clients c on c.id = a.client_id
    where a.id = ${id}`;
  return row;
}

export async function accountTotals(id, days) {
  const [row] = await sql`
    select coalesce(sum(spend),0)::float       as spend,
           coalesce(sum(revenue),0)::float     as revenue,
           coalesce(sum(conversions),0)::float as conversions,
           coalesce(sum(clicks),0)::float      as clicks,
           coalesce(sum(impressions),0)::float as impressions
    from daily_metrics
    where ad_account_id = ${id} and date >= current_date - ${days}::int`;
  return row;
}

export async function accountTrend(id, days) {
  return sql`
    select date::text as date, sum(spend)::float as spend, sum(revenue)::float as revenue
    from daily_metrics
    where ad_account_id = ${id} and date >= current_date - ${days}::int
    group by date order by date`;
}

export async function accountCampaigns(id, days) {
  return sql`
    select coalesce(campaign_name, '(unnamed)') as campaign,
           sum(spend)::float       as spend,
           sum(revenue)::float     as revenue,
           sum(conversions)::float as conversions,
           sum(clicks)::float      as clicks,
           sum(impressions)::float as impressions
    from daily_metrics
    where ad_account_id = ${id} and date >= current_date - ${days}::int
    group by campaign_name
    having sum(spend) > 0 or sum(revenue) > 0
    order by spend desc`;
}

/* ---------- Reconciliation ---------- */

export async function clientsWithGa4() {
  const rows = await sql`
    select distinct c.name
    from ga4_properties g
    join clients c on c.id = g.client_id
    order by c.name`;
  return rows.map((r) => r.name);
}

export async function metaReportedDaily(client, days) {
  return sql`
    select dm.date::text as date,
           sum(dm.revenue)::float     as meta_claim,
           sum(dm.conversions)::float as meta_conv
    from daily_metrics dm
    join ad_accounts a on a.id = dm.ad_account_id
    join clients c on c.id = a.client_id
    where c.name = ${client} and dm.date >= current_date - ${days}::int
    group by dm.date order by dm.date`;
}

export async function ga4Daily(client, days) {
  return sql`
    select g.date::text as date, g.segment,
           g.revenue::float as v, g.purchases as p
    from ga4_daily g
    join clients c on c.id = g.client_id
    where c.name = ${client} and g.date >= current_date - ${days}::int`;
}

export async function ga4Products(client) {
  return sql`
    select item_name,
           max(case when segment='total'     then revenue else 0 end)::float as total,
           max(case when segment='meta_paid' then revenue else 0 end)::float as meta_paid
    from ga4_product g
    join clients c on c.id = g.client_id
    where c.name = ${client}
    group by item_name
    having max(case when segment='total' then revenue else 0 end) > 0
    order by total desc`;
}

/* ---------- Smart Insights ---------- */

export async function insightsForClient(client) {
  return sql`
    select i.category, i.severity, i.scope, i.title, i.detail, i.period,
           i.generated_at::text as generated_at
    from insights i
    join clients c on c.id = i.client_id
    where c.name = ${client} and i.dismissed = false
    order by
      case i.severity when 'high' then 0 when 'medium' then 1 else 2 end,
      case i.category when 'issue' then 0 when 'opportunity' then 1 when 'trend' then 2 else 3 end`;
}

export async function insightsGeneratedAt(client) {
  const [row] = await sql`
    select max(i.generated_at)::text as at
    from insights i join clients c on c.id = i.client_id
    where c.name = ${client}`;
  return row?.at || null;
}

/* ---------- Business seasonality ---------- */

export async function storeMonthly(client) {
  return sql`
    select extract(year from s.month)::int as year,
           extract(month from s.month)::int as mon,
           s.revenue::float as revenue
    from ga4_store_monthly s
    join clients c on c.id = s.client_id
    where c.name = ${client}
      and s.month < date_trunc('month', current_date)   -- exclude the incomplete current month
    order by s.month`;
}
