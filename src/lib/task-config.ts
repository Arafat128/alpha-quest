export type PrimusRequest = {
  url: string;
  method: string;
  header?: Record<string, string>;
  body?: string;
};

export type ResponseResolve = {
  keyName: string;
  parsePath: string;
};

export type TaskConfig = {
  handle?: string;
  mention?: string;
  guildId?: string;
  inviteUrl?: string;
  roleId?: string;
  requiredField?: string;
  request?: PrimusRequest;
  responseResolves?: ResponseResolve[];
};

export function normalizeXHandle(value?: string | null) {
  return (value || "").replace(/^@/, "").trim();
}

export function sameXHandle(a?: string | null, b?: string | null) {
  const left = normalizeXHandle(a).toLowerCase();
  const right = normalizeXHandle(b).toLowerCase();
  return Boolean(left && right && left === right);
}

export function parseTaskConfig(raw: string): TaskConfig {
  try {
    const parsed = JSON.parse(raw) as TaskConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const X_FOLLOW_RESOLVES: ResponseResolve[] = [
  {
    keyName: "screen_name",
    parsePath: "$.data.user.result.core.screen_name",
  },
  {
    keyName: "following",
    parsePath: "$.data.user.result.relationship_counts.following",
  },
];

// Hub template "fix user x". Request URL wildcards X's rotating GraphQL query id:
// https://x.com/i/api/graphql/.* /UserByScreenName\?.*
export const HUB_X_FOLLOW_TEMPLATE_ID = "674142ce-d852-4c1d-9ca3-3061ace98988";

// Hub template "X post mention". Captured on one profile; launch_page opens the logged-in user.
export const HUB_X_POST_TEMPLATE_ID = "32bcf006-68f7-4081-a3ab-774b2fa0bce4";

// Hub template "Discord server membership". Proves the user can read this Primus Labs channel.
export const HUB_DISCORD_TEMPLATE_ID = "18d209ca-2c22-436c-9d77-d16f10a145a8";

/** Older Hub templates that baked a query hash and fail with Primus 00013. */
export const STALE_X_FOLLOW_TEMPLATE_IDS = new Set([
  "771b3096-cccb-4c6f-bca8-86497ece202b",
]);

/**
 * Matcher Primus Hub uses for UserByScreenName. X rotates the GraphQL query
 * id and query string, so those segments must be `.*` / `\?.*`.
 */
export const USER_BY_SCREEN_NAME_REQUEST_PATTERN =
  "https://x.com/i/api/graphql/.*/UserByScreenName\\?.*";

// Profile Posts tab. X now calls UserOriginalsTimeline, not UserTweets.
export const USER_TWEETS_REQUEST_PATTERN =
  "https://x.com/i/api/graphql/.*/UserOriginalsTimeline\\?.*";

// Logged-in Discord user's server list or one server's member record.
export const DISCORD_MEMBER_REQUEST_PATTERN =
  "https://discord.com/api/.*/users/@me/guilds.*";

export function discordChannelUrl(guildId: string) {
  const channel = (process.env.DISCORD_CHANNEL_ID || "1125705611942834268").trim();
  return channel
    ? `https://discord.com/channels/${guildId}/${channel}`
    : `https://discord.com/channels/${guildId}`;
}

/** X GraphQL rejects UserByScreenName without these; missing them is Primus 00013. */
export const USER_BY_SCREEN_NAME_FEATURES = {
  hidden_profile_subscriptions_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  subscriptions_feature_can_gift_premium: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

export const USER_BY_SCREEN_NAME_FIELD_TOGGLES = {
  withPayments: false,
  withAuxiliaryUserLabels: true,
};

export function resolveXFollowTemplateId(stored?: string | null) {
  const envId = (process.env.PRIMUS_TEMPLATE_X_FOLLOW || "").trim();
  const id = (stored && stored.trim()) || envId || HUB_X_FOLLOW_TEMPLATE_ID;
  if (STALE_X_FOLLOW_TEMPLATE_IDS.has(id)) {
    if (envId && !STALE_X_FOLLOW_TEMPLATE_IDS.has(envId)) return envId;
    return HUB_X_FOLLOW_TEMPLATE_ID;
  }
  return id;
}

/** Turn a concrete UserByScreenName URL into the Hub regex matcher. */
export function wildcardUserByScreenNameUrl(url?: string | null) {
  if (!url) return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
  if (/\/i\/api\/graphql\/.*\/UserByScreenName/i.test(url)) {
    return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
  }
  return url;
}

/** Turn a concrete X GraphQL URL into a Hub regex matcher for that operation. */
export function wildcardXGraphqlUrl(url?: string | null) {
  if (!url) return url || "";
  const match = url.match(
    /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)(?:\?.*)?$/i
  );
  if (!match) return url;
  const operation = match[1];
  if (/^UserByScreenName$/i.test(operation)) return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
  if (/^UserTweets$/i.test(operation) || /^UserOriginalsTimeline$/i.test(operation)) {
    return USER_TWEETS_REQUEST_PATTERN;
  }
  return `https://x.com/i/api/graphql/.*/${operation}\\?.*`;
}

/** Profile tab Primus should open. Follow quests use the target; post quests use the logged-in user. */
export function dataSourceHandle(
  type: string,
  config: TaskConfig,
  userHandle?: string | null
) {
  if (type === "X_FOLLOW") return normalizeXHandle(config.handle);
  if (type === "X_POST") return normalizeXHandle(userHandle);
  return normalizeXHandle(config.handle) || normalizeXHandle(userHandle);
}

export function userByScreenNameUrl(_handle?: string): string {
  return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
}

export function swapScreenNameInUrl(url: string, handle: string): string {
  const screen = normalizeXHandle(handle);
  if (!screen) return wildcardUserByScreenNameUrl(url);
  if (!url) return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
  if (/\/i\/api\/graphql\//i.test(url) && /UserByScreenName/i.test(url)) {
    return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
  }
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("variables");
    if (raw) {
      const variables = JSON.parse(raw) as { screen_name?: string };
      if (variables && typeof variables === "object") {
        variables.screen_name = screen;
        parsed.searchParams.set("variables", JSON.stringify(variables));
        return parsed.toString();
      }
    }
  } catch {
    // fall through
  }
  return USER_BY_SCREEN_NAME_REQUEST_PATTERN;
}

export function xHandleFromRequestUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("variables");
    if (raw) {
      const variables = JSON.parse(raw) as { screen_name?: string };
      const screen = normalizeXHandle(variables?.screen_name);
      if (screen) return screen;
    }
  } catch {
    // ignore
  }
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/"screen_name"\s*:\s*"([A-Za-z0-9_]+)"/);
    if (match?.[1]) return match[1];
  } catch {
    // ignore
  }
  const encoded = String(url).match(/screen_name(?:%22|")\s*(?:%3A|:)\s*(?:%22|")([A-Za-z0-9_]+)/i);
  return encoded?.[1] || null;
}

export function defaultXFollowConfig(handle: string): TaskConfig {
  const screen = normalizeXHandle(handle);
  return {
    handle: screen,
    requiredField: "following",
    request: {
      url: USER_BY_SCREEN_NAME_REQUEST_PATTERN,
      method: "GET",
      header: {},
      body: "",
    },
    responseResolves: X_FOLLOW_RESOLVES,
  };
}

export function defaultTemplateForTask(type: string, stored?: string | null) {
  if (type === "X_FOLLOW") return resolveXFollowTemplateId(stored);
  if (type === "X_POST") {
    return (process.env.PRIMUS_TEMPLATE_X_POST || "").trim() || HUB_X_POST_TEMPLATE_ID;
  }
  if (type === "DISCORD_JOIN" || type === "DISCORD_ROLE") {
    return (
      (process.env.PRIMUS_TEMPLATE_DISCORD_JOIN || "").trim() ||
      (process.env.PRIMUS_TEMPLATE_DISCORD_ROLE || "").trim() ||
      HUB_DISCORD_TEMPLATE_ID
    );
  }
  if (stored && stored.trim()) return stored.trim();
  return null;
}

/** Align a Hub UserByScreenName attRequest with the wildcard matcher before it is signed. */
export function retargetFollowAttRequest(attRequest: Record<string, unknown>, handle: string) {
  const screen = normalizeXHandle(handle);
  const existing = attRequest.request;
  let url = "";
  let header = "";
  let body = "";
  let method = "GET";
  if (existing && typeof existing === "object") {
    const req = existing as { url?: unknown; header?: unknown; body?: unknown; method?: unknown };
    if (typeof req.url === "string") url = req.url;
    if (typeof req.header === "string") header = req.header;
    if (typeof req.body === "string") body = req.body;
    if (typeof req.method === "string" && req.method) method = req.method;
  }
  attRequest.request = {
    url: wildcardUserByScreenNameUrl(url),
    method,
    header,
    body,
  };
  if (screen && typeof attRequest.additionParams === "string") {
    try {
      const extra = JSON.parse(attRequest.additionParams) as Record<string, unknown>;
      extra.handle = screen;
      attRequest.additionParams = JSON.stringify(extra);
    } catch {
      // leave additionParams as-is
    }
  }
  return attRequest;
}
