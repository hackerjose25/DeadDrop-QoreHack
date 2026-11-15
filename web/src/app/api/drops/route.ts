import { NextResponse } from "next/server";
import { dropsFor, resolveRecipient } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, still-encrypted drops for a recipient (anyone can read these — only the recipient can open them). */
export async function GET(req: Request) {
  const who = new URL(req.url).searchParams.get("recipient") || "";
  let evm: `0x${string}`;
  try { evm = (await resolveRecipient(who)).evm; }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 }); }
  try {
    return NextResponse.json(await dropsFor(evm));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 502 });
  }
}
