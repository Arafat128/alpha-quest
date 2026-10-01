const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const xFollowConfig = {
  handle: "example_owner",
  requiredField: "following",
  request: {
    url: "https://x.com/i/api/graphql/.*/UserByScreenName\\?.*",
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
      parsePath: "$.data.user.result.relationship_counts.following",
    },
  ],
};

const xPostConfig = {
  mention: "primus_labs",
  requiredField: "full_text",
  request: {
    url: "https://x.com/i/api/graphql/V7H0Ap3_Hh2FyS75OCZWGo/UserTweets?variables=" +
      encodeURIComponent(JSON.stringify({ count: 20, includePromotedContent: false })),
    method: "GET",
    header: {},
    body: "",
  },
  responseResolves: [
    { keyName: "full_text", parsePath: "$.data.user.result.timeline_v2.timeline.instructions[1].entries[0].content.itemContent.tweet_results.result.legacy.full_text" },
  ],
};

async function main() {
  const existing = await prisma.campaign.findUnique({ where: { slug: "genesis-attestation" } });
  if (existing) {
    console.log("Genesis campaign already exists", existing.id);
    return;
  }

  const campaign = await prisma.campaign.create({
    data: {
      slug: "genesis-attestation",
      title: "Genesis Attestation",
      description:
        "Complete real social actions. Follows and posts are proven with zkTLS — not a checkbox.",
      accent: "#38bdf8",
      startsAt: new Date(),
      tasks: {
        create: [
          {
            type: "X_FOLLOW",
            title: "Follow @example_owner on X",
            description:
              "Follow @example_owner on X. We verify the follow from your live X session.",
            primusTemplateId: process.env.PRIMUS_TEMPLATE_X_FOLLOW || null,
            config: JSON.stringify(xFollowConfig),
            points: 100,
            sortOrder: 1,
          },
          {
            type: "X_POST",
            title: "Mention Primus on X",
            description:
              "Post about the campaign on X. We verify a recent post from your session.",
            primusTemplateId: process.env.PRIMUS_TEMPLATE_X_POST || null,
            config: JSON.stringify(xPostConfig),
            points: 150,
            sortOrder: 2,
          },
          {
            type: "DISCORD_JOIN",
            title: "Join the campaign Discord",
            description:
              "Join the campaign Discord. Membership is checked against the official server.",
            primusTemplateId: process.env.PRIMUS_TEMPLATE_DISCORD_JOIN || null,
            config: JSON.stringify({
              guildId: process.env.DISCORD_GUILD_ID || "",
              requiredField: "id",
            }),
            points: 80,
            sortOrder: 3,
          },
          {
            type: "EMAIL_VERIFY",
            title: "Verify your email",
            description: "Confirm your email with a one-time code.",
            config: JSON.stringify({}),
            points: 40,
            sortOrder: 4,
          },
        ],
      },
    },
  });

  console.log("Seeded campaign", campaign.slug, campaign.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
