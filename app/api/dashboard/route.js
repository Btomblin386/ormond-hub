import { NextResponse } from "next/server";
import { addDashboardWidget, updateDashboardWidget, moveDashboardWidget, deleteDashboardWidget } from "../../../lib/db";
import { SOURCES, VIZZES } from "../../../lib/metrics";

export const dynamic = "force-dynamic";

// Mutations only (agency/manager via middleware). Dashboard data itself is
// server-rendered on the page, which is how the read-only client portal sees it.
export async function POST(req) {
  try {
    const b = await req.json();

    if (b.op === "add_widget") {
      if (!b.dashboardId || !SOURCES[b.source]?.metrics?.[b.metricKey]) return NextResponse.json({ error: "bad source/metric" }, { status: 400 });
      if (!VIZZES.includes(b.viz)) return NextResponse.json({ error: "bad viz" }, { status: 400 });
      const [row] = await addDashboardWidget({
        dashboardId: b.dashboardId, section: b.section, source: b.source, metricKey: b.metricKey,
        viz: b.viz, title: b.title, daysOverride: b.daysOverride, config: { w: b.w === 2 ? 2 : 1 },
      });
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (b.op === "update_widget") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      if (b.viz && !VIZZES.includes(b.viz)) return NextResponse.json({ error: "bad viz" }, { status: 400 });
      await updateDashboardWidget(b.id, {
        section: b.section, viz: b.viz, title: b.title, daysOverride: b.daysOverride,
        config: { w: b.w === 2 ? 2 : 1 },
      });
      return NextResponse.json({ ok: true });
    }
    if (b.op === "move_widget") {
      if (!b.id || ![1, -1].includes(b.dir)) return NextResponse.json({ error: "bad args" }, { status: 400 });
      await moveDashboardWidget(b.id, b.dir);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "delete_widget") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await deleteDashboardWidget(b.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
