import { NextResponse } from "next/server";
import { relay, fromB64 } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Relays an already-sealed envelope. The server never sees plaintext and recomputes the envelope hash itself.
 * Deliberately logs nothing about the request (no IP, no headers, no body).
 */
export async function POST(req: Request) {
  try {
    const { id, recipients, envelope } = (await req.json()) as { id?: string; recipients?: string[]; envelope?: string };
    if (!id || !/^0x[0-9a-fA-F]{64}$/.test(id) || !recipients?.length || !envelope) {
      return NextResponse.json({ error: "id (32-byte hex), recipients and envelope (base64) are required" }, { status: 400 });
    }
    const receipt = await relay(id as `0x${string}`, recipients, fromB64(envelope));
    return NextResponse.json(receipt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 500 });
  }
}
