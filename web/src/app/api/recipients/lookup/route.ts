import { NextResponse } from "next/server";
import { resolveRecipient } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Any registered recipient by curated id or QoreChain address (qor1… / 0x…), with its on-chain keys. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("address") || "";
  try { return NextResponse.json(await resolveRecipient(q)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 }); }
}
