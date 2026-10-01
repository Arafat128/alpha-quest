import { NextResponse } from "next/server";
import { resolveXFollowTemplateId } from "@/lib/task-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    appId: process.env.NEXT_PUBLIC_PRIMUS_APP_ID || process.env.PRIMUS_APP_ID || "",
    followTemplateId: resolveXFollowTemplateId(null),
    discordInviteUrl: process.env.DISCORD_INVITE_URL || process.env.NEXT_PUBLIC_DISCORD_INVITE || "",
  });
}
