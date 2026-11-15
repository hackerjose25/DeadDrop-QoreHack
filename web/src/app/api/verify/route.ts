import { NextResponse } from "next/server";
import { verifyReceipt } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proof of Silence: does the chain hold exactly this (submissionId, envelopeSha3)? */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get("id") || "", sha3 = p.get("sha3") || "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(id) || !/^0x[0-9a-fA-F]{64}$/.test(sha3)) return NextResponse.json({ error: "id and sha3 must be 32-byte hex" }, { status: 400 });
  try {
    return NextResponse.json(await verifyReceipt(id as `0x${string}`, sha3 as `0x${string}`));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 502 });
  }
}
