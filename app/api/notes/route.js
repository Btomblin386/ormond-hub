import { NextResponse } from "next/server";
import {
  createNoteGroup, updateNoteGroup, moveNoteGroup, deleteNoteGroup,
  createNoteItem, patchNoteItem, setNoteItemDetails, reorderNoteItems,
  deleteNoteItem, ackNoteReminder,
} from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const b = await req.json();

    if (b.op === "add_group") {
      if (!b.clientId || !String(b.name || "").trim()) return NextResponse.json({ error: "missing clientId/name" }, { status: 400 });
      const [row] = await createNoteGroup(b.clientId, String(b.name).trim(), b.color);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (b.op === "update_group") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await updateNoteGroup(b.id, { name: b.name, color: b.color, collapsed: b.collapsed });
      return NextResponse.json({ ok: true });
    }
    if (b.op === "move_group") {
      if (!b.id || ![1, -1].includes(b.dir)) return NextResponse.json({ error: "bad args" }, { status: 400 });
      await moveNoteGroup(b.id, b.dir);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "delete_group") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await deleteNoteGroup(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "add_item") {
      if (!b.groupId || !b.clientId || !String(b.name || "").trim()) return NextResponse.json({ error: "missing args" }, { status: 400 });
      const [row] = await createNoteItem({ groupId: b.groupId, clientId: b.clientId, name: String(b.name).trim() });
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (b.op === "patch_item") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      if (b.status && !["none", "working", "stuck", "done"].includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
      await patchNoteItem(b.id, { name: b.name, status: b.status });
      return NextResponse.json({ ok: true });
    }
    if (b.op === "item_details") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await setNoteItemDetails(b.id, { body: b.body, dueAt: b.dueAt, remindAt: b.remindAt, assignedTo: b.assignedTo });
      return NextResponse.json({ ok: true });
    }
    if (b.op === "reorder") {
      if (!b.groupId || !Array.isArray(b.ids)) return NextResponse.json({ error: "bad args" }, { status: 400 });
      await reorderNoteItems(b.groupId, b.ids);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "delete_item") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await deleteNoteItem(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "remind_ack") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await ackNoteReminder(b.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
