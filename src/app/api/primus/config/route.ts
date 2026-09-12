import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    appId: process.env.NEXT_PUBLIC_PRIMUS_APP_ID || process.env.PRIMUS_APP_ID || "",
  });
}
