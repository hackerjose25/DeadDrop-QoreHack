import { NextResponse } from "next/server";
import { RECIPIENTS } from "@/lib/config";
import { dropsFor } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, still-encrypted drops for a recipient (anyone can read these — only the recipient can open them). */
export async function GET(req: Request) {
  const who = new URL(req.url).searchParams.get("recipient") || "";
  const r = RECIPIENTS.find((x) => x.id === who || x.address === who || x.evm.toLowerCase() === who.toLowerCase());
  if (!r) return NextResponse.json({ error: "unknown recipient" }, { status: 404 });
  try {
    return NextResponse.json(await dropsFor(r.evm));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 502 });
  }
}
