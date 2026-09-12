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

export function userByScreenNameUrl(handle: string): string {
  const screen = normalizeXHandle(handle);
  return (
    "https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=" +
    encodeURIComponent(JSON.stringify({ screen_name: screen, withGrokTranslatedBio: false }))
  );
}

export function swapScreenNameInUrl(url: string, handle: string): string {
  const screen = normalizeXHandle(handle);
  if (!screen || !url) return url;
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
    // fall through to a constructed UserByScreenName URL
  }
  if (/UserByScreenName/i.test(url)) return userByScreenNameUrl(screen);
  return url;
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
  if (existing && typeof existing === "object" && typeof (existing as { url?: unknown }).url === "string") {
    url = (existing as { url: string }).url;
  }
  attRequest.request = {
    url: url ? swapScreenNameInUrl(url, screen) : userByScreenNameUrl(screen),
    method: "GET",
    header: "",
    body: "",
  };
  attRequest.reponseResolve = X_FOLLOW_RESOLVES.map((item) => ({
    keyName: item.keyName,
    parseType: "",
    parsePath: item.parsePath,
  }));
  return attRequest;
}
