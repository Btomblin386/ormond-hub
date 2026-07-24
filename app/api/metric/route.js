import { NextResponse } from "next/server";
import { dashboardRaw } from "../../../lib/db";
import { SOURCES, computeWidget, computeBreakdown } from "../../../lib/metrics";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

const DAYS = [7, 30, 60, 90, 180, 365];

// Read-only single-metric compute for the drill-down modal. Client-portal
// logins may call it, but only for their own brand.
export async function POST(req) {
  try {
    const s = getSession();
    if (!s) return NextResponse.json({ error: "no session" }, { status: 401 });
    const b = await req.json();
    if (!b.clientId || !SOURCES[b.source]?.metrics?.[b.metricKey]) return NextResponse.json({ error: "bad args" }, { status: 400 });
    if (s.role === "client" && s.client_id !== b.clientId) return NextResponse.json({ error: "not your brand" }, { status: 403 });
    const days = DAYS.includes(Number(b.days)) ? Number(b.days) : 30;

    const raw = await dashboardRaw(b.clientId, days * 2 + 2);
    const widget = { id: "drill", section: "", source: b.source, metric_key: b.metricKey, viz: "line", title: null, days_override: days, config: {} };
    const data = computeWidget(widget, raw, days);
    const breakdown = computeBreakdown(b.source, b.metricKey, raw, days);
    return NextResponse.json({ ok: true, data, breakdown });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
