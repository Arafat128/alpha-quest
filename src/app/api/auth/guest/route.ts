import { NextResponse } from "next/server";
import { boundAddress } from "@/lib/identity";
import { ensureGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await ensureGuest();
  return NextResponse.json({
    user: {
      id: user.id,
      boundAddress: boundAddress(user.id, user.walletAddress),
    },
  });
}
