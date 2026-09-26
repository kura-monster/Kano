require('dotenv').config();

const readline = require('readline');
const AIResponder = require('./ai-responder');
const { calcDelay, getJSTHour } = require('./ai-responder');
const { describeMedia } = require('./vision');
const AntiRaid = require('./anti-raid');
const db = require('./database');
const { loadEncryptedToken, hasEncryptedTokens } = require('./token-manager');

const config = {
  tokenMode: process.env.TOKEN_MODE || 'bot',
  boyfriendId: process.env.BOYFRIEND_USER_ID || '1486923873004945509',
  groqApiKeys: (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean),
  aiModel: process.env.AI_MODEL || 'qwen/qwen3.8-27b',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 10,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 5,
  muteDuration: parseInt(process.env.AUTO_MUTE_DURATION) || 300,
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer); });
  });
}

async function getToken() {
  if (hasEncryptedTokens()) {
    console.log('🔐 暗号化トークンが見つかりました。');
    const password = await ask('マスターパスワードを入力: ');
    const tokens = loadEncryptedToken(password);
    if (!tokens) { console.error('❌ パスワードが違います。'); process.exit(1); }
    console.log('✅ トークン復号OK');
    const token = config.tokenMode === 'user' ? tokens.userToken : tokens.botToken;
    if (!token) { console.error(`❌ ${config.tokenMode}トークン未保存`); process.exit(1); }
    return token;
  }
  const envToken = config.tokenMode === 'user'
    ? process.env.DISCORD_USER_TOKEN : process.env.DISCORD_BOT_TOKEN;
  if (!envToken || envToken.includes('your_')) {
    console.error('❌ トークン未設定。.envを確認するか npm run setup で暗号化保存。');
    process.exit(1);
  }
  return envToken;
}

function createClient(isUserToken) {
  if (isUserToken) {
    const { Client } = require('discord.js-selfbot-v13');
    return new Client({ checkUpdate: false });
  }
  const { Client, GatewayIntentBits, Partials } = require('discord.js');
  return new Client({
    intents: [
      GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel],
  });
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║    Rula 彼女Bot - カノムーブセルボ    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (config.groqApiKeys.length === 0 || config.groqApiKeys[0].includes('your_')) {
    console.error('❌ GROQ_API_KEY未設定');
    process.exit(1);
  }

  await db.init();

  const token = await getToken();
  const isUserToken = config.tokenMode === 'user';

  console.log(`📌 モード: ${isUserToken ? 'User Token' : 'Bot Token'}`);
  console.log(`💕 パートナーID: ${config.boyfriendId}`);
  console.log(`🧠 AIモデル: ${config.aiModel}`);
  console.log(`🔑 APIキー: ${config.groqApiKeys.length}個`);
  console.log(`👁️ Vision: ${config.geminiApiKey ? 'Gemini Flash ON' : 'OFF（GEMINI_API_KEYで有効化）'}`);

  const client = createClient(isUserToken);

  const ai = new AIResponder({
    groqApiKeys: config.groqApiKeys,
    aiModel: config.aiModel,
    boyfriendId: config.boyfriendId,
  });

  const antiRaid = new AntiRaid({
    rateLimitWindow: config.rateLimitWindow,
    rateLimitMax: config.rateLimitMax,
    muteDuration: config.muteDuration,
  });

  setInterval(() => antiRaid.cleanup(), 60000);

  // ━━━ 独り言 & 嫉妬トラッキング ━━━
  let lastBfChannel = null;
  let lastBfTime = 0;
  let lastJealousyTime = 0;

  client.once('ready', () => {
    const stats = db.getStats();
    console.log(`✅ ${client.user.tag} | ${client.guilds.cache.size}サーバー`);
    console.log(`📊 DB: ${stats.users}ユーザー / ${stats.messages}メッセージ`);
    console.log('─'.repeat(40));

    if (!isUserToken) {
      const { ActivityType } = require('discord.js');
      client.user.setPresence({
        activities: [{ name: `${ai.persona.identity.name}だよ♡`, type: ActivityType.Custom }],
        status: 'online',
      });
    }

    // ━━━ 独り言タイマー（10分ごとにチェック） ━━━
    setInterval(() => {
      if (!lastBfChannel) return;
      const h = getJSTHour();
      if (h >= 2 && h < 7) return;
      const elapsed = Date.now() - lastBfTime;
      if (elapsed > 30 * 60 * 1000 && elapsed < 3 * 60 * 60 * 1000) {
        if (Math.random() < 0.12) {
          const msg = ai.getHitorigoto();
          lastBfChannel.send(msg).catch(() => {});
          console.log(`[独り言] ${msg}`);
          lastBfTime = Date.now();
        }
      }
    }, 10 * 60 * 1000);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;
    if (message.author.bot && !isUserToken) return;

    const userId = message.author.id;
    const isBoyfriend = userId === config.boyfriendId;

    const isMentioned = message.content.includes(`<@${client.user.id}>`)
      || message.content.includes(`<@!${client.user.id}>`)
      || (!isUserToken && message.mentions?.has(client.user.id));
    const isDM = !message.guild;

    let isReplyToMe = false;
    if (message.reference?.messageId) {
      try {
        const ref = await message.channel.messages.fetch(message.reference.messageId);
        if (ref.author.id === client.user.id) isReplyToMe = true;
      } catch {}
    }

    // ━━━ 嫉妬システム ━━━
    if (isBoyfriend && message.guild) {
      lastBfChannel = message.channel;
      lastBfTime = Date.now();

      if (!isMentioned && !isDM && !isReplyToMe) {
        const now = Date.now();
        const h = getJSTHour();
        if (!(h >= 2 && h < 7) && now - lastJealousyTime > 5 * 60 * 1000 && Math.random() < 0.07) {
          lastJealousyTime = now;
          const jealousyMsg = ai.getJealousyResponse();
          setTimeout(() => {
            message.channel.send(jealousyMsg).catch(() => {});
            console.log(`[嫉妬] ${jealousyMsg}`);
          }, 2000 + Math.random() * 5000);
        }
        return;
      }
    }

    if (!isMentioned && !isDM && !isReplyToMe) return;

    if (!isBoyfriend) {
      const raidCheck = antiRaid.check(userId, message.content);
      if (raidCheck.blocked) {
        console.log(`[荒らし] ${message.author.tag} → ${raidCheck.reason}`);
        try { await message.reply(raidCheck.message); } catch {}
        return;
      }
    }

    let userMessage = message.content.replace(/<@!?\d+>/g, '').trim();

    if (isBoyfriend) {
      if (userMessage === '!reload') {
        ai.reloadPersona();
        await message.reply('ペルソナ再読み込みしたよ♡');
        return;
      }
      if (userMessage === '!stats') {
        const s = db.getStats();
        await message.reply(`📊 ${s.users}人 / ${s.messages}メッセージ`);
        return;
      }
      if (userMessage.startsWith('!memo ')) {
        const note = userMessage.slice(6).trim();
        const targetId = message.mentions.users?.first()?.id || userId;
        db.setUserNotes(targetId, note);
        await message.reply(`メモ保存したよ♡`);
        return;
      }
      if (userMessage === '!clear') {
        db.clearHistory(userId);
        await message.reply('会話履歴リセットしたよ♡');
        return;
      }
    }

    if (!userMessage) userMessage = '(名前だけ呼んだ)';

    const logPrefix = isBoyfriend ? '💕' : '🧊';
    console.log(`${logPrefix} [${message.author.tag}] ${userMessage}`);

    // 添付ファイル情報を取得（Collection→Array変換）
    const attachments = [];
    if (message.attachments && message.attachments.size > 0) {
      message.attachments.forEach(a => {
        attachments.push({ name: a.name || '', contentType: a.contentType || '', url: a.url || '' });
      });
    }
    if (message.embeds && message.embeds.length > 0) {
      for (const e of message.embeds) {
        if (e.image) attachments.push({ name: 'embed_image', contentType: 'image/embed', url: e.image.url });
        if (e.thumbnail) attachments.push({ name: 'embed_thumb', contentType: 'image/embed', url: e.thumbnail.url });
      }
    }
    const hasImageAttach = attachments.some(a =>
      a.contentType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name)
    );
    if (attachments.length > 0) console.log(`  [添付] ${attachments.map(a => `${a.name}(${a.contentType})`).join(', ')}`);

    // ━━━ Gemini Visionで画像/GIF/動画サムネを解析 ━━━
    let mediaDescription = '';
    if (attachments.length > 0 || (message.embeds && message.embeds.length > 0)) {
      mediaDescription = await describeMedia(attachments, message.embeds || [], config.geminiApiKey);
      if (mediaDescription) console.log(`  [Vision] ${mediaDescription}`);
    }

    if (hasImageAttach && !userMessage.startsWith('(画像')) {
      userMessage = mediaDescription
        ? `(画像:${mediaDescription})${userMessage}`
        : `(画像)${userMessage}`;
    } else if (!hasImageAttach && mediaDescription) {
      userMessage = `(メディア:${mediaDescription})${userMessage}`;
    }

    try { await message.channel.sendTyping(); } catch {}
    const typingLoop = setInterval(() => { try { message.channel.sendTyping(); } catch {} }, 7000);

    const delay = calcDelay(isBoyfriend, userMessage.length);
    await new Promise(r => setTimeout(r, delay));

    let response;
    try {
      response = await ai.generateResponse(userId, userMessage, message.author.username, message.channel.id, attachments, mediaDescription);
    } finally {
      clearInterval(typingLoop);
    }

    // ━━━ レスポンスタイプ別ハンドリング ━━━
    const actions = ai.getPendingActions();

    // アクション処理（リアクション系）
    for (const action of actions) {
      try {
        if (action.action === 'react') {
          await message.react(action.emoji);
        } else if (action.action === 'multi_react') {
          for (const emoji of action.emojis) { await message.react(emoji); }
        }
      } catch (e) { console.log(`[React失敗] ${e.message}`); }
    }

    switch (response.type) {
      case 'sleep':
        console.log('  → [寝落ち] 返信なし');
        break;

      case 'ignore':
        console.log(`  → [既読スルー] ${response.emoji || '無反応'}`);
        if (response.emoji) {
          try { await message.react(response.emoji); } catch {}
        }
        break;

      case 'emoji':
        console.log(`  → [スタンプ] ${response.emoji}`);
        try { await message.react(response.emoji); } catch {}
        break;

      case 'multi':
        console.log(`  → [連投] ${response.messages.join(' / ')}`);
        try {
          await message.reply({ content: response.messages[0], allowedMentions: { repliedUser: isBoyfriend } });
          for (let i = 1; i < response.messages.length; i++) {
            await new Promise(r => setTimeout(r, 600 + Math.random() * 1500));
            try { await message.channel.sendTyping(); } catch {}
            await new Promise(r => setTimeout(r, 300 + Math.random() * 800));
            await message.channel.send(response.messages[i]);
          }
        } catch {
          try { await message.channel.send(response.messages.join('\n')); } catch {}
        }
        break;

      case 'normal':
      default: {
        const reply = response.text;
        console.log(`  → ${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}`);
        try {
          await message.reply({ content: reply, allowedMentions: { repliedUser: isBoyfriend } });
        } catch {
          try { await message.channel.send(reply); } catch {}
        }
        break;
      }
    }

    // フォローアップ系アクション
    for (const action of actions) {
      try {
        if (action.action === 'followup') {
          setTimeout(async () => {
            try { await message.channel.send(action.message); } catch {}
          }, action.delay);
        } else if (action.action === 'multi_followup') {
          for (const m of action.messages) {
            setTimeout(async () => {
              try { await message.channel.send(m.text); } catch {}
            }, m.delay);
          }
        } else if (action.action === 'nickname' && message.member) {
          await message.member.setNickname(action.nickname);
        } else if (action.action === 'pin') {
          await message.pin();
        } else if (action.action === 'thread' && message.channel.threads) {
          await message.startThread({ name: action.name });
        } else if (action.action === 'timeout' && message.member && !isBoyfriend) {
          await message.member.timeout(action.duration * 60000, action.reason);
        } else if (action.action === 'status' && isUserToken) {
          client.user.setPresence({ activities: [{ name: action.status }], status: action.type || 'online' });
        }
      } catch (e) { console.log(`[Action失敗] ${action.action}: ${e.message}`); }
    }
  });

  client.on('error', (e) => console.error('[Discord]', e.message));

  process.on('SIGINT', () => {
    console.log('\n👋 停止中...');
    db.close();
    client.destroy();
    process.exit(0);
  });

  try {
    await client.login(token);
  } catch (err) {
    console.error('❌ ログイン失敗:', err.message);
    process.exit(1);
  }
}

main();
