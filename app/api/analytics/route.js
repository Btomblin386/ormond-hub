import { NextResponse } from "next/server";
import { accountRangeTotals, accountRangeTrend } from "../../../lib/db";

export const dynamic = "force-dynamic";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

// Quick-analytics window: totals + daily trend for a date range, plus the
// preceding equal-length range so the UI can show % change.
export async function POST(req) {
  try {
    const { clientId, from, to } = await req.json();
    if (!clientId || !from || !to) return NextResponse.json({ error: "missing clientId/from/to" }, { status: 400 });
    const start = new Date(from), end = new Date(to);
    if (isNaN(start) || isNaN(end) || start > end) return NextResponse.json({ error: "bad date range" }, { status: 400 });

    const len = Math.round((end - start) / DAY) + 1;
    const prevEnd = new Date(start.getTime() - DAY);
    const prevStart = new Date(prevEnd.getTime() - (len - 1) * DAY);

    const [totals, prev, trend] = await Promise.all([
      accountRangeTotals(clientId, iso(start), iso(end)),
      accountRangeTotals(clientId, iso(prevStart), iso(prevEnd)),
      accountRangeTrend(clientId, iso(start), iso(end)),
    ]);
    return NextResponse.json({ totals, prev, trend, prevRange: { from: iso(prevStart), to: iso(prevEnd) } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
