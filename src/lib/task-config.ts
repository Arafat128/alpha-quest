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
    parsePath: "$.data.user.result.relationship_perspectives.following",
  },
];

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

export function userByScreenNameQueryId() {
  return (
    (typeof process !== "undefined" && process.env?.PRIMUS_X_FOLLOW_QUERY_ID) ||
    "Gb-d6r0vxPOADdG62OEBpQ"
  );
}

export function userByScreenNameUrl(handle: string): string {
  const screen = normalizeXHandle(handle);
  const variables = JSON.stringify({ screen_name: screen, withGrokTranslatedBio: false });
  return (
    `https://x.com/i/api/graphql/${userByScreenNameQueryId()}/UserByScreenName` +
    `?variables=${encodeURIComponent(variables)}` +
    `&features=${encodeURIComponent(JSON.stringify(USER_BY_SCREEN_NAME_FEATURES))}` +
    `&fieldToggles=${encodeURIComponent(JSON.stringify(USER_BY_SCREEN_NAME_FIELD_TOGGLES))}`
  );
}

export function swapScreenNameInUrl(url: string, handle: string): string {
  const screen = normalizeXHandle(handle);
  if (!screen) return url;
  if (!url) return userByScreenNameUrl(screen);
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("variables");
    if (raw) {
      const variables = JSON.parse(raw) as { screen_name?: string };
      if (variables && typeof variables === "object") {
        variables.screen_name = screen;
        parsed.searchParams.set("variables", JSON.stringify(variables));
        if (!parsed.searchParams.get("features")) {
          parsed.searchParams.set("features", JSON.stringify(USER_BY_SCREEN_NAME_FEATURES));
        }
        if (!parsed.searchParams.get("fieldToggles")) {
          parsed.searchParams.set("fieldToggles", JSON.stringify(USER_BY_SCREEN_NAME_FIELD_TOGGLES));
        }
        return parsed.toString();
      }
    }
  } catch {
    // fall through
  }
  return userByScreenNameUrl(screen);
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
      url: userByScreenNameUrl(screen),
      method: "GET",
      header: {},
      body: "",
    },
    responseResolves: X_FOLLOW_RESOLVES,
  };
}

export function defaultTemplateForTask(type: string, stored?: string | null) {
  if (stored && stored.trim()) return stored.trim();
  if (type === "X_FOLLOW") return process.env.PRIMUS_TEMPLATE_X_FOLLOW || null;
  if (type === "X_POST") return process.env.PRIMUS_TEMPLATE_X_POST || null;
  if (type === "DISCORD_JOIN") return process.env.PRIMUS_TEMPLATE_DISCORD_JOIN || null;
  return null;
}

/** Inject the admin's X handle into a Hub UserByScreenName attRequest before it is signed. */
export function retargetFollowAttRequest(attRequest: Record<string, unknown>, handle: string) {
  const screen = normalizeXHandle(handle);
  if (!screen) return attRequest;
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
    url: url ? swapScreenNameInUrl(url, screen) : userByScreenNameUrl(screen),
    method,
    header,
    body,
  };
  return attRequest;
}
