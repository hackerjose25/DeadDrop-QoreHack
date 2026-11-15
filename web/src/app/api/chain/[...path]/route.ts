import { NextResponse } from "next/server";
import { REST } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only GET proxy to the public QoreChain REST API (it sends no CORS headers), limited to the modules the browser needs.
const ALLOWED = /^(cosmos\/(auth|bank)\/v1beta1|qorechain\/[a-z]+\/v1|cosmos\/base\/tendermint\/v1beta1)\//;

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.map(encodeURIComponent).join("/");
  if (!ALLOWED.test(path + "/")) return NextResponse.json({ error: "path not allowed" }, { status: 403 });
  const url = `${REST}/${path}${new URL(req.url).search}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok || r.status < 500) return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
    } catch { /* testnet drops requests — retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
}
