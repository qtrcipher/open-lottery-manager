import { NextResponse } from "next/server";
import { checkDatabaseHealth, createHealthPayload } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const databaseStatus = await checkDatabaseHealth();
  const payload = createHealthPayload({ databaseStatus });

  return NextResponse.json(payload, {
    status: payload.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
