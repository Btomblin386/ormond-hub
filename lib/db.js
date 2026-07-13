import postgres from "postgres";

// Serverless-safe: open a fresh connection per request and close it after.
// Reusing a long-lived connection across Vercel invocations leaks/hangs on the
// Supabase transaction pooler, so we never cache the client globally.
async function withDb(fn) {
  const sql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    prepare: false, // required for Supabase transaction pooler
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
  try {
    return await fn(sql);
  } finally {
    // Close in the background; don't let cleanup hang the response.
    sql.end({ timeout: 5 }).catch(() => {});
  }
}

/* ---------- Agency overview ---------- */

export function agencyTotals(days) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select coalesce(sum(dm.spend),0)::float       as spend,
             coalesce(sum(dm.revenue),0)::float     as revenue,
             coalesce(sum(dm.conversions),0)::float as conversions,
             coalesce(sum(dm.clicks),0)::float      as clicks
      from daily_metrics dm
      where dm.date >= current_date - ${days}::int`;
    return row;
  });
}

export function spendTrend(days) {
  return withDb((sql) => sql`
    select dm.date::text as date,
           sum(dm.spend)::float   as spend,
           sum(dm.revenue)::float as revenue
    from daily_metrics dm
    where dm.date >= current_date - ${days}::int
    group by dm.date order by dm.date`);
}

export function accountsList(days) {
  return withDb((sql) => sql`
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
    order by spend desc`);
}

/* ---------- Single account ---------- */

export function accountById(id) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select a.id, c.name as client, a.platform, a.external_account_id, a.currency
      from ad_accounts a
      join clients c on c.id = a.client_id
      where a.id = ${id}`;
    return row;
  });
}

export function accountTotals(id, days) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select coalesce(sum(spend),0)::float       as spend,
             coalesce(sum(revenue),0)::float     as revenue,
             coalesce(sum(conversions),0)::float as conversions,
             coalesce(sum(clicks),0)::float      as clicks,
             coalesce(sum(impressions),0)::float as impressions
      from daily_metrics
      where ad_account_id = ${id} and date >= current_date - ${days}::int`;
    return row;
  });
}

export function accountTrend(id, days) {
  return withDb((sql) => sql`
    select date::text as date, sum(spend)::float as spend, sum(revenue)::float as revenue
    from daily_metrics
    where ad_account_id = ${id} and date >= current_date - ${days}::int
    group by date order by date`);
}

export function accountCampaigns(id, days) {
  return withDb((sql) => sql`
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
    order by spend desc`);
}

/* ---------- Reconciliation ---------- */

export function clientsWithGa4() {
  return withDb(async (sql) => {
    const rows = await sql`
      select distinct c.name
      from ga4_properties g
      join clients c on c.id = g.client_id
      order by c.name`;
    return rows.map((r) => r.name);
  });
}

export function metaReportedDaily(client, days) {
  return withDb((sql) => sql`
    select dm.date::text as date,
           sum(dm.revenue)::float     as meta_claim,
           sum(dm.conversions)::float as meta_conv
    from daily_metrics dm
    join ad_accounts a on a.id = dm.ad_account_id
    join clients c on c.id = a.client_id
    where c.name = ${client} and dm.date >= current_date - ${days}::int
    group by dm.date order by dm.date`);
}

export function ga4Daily(client, days) {
  return withDb((sql) => sql`
    select g.date::text as date, g.segment,
           g.revenue::float as v, g.purchases as p
    from ga4_daily g
    join clients c on c.id = g.client_id
    where c.name = ${client} and g.date >= current_date - ${days}::int`);
}

export function ga4Products(client) {
  return withDb((sql) => sql`
    select item_name,
           max(case when segment='total'     then revenue else 0 end)::float as total,
           max(case when segment='meta_paid' then revenue else 0 end)::float as meta_paid
    from ga4_product g
    join clients c on c.id = g.client_id
    where c.name = ${client}
    group by item_name
    having max(case when segment='total' then revenue else 0 end) > 0
    order by total desc`);
}

/* ---------- Smart Insights ---------- */

export function insightsForClient(client) {
  return withDb((sql) => sql`
    select i.category, i.severity, i.scope, i.title, i.detail, i.period,
           i.generated_at::text as generated_at
    from insights i
    join clients c on c.id = i.client_id
    where c.name = ${client} and i.dismissed = false
    order by
      case i.severity when 'high' then 0 when 'medium' then 1 else 2 end,
      case i.category when 'issue' then 0 when 'opportunity' then 1 when 'trend' then 2 else 3 end`);
}

export function insightsGeneratedAt(client) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select max(i.generated_at)::text as at
      from insights i join clients c on c.id = i.client_id
      where c.name = ${client}`;
    return row?.at || null;
  });
}

/* ---------- Pinned insights ---------- */

export function pinnedForClient(client) {
  return withDb((sql) => sql`
    select p.id, p.scope, p.category, p.title, p.detail,
           p.baseline_revenue::float as baseline_revenue,
           to_char(p.baseline_month, 'Mon YYYY') as baseline_month,
           p.pinned_at::text as pinned_at,
           (select m.revenue::float from ga4_product_monthly m
              where m.client_id = p.client_id and m.item_name = p.scope
                and m.month < date_trunc('month', current_date)
              order by m.month desc limit 1) as current_revenue,
           (select to_char(m.month, 'Mon YYYY') from ga4_product_monthly m
              where m.client_id = p.client_id and m.item_name = p.scope
                and m.month < date_trunc('month', current_date)
              order by m.month desc limit 1) as current_month
    from pinned_insights p
    join clients c on c.id = p.client_id
    where c.name = ${client}
    order by p.pinned_at desc`);
}

export function pinInsight(client, { scope, category, title, detail }) {
  return withDb((sql) => sql`
    insert into pinned_insights (client_id, scope, category, title, detail, baseline_revenue, baseline_month)
    select c.id, ${scope}, ${category}, ${title}, ${detail},
      (select m.revenue from ga4_product_monthly m
         where m.client_id = c.id and m.item_name = ${scope}
           and m.month < date_trunc('month', current_date)
         order by m.month desc limit 1),
      (select m.month from ga4_product_monthly m
         where m.client_id = c.id and m.item_name = ${scope}
           and m.month < date_trunc('month', current_date)
         order by m.month desc limit 1)
    from clients c where c.name = ${client}
    on conflict (client_id, scope, title) do nothing`);
}

export function unpinInsight(client, { scope, title }) {
  return withDb((sql) => sql`
    delete from pinned_insights p
    using clients c
    where p.client_id = c.id and c.name = ${client}
      and p.title = ${title}
      and coalesce(p.scope, '') = coalesce(${scope}, '')`);
}

/* ---------- Business seasonality ---------- */

export function storeMonthly(client) {
  return withDb((sql) => sql`
    select extract(year from s.month)::int as year,
           extract(month from s.month)::int as mon,
           s.revenue::float as revenue
    from ga4_store_monthly s
    join clients c on c.id = s.client_id
    where c.name = ${client}
      and s.month < date_trunc('month', current_date)
    order by s.month`);
}
