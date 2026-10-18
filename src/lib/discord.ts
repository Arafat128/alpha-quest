export function discordGuildId(configured?: string | null) {
  return (configured || process.env.DISCORD_GUILD_ID || "").trim();
}

export function discordChannelId() {
  return (process.env.DISCORD_CHANNEL_ID || "1125705611942834268").trim();
}

export function discordInviteUrl() {
  return (process.env.DISCORD_INVITE_URL || process.env.NEXT_PUBLIC_DISCORD_INVITE || "").trim();
}
