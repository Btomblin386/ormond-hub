import { NextResponse } from "next/server";
import { createRule, setRuleEnabled, deleteRule, acknowledgeEvent } from "../../../lib/db";

export const dynamic = "force-dynamic";

const METRICS = ["roas", "cpa", "spend", "conversions"];

export async function POST(req) {
  try {
    const body = await req.json();
    const op = body.op;

    if (op === "create") {
      if (!body.accountId || !body.name) return NextResponse.json({ error: "missing fields" }, { status: 400 });
      if (!METRICS.includes(body.metric)) return NextResponse.json({ error: "bad metric" }, { status: 400 });
      if (!["lt", "gt"].includes(body.comparator)) return NextResponse.json({ error: "bad comparator" }, { status: 400 });
      if (!["pause", "notify"].includes(body.action)) return NextResponse.json({ error: "bad action" }, { status: 400 });
      if (!(Number(body.threshold) >= 0)) return NextResponse.json({ error: "bad threshold" }, { status: 400 });
      const [row] = await createRule(body);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (op === "toggle") {
      await setRuleEnabled(body.id, body.enabled);
      return NextResponse.json({ ok: true });
    }
    if (op === "delete") {
      await deleteRule(body.id);
      return NextResponse.json({ ok: true });
    }
    if (op === "ack") {
      await acknowledgeEvent(body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
