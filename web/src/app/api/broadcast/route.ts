import { NextResponse } from "next/server";
import { broadcastSigned, fromB64 } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Forwards a tx the user signed in their own browser (keys never reach us). Only ML-KEM key registrations pass. */
export async function POST(req: Request) {
  try {
    const { tx } = (await req.json()) as { tx?: string };
    if (!tx || tx.length > 64_000) return NextResponse.json({ error: "tx (base64) required" }, { status: 400 });
    return NextResponse.json(await broadcastSigned(fromB64(tx)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
