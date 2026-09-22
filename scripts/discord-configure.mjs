#!/usr/bin/env node
/*
 * Covert Discord bootstrapper.
 *
 * This is deliberately a small, idempotent REST configurator rather than a
 * long-running bot. It only creates missing roles/categories/channels; it
 * never deletes, renames, or changes existing Discord resources. Community
 * onboarding, announcement-channel enablement, and AutoMod remain explicit
 * owner actions in Discord's UI.
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

const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const READ_MESSAGE_HISTORY = 1n << 16n;
const STAFF_VIEW = String(VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY);

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
  if (!response.ok) fail(`Discord ${method} ${pathname} failed: ${safeMessage(payload, response.status)}`);
  return payload;
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
      'Enable Community, Rules Screening, Onboarding, and AutoMod in Discord Server Settings.',
      'Create or verify the announcements channel as an Announcement channel.',
      'Connect the GitHub repository to the announcements/release flow.',
      'Test with a non-staff account before publishing an invite.'
    ]
  }, null, 2));
}

async function applyPlan() {
  if (!guildId || !/^\d+$/.test(guildId)) fail('DISCORD_GUILD_ID must be a numeric guild ID');
  const guild = await discord('GET', `/guilds/${guildId}`);
  const existingRoles = await discord('GET', `/guilds/${guildId}/roles`);
  const existingChannels = await discord('GET', `/guilds/${guildId}/channels`);
  const created = { roles: [], categories: [], channels: [] };
  const roleByName = new Map(existingRoles.map(role => [String(role.name).toLowerCase(), role]));
  for (const name of ROLES) {
    if (roleByName.has(name.toLowerCase())) continue;
    const role = await discord('POST', `/guilds/${guildId}/roles`, { name, permissions: '0', hoist: false, mentionable: false });
    roleByName.set(name.toLowerCase(), role);
    created.roles.push(name);
  }
  const maintainer = roleByName.get('maintainer');
  const channelByKey = new Map(existingChannels.map(channel => [`${channel.parent_id ?? 'root'}:${String(channel.name).toLowerCase()}`, channel]));
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
      if (channelByKey.has(key)) continue;
      const createdChannel = await discord('POST', `/guilds/${guildId}/channels`, {
        name: channel.name,
        type: channel.type ?? 0,
        parent_id: parent.id
      });
      channelByKey.set(key, createdChannel);
      created.channels.push(`${category.name}/${channel.name}`);
    }
  }
  console.log(JSON.stringify({
    schema: 'covert.discord-configurator-result.v1',
    mode: 'apply',
    guild_id: guild.id,
    guild_name: guild.name,
    creates_only: true,
    created,
    manual_owner_steps: [
      'Enable Community, Rules Screening, Onboarding, and AutoMod in Discord Server Settings.',
      'Configure onboarding questions from the repository blueprint.',
      'Connect GitHub release announcements and test with a non-staff account.'
    ]
  }, null, 2));
}

if (plan) printPlan();
if (apply) await applyPlan();
