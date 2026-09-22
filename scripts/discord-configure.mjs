#!/usr/bin/env node
/*
 * Covert Discord bootstrapper.
 *
 * This is deliberately a small, idempotent REST configurator rather than a
 * long-running bot. It only creates missing roles/categories/channels/rules
 * and initializes empty onboarding; it never deletes, renames, or changes
 * existing operator resources. Enabling Community remains owner-controlled.
 *
 * Required only for --apply (never commit or print the token):
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 */

const API = 'https://discord.com/api/v10';
const apply = process.argv.includes('--apply');
const plan = process.argv.includes('--plan') || !apply;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const applicationIdOverride = process.env.DISCORD_APPLICATION_ID;

const ADMINISTRATOR = 1n << 3n;
const MANAGE_CHANNELS = 1n << 4n;
const MANAGE_GUILD = 1n << 5n;
const MANAGE_ROLES = 1n << 28n;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const READ_MESSAGE_HISTORY = 1n << 16n;
const STAFF_VIEW = String(VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY);
const REQUIRED_PERMISSIONS = MANAGE_GUILD | MANAGE_CHANNELS | MANAGE_ROLES;
const REQUIRED_PERMISSION_NAMES = ['MANAGE_GUILD', 'MANAGE_CHANNELS', 'MANAGE_ROLES'];

const ROLES = ['Maintainer', 'Contributor', 'Tester', 'Early Adopter', 'Community'];
const CATEGORIES = [
  { name: 'START HERE', channels: [{ name: 'welcome' }, { name: 'rules' }, { name: 'announcements', type: 5 }, { name: 'releases' }] },
  { name: 'COVERT', channels: [{ name: 'covert-general' }, { name: 'help-and-questions' }, { name: 'feature-ideas' }, { name: 'show-your-build' }, { name: 'workflows-and-skills' }] },
  { name: 'DEVELOPMENT', channels: [{ name: 'contributors' }, { name: 'development' }, { name: 'bug-discussion' }, { name: 'documentation' }] },
  { name: 'COMMUNITY', channels: [{ name: 'introductions' }, { name: 'off-topic' }] },
  { name: 'STAFF', staffOnly: true, channels: [{ name: 'moderation' }, { name: 'community-ops' }] },
];

function fail(message) {
  throw new Error(message);
}

class DiscordApiError extends Error {
  constructor(method, pathname, status, payload) {
    super(`Discord ${method} ${pathname} failed`);
    this.name = 'DiscordApiError';
    this.method = method;
    this.pathname = pathname;
    this.status = status;
    this.code = payload?.code;
    this.payload = payload;
  }
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return {}; }
}

function safeMessage(payload, status) {
  const message = typeof payload?.message === 'string' ? payload.message : `HTTP ${status}`;
  return message.replace(/(Bot|Bearer)\s+[^\s,]+/gi, '$1 <redacted>').slice(0, 240);
}

async function discord(method, pathname, body) {
  if (!token) fail('DISCORD_BOT_TOKEN is required for --apply and was not read from source or artifacts');
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Covert-Discord-Configurator/0.1'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = parseJson(await response.text());
  if (!response.ok) throw new DiscordApiError(method, pathname, response.status, payload);
  return payload;
}

function errorSummary(error) {
  if (error instanceof DiscordApiError) {
    return {
      status: error.status,
      code: error.code ?? null,
      message: safeMessage(error.payload, error.status)
    };
  }
  return { message: String(error?.message ?? error).slice(0, 240) };
}

function botSummary(bot) {
  return {
    id: bot?.id ?? null,
    username: bot?.username ?? null,
    global_name: bot?.global_name ?? null,
    is_bot: Boolean(bot?.bot)
  };
}

function applicationSummary(application) {
  if (!application) return null;
  return {
    id: application.id ?? null,
    name: application.name ?? null,
    bot_public: application.bot_public ?? null
  };
}

function buildInstallUrl(applicationId) {
  if (!applicationId || !guildId) return null;
  const params = new URLSearchParams({
    client_id: String(applicationId),
    scope: 'bot applications.commands',
    permissions: String(REQUIRED_PERMISSIONS),
    guild_id: guildId,
    disable_guild_select: 'true'
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function permissionValue(value) {
  try { return BigInt(String(value ?? '0')); } catch { return 0n; }
}

function permissionBit(name) {
  if (name === 'MANAGE_GUILD') return MANAGE_GUILD;
  if (name === 'MANAGE_CHANNELS') return MANAGE_CHANNELS;
  if (name === 'MANAGE_ROLES') return MANAGE_ROLES;
  return 0n;
}

async function discoverIdentity() {
  const bot = await discord('GET', '/users/@me');
  let application = null;
  let application_error = null;
  try {
    application = await discord('GET', '/oauth2/applications/@me');
  } catch (error) {
    application_error = errorSummary(error);
  }

  let visibleGuilds = null;
  let visibleGuildsError = null;
  try {
    const guilds = await discord('GET', '/users/@me/guilds');
    visibleGuilds = Array.isArray(guilds)
      ? guilds.map(guild => ({ id: guild.id, name: guild.name }))
      : [];
  } catch (error) {
    visibleGuildsError = errorSummary(error);
  }

  const applicationId = application?.id ?? applicationIdOverride ?? null;
  return {
    bot,
    application,
    applicationId,
    visibleGuilds,
    application_error,
    visible_guilds_error: visibleGuildsError
  };
}

async function inspectPermissions(targetGuildId, botUserId, roles) {
  const member = await discord('GET', `/guilds/${targetGuildId}/members/${botUserId}`);
  const roleById = new Map(roles.map(role => [String(role.id), role]));
  let permissions = permissionValue(roleById.get(String(targetGuildId))?.permissions);
  for (const roleId of member.roles ?? []) {
    permissions |= permissionValue(roleById.get(String(roleId))?.permissions);
  }

  const administrator = (permissions & ADMINISTRATOR) !== 0n;
    const missing = administrator
    ? []
    : REQUIRED_PERMISSION_NAMES.filter(name => {
      return (permissions & permissionBit(name)) === 0n;
    });
  return {
    status: missing.length === 0 ? 'PASS' : 'INSUFFICIENT',
    effective_permissions: String(permissions),
    administrator,
    required_permissions: REQUIRED_PERMISSION_NAMES,
    missing_permissions: missing
  };
}

function isUnknownGuild(error) {
  return error instanceof DiscordApiError && (Number(error.code) === 10004 || error.status === 404);
}

function isCommunityRequirement(error) {
  return error instanceof DiscordApiError && Number(error.code) === 50035 && /community|announcement|guild feature/i.test(safeMessage(error.payload, error.status));
}

function printMissingGuild(identity) {
  const installUrl = buildInstallUrl(identity.applicationId);
  console.log(JSON.stringify({
    schema: 'covert.discord-configurator-diagnosis.v1',
    mode: 'apply',
    bot_auth: 'PASS',
    bot_user: botSummary(identity.bot),
    application: applicationSummary(identity.application),
    application_id: identity.applicationId,
    visible_guilds: identity.visibleGuilds ?? 'NOT_AVAILABLE_WITH_BOT_TOKEN',
    target_guild: { id: guildId, visible: false },
    root_cause: 'BOT_NOT_INSTALLED_IN_TARGET_GUILD',
    install_url_generated: Boolean(installUrl),
    install_url: installUrl,
    required_permissions: {
      names: REQUIRED_PERMISSION_NAMES,
      bitfield: String(REQUIRED_PERMISSIONS)
    },
    operator_action_required: installUrl
      ? 'Open install_url, select/authorize the target guild once, then rerun this command.'
      : 'Application ID is unavailable; provide only DISCORD_APPLICATION_ID, then rerun this command.',
    application_metadata_error: identity.application_error,
    visible_guilds_error: identity.visible_guilds_error
  }, null, 2));
  process.exitCode = 2;
}

function printPlan() {
  console.log(JSON.stringify({
    schema: 'covert.discord-configurator-plan.v1',
    mode: 'plan',
    network_accessed: false,
    credentials_read: false,
    creates_only: true,
    roles: ROLES,
    categories: CATEGORIES.map(category => ({
      name: category.name,
      staff_only: Boolean(category.staffOnly),
      channels: category.channels.map(channel => ({ name: channel.name, type: channel.type ?? 0 }))
    })),
    manual_owner_steps: [
      'Enable Community in Server Settings if the API reports that the guild is not a Community guild.',
      'Run the command again after any owner-only Community change.'
    ]
  }, null, 2));
}

async function ensureAutoModeration(targetGuildId) {
  let existing;
  try {
    existing = await discord('GET', `/guilds/${targetGuildId}/auto-moderation/rules`);
  } catch (error) {
    return { status: 'DEFERRED', reason: 'AUTOMOD_API_UNAVAILABLE_OR_PERMISSION', error: errorSummary(error), created: [], existing: [] };
  }

  const specs = [
    {
      name: 'Covert Anti-Spam',
      event_type: 1,
      trigger_type: 3,
      trigger_metadata: {},
      actions: [{ type: 1, metadata: { custom_message: 'Please slow down and avoid repeated messages.' } }],
      enabled: true
    },
    {
      name: 'Covert Mention Guard',
      event_type: 1,
      trigger_type: 5,
      trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true },
      actions: [{ type: 1, metadata: { custom_message: 'Please avoid mass mentions.' } }],
      enabled: true
    }
  ];
  const created = [];
  for (const spec of specs) {
    const alreadyConfigured = existing.find(rule => Number(rule.trigger_type) === spec.trigger_type);
    if (alreadyConfigured) continue;
    await discord('POST', `/guilds/${targetGuildId}/auto-moderation/rules`, spec);
    created.push(spec.name);
  }
  return {
    status: 'PASS',
    created,
    existing: existing.map(rule => ({ id: rule.id, name: rule.name, trigger_type: rule.trigger_type, enabled: rule.enabled }))
  };
}

function channelId(configuredChannels, categoryName, channelName) {
  return configuredChannels.get(`${categoryName}/${channelName}`)?.id ?? null;
}

async function ensureOnboarding(targetGuildId, guild, configuredChannels, roleByName) {
  if (!Array.isArray(guild.features) || !guild.features.includes('COMMUNITY')) {
    return { status: 'DEFERRED', reason: 'COMMUNITY_FEATURE_REQUIRED' };
  }

  let current;
  try {
    current = await discord('GET', `/guilds/${targetGuildId}/onboarding`);
  } catch (error) {
    return { status: 'DEFERRED', reason: 'ONBOARDING_API_UNAVAILABLE_OR_PERMISSION', error: errorSummary(error) };
  }
  if (current?.enabled || (Array.isArray(current?.prompts) && current.prompts.length > 0)) {
    return { status: 'EXISTING_UNCHANGED', enabled: Boolean(current.enabled), prompt_count: current.prompts?.length ?? 0 };
  }

  const defaultChannelPaths = [
    ['START HERE', 'welcome'],
    ['START HERE', 'rules'],
    ['START HERE', 'releases'],
    ['COVERT', 'covert-general'],
    ['COVERT', 'help-and-questions'],
    ['COVERT', 'feature-ideas'],
    ['COVERT', 'show-your-build']
  ];
  const defaultChannelIds = defaultChannelPaths
    .map(([category, name]) => channelId(configuredChannels, category, name))
    .filter(Boolean);
  if (defaultChannelIds.length < 7) {
    return { status: 'DEFERRED', reason: 'ONBOARDING_REQUIRES_SEVEN_DEFAULT_CHANNELS', default_channel_count: defaultChannelIds.length };
  }

  const options = [
    {
      title: 'Use Covert',
      description: 'Get started with Covert and ask product questions.',
      role_ids: roleByName.get('community')?.id ? [roleByName.get('community').id] : [],
      channel_ids: [
        channelId(configuredChannels, 'COVERT', 'covert-general'),
        channelId(configuredChannels, 'COVERT', 'help-and-questions')
      ].filter(Boolean),
      emoji_name: '🛠️'
    },
    {
      title: 'Contribute',
      description: 'Follow development and contribute code or documentation.',
      role_ids: roleByName.get('contributor')?.id ? [roleByName.get('contributor').id] : [],
      channel_ids: [
        channelId(configuredChannels, 'DEVELOPMENT', 'contributors'),
        channelId(configuredChannels, 'DEVELOPMENT', 'development'),
        channelId(configuredChannels, 'DEVELOPMENT', 'documentation')
      ].filter(Boolean),
      emoji_name: '🧩'
    },
    {
      title: 'Test models and workflows',
      description: 'Help test releases, local models, and Skills.',
      role_ids: roleByName.get('tester')?.id ? [roleByName.get('tester').id] : [],
      channel_ids: [
        channelId(configuredChannels, 'DEVELOPMENT', 'bug-discussion'),
        channelId(configuredChannels, 'COVERT', 'workflows-and-skills')
      ].filter(Boolean),
      emoji_name: '🧪'
    },
    {
      title: 'Follow releases',
      description: 'Receive release and project updates.',
      role_ids: [],
      channel_ids: [channelId(configuredChannels, 'START HERE', 'releases')].filter(Boolean),
      emoji_name: '📣'
    }
  ];

  const result = await discord('PUT', `/guilds/${targetGuildId}/onboarding`, {
    prompts: [{
      type: 0,
      title: 'What brings you to Covert?',
      options,
      single_select: false,
      required: false,
      in_onboarding: true
    }],
    default_channel_ids: defaultChannelIds,
    enabled: true,
    mode: 0
  });
  return { status: 'PASS', enabled: Boolean(result.enabled), prompt_count: result.prompts?.length ?? 1 };
}

async function applyPlan() {
  if (!guildId || !/^\d+$/.test(guildId)) fail('DISCORD_GUILD_ID must be a numeric guild ID');
  const identity = await discoverIdentity();
  let guild;
  try {
    guild = await discord('GET', `/guilds/${guildId}`);
  } catch (error) {
    if (isUnknownGuild(error)) {
      printMissingGuild(identity);
      return;
    }
    throw error;
  }
  const existingRoles = await discord('GET', `/guilds/${guildId}/roles`);
  const existingChannels = await discord('GET', `/guilds/${guildId}/channels`);
  const permissionCheck = await inspectPermissions(guildId, identity.bot.id, existingRoles);
  if (permissionCheck.status !== 'PASS') {
    const installUrl = buildInstallUrl(identity.applicationId);
    console.log(JSON.stringify({
      schema: 'covert.discord-configurator-diagnosis.v1',
      mode: 'apply',
      bot_auth: 'PASS',
      bot_user: botSummary(identity.bot),
      application: applicationSummary(identity.application),
      application_id: identity.applicationId,
      target_guild: { id: guild.id, name: guild.name, visible: true },
      root_cause: 'BOT_INSUFFICIENT_PERMISSIONS',
      permissions: permissionCheck,
      install_url_generated: Boolean(installUrl),
      install_url: installUrl,
      operator_action_required: installUrl
        ? 'Reauthorize the bot with the generated least-privilege permissions, then rerun this command.'
        : 'Grant the listed permissions to the bot, then rerun this command.'
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const created = { roles: [], categories: [], channels: [], deferred: [] };
  const roleByName = new Map(existingRoles.map(role => [String(role.name).toLowerCase(), role]));
  for (const name of ROLES) {
    if (roleByName.has(name.toLowerCase())) continue;
    const role = await discord('POST', `/guilds/${guildId}/roles`, { name, permissions: '0', hoist: false, mentionable: false });
    roleByName.set(name.toLowerCase(), role);
    created.roles.push(name);
  }
  const maintainer = roleByName.get('maintainer');
  const channelByKey = new Map(existingChannels.map(channel => [`${channel.parent_id ?? 'root'}:${String(channel.name).toLowerCase()}`, channel]));
  const configuredChannels = new Map();
  for (const category of CATEGORIES) {
    let parent = existingChannels.find(channel => channel.type === 4 && channel.parent_id === null && channel.name.toLowerCase() === category.name.toLowerCase());
    if (!parent) {
      const body = { name: category.name, type: 4 };
      if (category.staffOnly && maintainer) {
        body.permission_overwrites = [
          { id: guild.id, type: 0, deny: String(VIEW_CHANNEL) },
          { id: maintainer.id, type: 0, allow: STAFF_VIEW }
        ];
      }
      parent = await discord('POST', `/guilds/${guildId}/channels`, body);
      existingChannels.push(parent);
      created.categories.push(category.name);
    }
    for (const channel of category.channels) {
      const key = `${parent.id}:${channel.name.toLowerCase()}`;
      if (channelByKey.has(key)) {
        configuredChannels.set(`${category.name}/${channel.name}`, channelByKey.get(key));
        continue;
      }
      let createdChannel;
      try {
        createdChannel = await discord('POST', `/guilds/${guildId}/channels`, {
          name: channel.name,
          type: channel.type ?? 0,
          parent_id: parent.id
        });
      } catch (error) {
        if (channel.type === 5 && isCommunityRequirement(error)) {
          created.deferred.push({
            resource: `${category.name}/${channel.name}`,
            reason: 'COMMUNITY_FEATURE_REQUIRED'
          });
          continue;
        }
        throw error;
      }
      channelByKey.set(key, createdChannel);
      configuredChannels.set(`${category.name}/${channel.name}`, createdChannel);
      created.channels.push(`${category.name}/${channel.name}`);
    }
  }

  let automod;
  try {
    automod = await ensureAutoModeration(guildId);
  } catch (error) {
    automod = { status: 'DEFERRED', reason: 'AUTOMOD_CONFIGURATION_FAILED', error: errorSummary(error), created: [], existing: [] };
  }

  let onboarding;
  try {
    onboarding = await ensureOnboarding(guildId, guild, configuredChannels, roleByName);
  } catch (error) {
    onboarding = { status: 'DEFERRED', reason: 'ONBOARDING_CONFIGURATION_FAILED', error: errorSummary(error) };
  }
  const ownerActions = [];
  if (!guild.features?.includes('COMMUNITY')) ownerActions.push('Enable Community in Server Settings, then rerun the command.');
  if (created.deferred.some(item => item.reason === 'COMMUNITY_FEATURE_REQUIRED')) ownerActions.push('Enable Community in Server Settings, then rerun the command to create the announcement channel.');
  if (automod.status === 'DEFERRED' && automod.reason !== 'AUTOMOD_API_UNAVAILABLE_OR_PERMISSION') ownerActions.push('Review AutoMod availability in Server Settings, then rerun the command.');
  if (onboarding.status === 'DEFERRED') ownerActions.push('Review Community Onboarding availability in Server Settings, then rerun the command.');
  console.log(JSON.stringify({
    schema: 'covert.discord-configurator-result.v1',
    mode: 'apply',
    guild_id: guild.id,
    guild_name: guild.name,
    creates_only: true,
    created,
    automod,
    onboarding,
    owner_actions_required: [...new Set(ownerActions)]
  }, null, 2));
}

try {
  if (plan) printPlan();
  if (apply) await applyPlan();
} catch (error) {
  const apiError = error instanceof DiscordApiError;
  console.error(JSON.stringify({
    schema: 'covert.discord-configurator-diagnosis.v1',
    mode: 'apply',
    bot_auth: apiError && (error.status === 401 || error.status === 403) ? 'FAIL' : 'NOT_PROVEN',
    target_guild: { id: guildId ?? null, visible: false },
    root_cause: apiError && (error.status === 401 || error.status === 403)
      ? 'BOT_AUTHENTICATION_OR_AUTHORIZATION_FAILED'
      : 'CONFIGURATOR_ERROR',
    error: errorSummary(error)
  }, null, 2));
  process.exitCode = 1;
}
