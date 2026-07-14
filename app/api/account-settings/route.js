import { NextResponse } from "next/server";
import { setAccountCap, setAccountUrlParams, renameClient, deleteSocialAccount, deleteGa4Property } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();

    // Disconnect a social identity (Page+IG pair) from its client.
    if (body.disconnectSocialId) {
      await deleteSocialAccount(body.disconnectSocialId);
      return NextResponse.json({ ok: true });
    }
    // Disconnect the client's GA4 property (data already ingested is kept).
    if (body.clientId && body.removeGa4) {
      await deleteGa4Property(body.clientId);
      return NextResponse.json({ ok: true });
    }

    // Rename a brand (clients.name is the display name across the hub; all
    // data links by client_id, so renaming is safe).
    if (body.clientId && typeof body.name === "string") {
      const name = body.name.trim();
      if (!name || name.length > 80) return NextResponse.json({ error: "name must be 1-80 characters" }, { status: 400 });
      await renameClient(body.clientId, name);
      return NextResponse.json({ ok: true, name });
    }

    const { accountId } = body;
    if (!accountId) return NextResponse.json({ error: "missing accountId" }, { status: 400 });

    if ("urlParams" in body) {
      let p = (body.urlParams || "").trim().replace(/^[?&]+/, "");
      if (p && !/^([\w.\-%]+=[^&]*)(&[\w.\-%]+=[^&]*)*$/.test(p)) {
        return NextResponse.json({ error: "Use key=value pairs joined by & (e.g. utm_source=facebook&utm_medium=paid)" }, { status: 400 });
      }
      await setAccountUrlParams(accountId, p || null);
      return NextResponse.json({ ok: true, urlParams: p || null });
    }

    const value = body.cap === "" || body.cap == null ? null : Number(body.cap);
    if (value != null && (!(value > 0) || value > 100000)) {
      return NextResponse.json({ error: "cap must be between 0 and 100000" }, { status: 400 });
    }
    await setAccountCap(accountId, value);
    return NextResponse.json({ ok: true, cap: value });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
