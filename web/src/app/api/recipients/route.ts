import { NextResponse } from "next/server";
import { RECIPIENTS } from "@/lib/config";
import { recipientKeys } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recipients + their on-chain ML-DSA-87 and ML-KEM-1024 keys, so the browser can verify each signed card itself. */
export async function GET() {
  try {
    const out = await Promise.all(RECIPIENTS.map(async (r) => ({ ...r, keys: await recipientKeys(r.address) })));
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
