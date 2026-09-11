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

export function parseTaskConfig(raw: string): TaskConfig {
  try {
    const parsed = JSON.parse(raw) as TaskConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function defaultXFollowConfig(handle: string): TaskConfig {
  const screen = handle.replace(/^@/, "");
  return {
    handle: screen,
    requiredField: "following",
    request: {
      url: `https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=${encodeURIComponent(
        JSON.stringify({
          screen_name: screen,
          withGrokTranslatedBio: false,
        })
      )}`,
      method: "GET",
      header: {},
      body: "",
    },
    responseResolves: [
      {
        keyName: "screen_name",
        parsePath: "$.data.user.result.core.screen_name",
      },
      {
        keyName: "following",
        parsePath: "$.data.user.result.relationship_perspectives.following",
      },
    ],
  };
}
