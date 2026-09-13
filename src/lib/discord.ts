export function discordBotToken() {
  return (process.env.DISCORD_BOT_TOKEN || "").trim();
}

export function discordGuildId(configured?: string | null) {
  return (configured || process.env.DISCORD_GUILD_ID || "").trim();
}

export function discordInviteUrl() {
  return (process.env.DISCORD_INVITE_URL || process.env.NEXT_PUBLIC_DISCORD_INVITE || "").trim();
}

export async function fetchDiscordMember(guildId: string, userId: string) {
  const token = discordBotToken();
  if (!token) return { ok: false as const, error: "Discord bot is not configured" };

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (res.status === 404) {
    return {
      ok: false as const,
      error: "Join the campaign Discord server first, then click Verify.",
    };
  }
  if (res.status === 401) {
    return { ok: false as const, error: "Discord bot token is invalid." };
  }
  if (res.status === 403) {
    return {
      ok: false as const,
      error:
        "Invite the bot to that server and enable Server Members Intent in the Discord developer portal.",
    };
  }
  if (!res.ok) {
    return { ok: false as const, error: "Could not check Discord membership. Try again." };
  }
  const json = (await res.json()) as { roles?: string[] };
  return { ok: true as const, roles: json.roles || [] };
}
