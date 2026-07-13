import postgres from "postgres";

// Single shared connection. Supabase transaction pooler needs prepare:false.
const globalForSql = globalThis;
const sql =
  globalForSql._sql ||
  postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false, max: 3 });
if (!globalForSql._sql) globalForSql._sql = sql;

export default sql;

export async function accountRollup(days) {
  return sql`
    select c.name as client, a.platform,
           coalesce(sum(dm.spend),0)::float       as spend,
           coalesce(sum(dm.revenue),0)::float     as revenue,
           coalesce(sum(dm.conversions),0)::float as conversions,
           coalesce(sum(dm.clicks),0)::float      as clicks
    from clients c
    join ad_accounts a on a.client_id = c.id
    left join daily_metrics dm
      on dm.ad_account_id = a.id and dm.date >= current_date - ${days}::int
    group by c.name, a.platform
    order by spend desc`;
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
