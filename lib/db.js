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

// Client-centric: a "brand" appears if it has an ad account OR a social connection.
export function accountsList(days) {
  return withDb((sql) => sql`
    select c.id, c.name as client,
           (array_agg(distinct a.platform) filter (where a.platform is not null))[1] as platform,
           bool_or(a.id is not null) as has_ads,
           exists(select 1 from social_accounts s where s.client_id = c.id) as has_social,
           coalesce(sum(dm.spend),0)::float       as spend,
           coalesce(sum(dm.revenue),0)::float     as revenue,
           coalesce(sum(dm.conversions),0)::float as conversions,
           coalesce(sum(dm.clicks),0)::float      as clicks,
           coalesce(sum(dm.impressions),0)::float as impressions
    from clients c
    left join ad_accounts a on a.client_id = c.id
    left join daily_metrics dm on dm.ad_account_id = a.id and dm.date >= current_date - ${days}::int
    where exists(select 1 from ad_accounts x where x.client_id = c.id)
       or exists(select 1 from social_accounts s where s.client_id = c.id)
    group by c.id, c.name
    order by spend desc, c.name`);
}

// Per-client daily spend/revenue for the overview trend cards (7d sparkline + prior-7d delta).
export function accountsTrendDaily(days) {
  return withDb((sql) => sql`
    select c.id as client_id, dm.date::text as date,
           sum(dm.spend)::float as spend, sum(dm.revenue)::float as revenue
    from daily_metrics dm
    join ad_accounts a on a.id = dm.ad_account_id
    join clients c on c.id = a.client_id
    where dm.date >= current_date - ${days}::int
    group by c.id, dm.date
    order by c.id, dm.date`);
}

// Quick-analytics window: totals for an arbitrary date range (inclusive).
export function accountRangeTotals(clientId, from, to) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select coalesce(sum(dm.spend),0)::float       as spend,
             coalesce(sum(dm.revenue),0)::float     as revenue,
             coalesce(sum(dm.conversions),0)::float as conversions,
             coalesce(sum(dm.clicks),0)::float      as clicks,
             coalesce(sum(dm.impressions),0)::float as impressions
      from daily_metrics dm
      join ad_accounts a on a.id = dm.ad_account_id
      where a.client_id = ${clientId} and dm.date >= ${from} and dm.date <= ${to}`;
    return row;
  });
}

export function accountRangeTrend(clientId, from, to) {
  return withDb((sql) => sql`
    select dm.date::text as date,
           sum(dm.spend)::float as spend, sum(dm.revenue)::float as revenue
    from daily_metrics dm
    join ad_accounts a on a.id = dm.ad_account_id
    where a.client_id = ${clientId} and dm.date >= ${from} and dm.date <= ${to}
    group by dm.date order by dm.date`);
}

/* ---------- Single brand (client) ---------- */

export function accountById(id) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select c.id, c.id as client_id, c.name as client,
             a.id as ad_account_id, a.platform, a.external_account_id, a.currency,
             a.max_daily_budget::float as max_daily_budget, a.url_params,
             exists(select 1 from social_accounts s where s.client_id = c.id) as has_social
      from clients c
      left join ad_accounts a on a.client_id = c.id
      where c.id = ${id}
      order by a.created_at nulls last
      limit 1`;
    return row;
  });
}

/* ---------- Sidebar nav ---------- */

export function accountsNav() {
  return withDb((sql) => sql`
    select c.id, c.name as client,
           (array_agg(distinct a.platform) filter (where a.platform is not null))[1] as platform
    from clients c
    left join ad_accounts a on a.client_id = c.id
    where exists(select 1 from ad_accounts x where x.client_id = c.id)
       or exists(select 1 from social_accounts s where s.client_id = c.id)
    group by c.id, c.name
    order by c.name`);
}

export function clientsList() {
  return withDb((sql) => sql`select id, name from clients order by name`);
}

/* ---------- Users & roles ---------- */

export function userByEmail(email) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select u.id, u.email, u.name, u.role, u.client_id, u.pass_hash, u.pass_salt, u.active,
             c.name as client_name
      from app_users u left join clients c on c.id = u.client_id
      where lower(u.email) = lower(${email}) and u.active = true`;
    return row || null;
  });
}

export function listUsers() {
  return withDb((sql) => sql`
    select u.id, u.email, u.name, u.role, u.client_id, c.name as client_name, u.active,
           u.created_at::text as created_at
    from app_users u left join clients c on c.id = u.client_id
    order by u.role, u.name`);
}

export function createUser(d) {
  return withDb((sql) => sql`
    insert into app_users (email, name, role, client_id, pass_hash, pass_salt)
    values (${d.email.toLowerCase()}, ${d.name || null}, ${d.role}, ${d.clientId || null}, ${d.hash}, ${d.salt})
    on conflict (email) do update set
      name = excluded.name, role = excluded.role, client_id = excluded.client_id,
      pass_hash = excluded.pass_hash, pass_salt = excluded.pass_salt, active = true
    returning id`);
}

export function deactivateUser(id) {
  return withDb((sql) => sql`update app_users set active = false where id = ${id}`);
}

/* ---------- Content module ---------- */

export function contentForClient(clientId) {
  return withDb((sql) => sql`
    select id, channels, caption, link, media_urls, status, post_type, variants, first_comment, note,
           scheduled_at::text as scheduled_at, published_at::text as published_at,
           fb_post_id, ig_post_id, error, error_kind, created_at::text as created_at
    from content_items
    where client_id = ${clientId}
    order by coalesce(scheduled_at, created_at) desc`);
}

export function contentCalendar() {
  return withDb((sql) => sql`
    select ci.id, c.name as client, ci.client_id, ci.channels, ci.caption,
           ci.media_urls, ci.status, ci.note, ci.scheduled_at::text as scheduled_at,
           ci.published_at::text as published_at, ci.error
    from content_items ci
    join clients c on c.id = ci.client_id
    order by coalesce(ci.scheduled_at, ci.created_at) asc`);
}

export function createContent(d) {
  return withDb((sql) => sql`
    insert into content_items
      (client_id, channels, caption, link, media_urls, status, scheduled_at, created_by, post_type, variants, first_comment)
    values (${d.clientId}, ${d.channels}::text[], ${d.caption || ""}, ${d.link || null},
            ${d.mediaUrls || []}::text[], ${d.status || "draft"},
            ${d.scheduledAt || null}, ${d.createdBy || "agency"},
            ${d.postType || "feed"}, ${JSON.stringify(d.variants || {})}::jsonb, ${d.firstComment || null})
    returning id`);
}

export function updateContent(id, d) {
  return withDb((sql) => sql`
    update content_items set
      channels = ${d.channels}::text[],
      caption = ${d.caption || ""},
      link = ${d.link || null},
      media_urls = ${d.mediaUrls || []}::text[],
      scheduled_at = ${d.scheduledAt || null},
      post_type = ${d.postType || "feed"},
      variants = ${JSON.stringify(d.variants || {})}::jsonb,
      first_comment = ${d.firstComment || null},
      updated_at = now()
    where id = ${id}`);
}

export function setContentStatus(id, status, approvedBy) {
  return withDb((sql) => sql`
    update content_items
    set status = ${status},
        approved_by = ${approvedBy || null},
        -- when approving/scheduling a dateless post, default it to 30 min out so it
        -- lands on the calendar and publishes shortly
        scheduled_at = case when ${status} in ('approved','scheduled') and scheduled_at is null
                            then now() + interval '30 minutes' else scheduled_at end,
        error = case when ${status} = 'failed' then error else null end,
        updated_at = now()
    where id = ${id}`);
}

export function deleteContent(id) {
  return withDb((sql) => sql`delete from content_items where id = ${id}`);
}

export function rescheduleContent(id, scheduledAt) {
  return withDb((sql) => sql`
    update content_items set scheduled_at = ${scheduledAt || null}, updated_at = now()
    where id = ${id}`);
}

export function setContentRevisions(id, note) {
  return withDb((sql) => sql`
    update content_items set status = 'needs_revisions', note = ${note || null}, updated_at = now()
    where id = ${id}`);
}

export function patchContent(id, d) {
  return withDb((sql) => sql`
    update content_items set
      caption = coalesce(${d.caption ?? null}, caption),
      note = coalesce(${d.note ?? null}, note),
      updated_at = now()
    where id = ${id}`);
}

export function socialForClient(clientId) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select fb_page_id, fb_page_name, ig_user_id, ig_username
      from social_accounts where client_id = ${clientId} limit 1`;
    return row || null;
  });
}

export function setAccountUrlParams(accountId, params) {
  return withDb((sql) => sql`
    update ad_accounts set url_params = ${params || null} where id = ${accountId}`);
}

/* ---------- Brand Listener ---------- */

export function mentionsForClient(clientId) {
  return withDb((sql) => sql`
    select id, title, snippet, url, media_url, author, sentiment, tags, mtype, responded,
           published_at::text as published_at, created_at::text as created_at
    from mention_items
    where client_id = ${clientId}
    order by coalesce(published_at, created_at) desc
    limit 80`);
}

export function brandSourcesForClient(clientId) {
  return withDb((sql) => sql`
    select id, kind, label, url, query, provider, enabled,
           last_polled_at::text as last_polled_at
    from brand_sources where client_id = ${clientId}
    order by created_at desc`);
}

export function addBrandSource(d) {
  return withDb((sql) => sql`
    insert into brand_sources (client_id, kind, label, url, query, provider, enabled)
    values (${d.clientId}, ${d.kind || "rss"}, ${d.label || null}, ${d.url || null},
            ${d.query || null}, ${d.provider || null}, true)
    returning id`);
}

export function setBrandSourceEnabled(id, enabled) {
  return withDb((sql) => sql`update brand_sources set enabled = ${!!enabled} where id = ${id}`);
}

export function deleteBrandSource(id) {
  return withDb((sql) => sql`delete from brand_sources where id = ${id}`);
}

/* ---------- Brand settings (Repurpose Studio) ---------- */

export function brandSettings(clientId) {
  return withDb(async (sql) => {
    const [row] = await sql`select coalesce(brand_settings, '{}'::jsonb) as s from clients where id = ${clientId}`;
    return row?.s || {};
  });
}

export function setBrandSettings(clientId, settings) {
  return withDb((sql) => sql`
    update clients set brand_settings = ${JSON.stringify(settings || {})}::jsonb where id = ${clientId}`);
}

/* ---------- Agency notifications ---------- */

export function agencyNotifications() {
  return withDb(async (sql) => {
    const todos = await sql`
      select ci.id, c.name as client, ci.caption, ci.created_at::text as created_at
      from content_items ci join clients c on c.id = ci.client_id
      where ci.status = 'needs_approval'
      order by ci.created_at desc limit 30`;
    const failed = await sql`
      select ci.id, c.name as client, ci.error, ci.error_kind, ci.updated_at::text as created_at
      from content_items ci join clients c on c.id = ci.client_id
      where ci.status = 'failed'
      order by ci.updated_at desc limit 10`;
    const ruleEvents = await sql`
      select e.id, e.message, e.action_taken, e.created_at::text as created_at,
             a.id as account_id, c.name as client
      from rule_events e
      join ad_accounts a on a.id = e.account_id
      join clients c on c.id = a.client_id
      where e.acknowledged = false
      order by e.created_at desc limit 20`;
    const insights = await sql`
      select i.title, i.category, c.name as client, i.generated_at::text as created_at
      from insights i join clients c on c.id = i.client_id
      where i.category in ('issue','opportunity') and coalesce(i.dismissed,false) = false
      order by i.generated_at desc limit 12`;
    const overdue = await sql`
      select ci.id, c.name as client, ci.caption, ci.status,
             ci.scheduled_at::text as scheduled_at
      from content_items ci join clients c on c.id = ci.client_id
      where ci.status in ('draft','needs_approval')
        and ci.scheduled_at is not null and ci.scheduled_at < now()
      order by ci.scheduled_at asc limit 30`;
    return { todos, failed, ruleEvents, insights, overdue };
  });
}

export function accountCampaignsManaged(id, days) {
  return withDb((sql) => sql`
    select campaign_id,
           coalesce(campaign_name, '(unnamed)') as campaign,
           sum(spend)::float   as spend,
           sum(revenue)::float as revenue,
           sum(conversions)::float as conversions
    from daily_metrics
    where ad_account_id = ${id} and date >= current_date - ${days}::int and campaign_id is not null
    group by campaign_id, campaign_name
    having sum(spend) > 0
    order by sum(spend) desc`);
}

export function adWritesForAccount(id) {
  return withDb((sql) => sql`
    select action, target_type, target_id, status, source,
           payload, result, created_at::text as created_at
    from ad_writes
    where ad_account_id = ${id}
    order by created_at desc limit 25`);
}

export function setAccountCap(accountId, cap) {
  return withDb((sql) => sql`
    update ad_accounts set max_daily_budget = ${cap == null ? null : Number(cap)}
    where id = ${accountId}`);
}

/* ---------- Rules engine (Tier 4) ---------- */

export function rulesForAccount(id) {
  return withDb((sql) => sql`
    select id, name, metric, comparator, threshold::float as threshold,
           window_days, min_spend::float as min_spend, action, auto_apply, enabled,
           last_run_at::text as last_run_at, last_triggered_at::text as last_triggered_at
    from ad_rules
    where account_id = ${id}
    order by created_at desc`);
}

export function ruleEventsForAccount(id) {
  return withDb((sql) => sql`
    select e.id, e.campaign_name, e.message, e.action_taken, e.acknowledged,
           e.created_at::text as created_at, r.name as rule_name
    from rule_events e
    join ad_rules r on r.id = e.rule_id
    where e.account_id = ${id}
    order by e.created_at desc limit 40`);
}

export function createRule(r) {
  return withDb((sql) => sql`
    insert into ad_rules
      (account_id, name, metric, comparator, threshold, window_days, min_spend, action, auto_apply, enabled)
    values (${r.accountId}, ${r.name}, ${r.metric}, ${r.comparator}, ${Number(r.threshold)},
            ${Number(r.windowDays) || 3}, ${Number(r.minSpend) || 20}, ${r.action},
            ${!!r.autoApply}, true)
    returning id`);
}

export function setRuleEnabled(id, enabled) {
  return withDb((sql) => sql`update ad_rules set enabled = ${!!enabled} where id = ${id}`);
}

export function deleteRule(id) {
  return withDb((sql) => sql`delete from ad_rules where id = ${id}`);
}

export function acknowledgeEvent(id) {
  return withDb((sql) => sql`update rule_events set acknowledged = true where id = ${id}`);
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

/* ---------- Campaign Studio ---------- */

export function campaignPlanForClient(client) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select cp.summary, cp.materials, cp.campaigns, cp.generated_at::text as generated_at
      from campaign_plans cp
      join clients c on c.id = cp.client_id
      where c.name = ${client}
      order by cp.generated_at desc limit 1`;
    return row || null;
  });
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
