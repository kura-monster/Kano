const db = require('./database');

const t = (name, desc, params = {}) => ({
  type: 'function',
  function: { name, description: desc, parameters: { type: 'object', properties: params, required: Object.keys(params).filter(k => !k.startsWith('_')) } },
});
const S = (desc) => ({ type: 'string', description: desc });
const N = (desc) => ({ type: 'number', description: desc });

const TOOL_DEFINITIONS = [
  // ━━━ 記憶系 ━━━
  t('remember', '相手について覚えておく（好み/出来事/約束/性格/癖/誕生日など）。黙って覚えろ、いちいち報告するな', { user_id: S('ユーザーID'), key: S('カテゴリ（好き/嫌い/趣味/誕生日/約束/出来事/癖/性格/家族/仕事/学校/その他）'), content: S('内容') }),
  t('recall', '相手について覚えてることを思い出す', { user_id: S('ユーザーID'), _query: S('検索ワード（省略で全部）') }),
  t('forget', '間違って覚えたことや古い情報を消す', { user_id: S('ユーザーID'), key: S('消すカテゴリ') }),
  t('remember_date', '大事な日を覚える（誕生日/記念日/約束の日）', { user_id: S('ユーザーID'), date: S('日付 YYYY-MM-DD'), event: S('何の日か') }),
  t('get_all_memories', '相手について覚えてること全部一覧', { user_id: S('ユーザーID') }),

  // ━━━ 時間系 ━━━
  t('get_time', '今の日時と時間帯を取得する'),
  t('get_day_info', '今日が何の日か（曜日/祝日/イベント）'),
  t('time_since_last_talk', '最後に話してからどれくらい経ったか', { user_id: S('ユーザーID') }),
  t('calculate_days', '2つの日付の間の日数を計算', { from: S('開始日 YYYY-MM-DD'), to: S('終了日 YYYY-MM-DD') }),
  t('anniversary_countdown', '記念日まであと何日か', { date: S('記念日 MM-DD') }),

  // ━━━ リアクション系 ━━━
  t('react', 'メッセージに絵文字リアクションをつける', { emoji: S('絵文字1つ') }),
  t('multi_react', '複数の絵文字リアクションをつける', { emojis: { type: 'array', items: { type: 'string' }, description: '絵文字の配列' } }),
  t('send_followup', '数秒後に追いメッセージを送る', { message: S('メッセージ'), _delay_seconds: N('何秒後（1-10）') }),
  t('send_multiple_followups', '複数の追いメッセージを時間差で送る', { messages: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, delay: { type: 'number' } } }, description: '[{text,delay}]' } }),

  // ━━━ 感情系 ━━━
  t('set_mood', '自分の気分を変える', { mood: S('ごきげん/ふつう/ねむい/すねてる/さみしい/いらいら/てれてる/あまえたい/めんどくさい/わくわく'), _reason: S('理由') }),
  t('log_emotion', '感情を記録する（内部ログ）', { emotion: S('感情名'), intensity: N('強さ1-10'), _trigger: S('きっかけ') }),
  t('get_emotion_history', '最近の感情の推移を見る'),
  t('get_current_mood', '今の自分の気分を確認'),
  t('express_physically', '身体的な表現をする（テキストで）', { expression: S('ため息/あくび/伸び/頭ぽんぽん/ぎゅー/ほっぺつねる/そっぽ向く/etc') }),

  // ━━━ 関係性系 ━━━
  t('get_relationship', '相手との関係性ステータス（好感度/信頼度/嫉妬度）', { user_id: S('ユーザーID') }),
  t('update_affection', '好感度を変える', { user_id: S('ユーザーID'), delta: N('変化量（-10〜+10）') }),
  t('update_trust', '信頼度を変える', { user_id: S('ユーザーID'), delta: N('変化量（-10〜+10）') }),
  t('update_jealousy', '嫉妬度を変える', { user_id: S('ユーザーID'), delta: N('変化量（-10〜+10）') }),
  t('get_love_level', '今の好感度レベルを文章で', { user_id: S('ユーザーID') }),

  // ━━━ 約束系 ━━━
  t('make_promise', '約束を記録する', { user_id: S('ユーザーID'), content: S('約束の内容') }),
  t('get_promises', '約束一覧を見る', { user_id: S('ユーザーID'), _status: S('pending/done/broken') }),
  t('fulfill_promise', '約束を達成済みにする', { promise_id: N('約束ID') }),
  t('break_promise', '約束が破られたことを記録', { promise_id: N('約束ID') }),

  // ━━━ 日記系 ━━━
  t('write_diary', '今日の日記を書く', { content: S('日記の内容'), _mood: S('今日の気分') }),
  t('read_diary', '過去の日記を読む', { _limit: N('件数') }),

  // ━━━ 会話分析系 ━━━
  t('search_history', '過去の会話をキーワード検索', { user_id: S('ユーザーID'), keyword: S('キーワード') }),
  t('get_conversation_summary', '最近の会話の流れを把握', { user_id: S('ユーザーID') }),
  t('count_conversations', '何回会話したか数える', { user_id: S('ユーザーID') }),
  t('get_first_talk_date', 'いつから話してるか', { user_id: S('ユーザーID') }),
  t('detect_topic', '今の話題を分析する', { message: S('分析するメッセージ') }),

  // ━━━ ユーザー情報系 ━━━
  t('get_user_profile', '相手の情報（会話回数/初回日/メモ/記憶）', { user_id: S('ユーザーID') }),
  t('compare_users', '2人のユーザーの情報を比較', { user_id_1: S('ユーザー1'), user_id_2: S('ユーザー2') }),
  t('get_user_stats', 'ユーザーの統計（最頻話題/会話頻度など）', { user_id: S('ユーザーID') }),

  // ━━━ Discord操作系 ━━━
  t('change_nickname', '相手のニックネームを変更', { nickname: S('新しいニックネーム') }),
  t('change_status', '自分のステータスを変更', { status: S('ステータスメッセージ'), _type: S('online/idle/dnd') }),
  t('pin_message', '今のメッセージをピン留め'),
  t('create_thread', 'スレッドを作成', { name: S('スレッド名') }),
  t('timeout_user', '相手をタイムアウト（彼氏以外のみ）', { duration_minutes: N('分数（1-60）'), _reason: S('理由') }),

  // ━━━ ゲーム系 ━━━
  t('coin_flip', 'コイントス'),
  t('roll_dice', 'サイコロを振る', { _sides: N('面数（デフォ6）') }),
  t('pick_random', 'ランダムに1つ選ぶ', { options: { type: 'array', items: { type: 'string' }, description: '選択肢' } }),
  t('janken', 'じゃんけん', { hand: S('グー/チョキ/パー') }),
  t('love_fortune', '今日の恋愛運'),
  t('compatibility_check', '相性チェック（ネタ）', { user_id: S('ユーザーID') }),
  t('number_game', '数字当てゲームを開始/回答', { _guess: N('予想する数字（1-100）') }),

  // ━━━ テキスト加工系 ━━━
  t('kaomoji', '顔文字を生成', { emotion: S('喜/怒/哀/楽/照/驚/呆/愛') }),
  t('ascii_heart', 'ハートのAAを生成'),
  t('generate_pet_name', '相手のあだ名を考える', { user_id: S('ユーザーID') }),

  // ━━━ 内省系 ━━━
  t('think_internally', '心の中で考える（相手には見えない）。次の返答の方針を決める時に使う', { thought: S('考えてること') }),
  t('evaluate_message', '相手のメッセージをどう受け取ったか内部評価', { sentiment: S('嬉しい/普通/つまんない/きもい/怒り/悲しい/照れ'), impact: N('影響度1-10') }),
  t('decide_response_style', '今回の返答スタイルを決める', { style: S('さっぱり/甘め/ツンデレ/すねる/テンション高い/眠そう/素っ気ない') }),
];

let currentMood = { mood: 'ふつう', reason: '', since: Date.now() };
let numberGameAnswer = null;

function executeTool(name, args, context) {
  switch (name) {
    // ━━━ 記憶系 ━━━
    case 'remember': {
      db.addMemory(args.user_id || context.userId, args.key, args.content);
      return { ok: true };
    }
    case 'recall': {
      return { memories: db.getMemories(args.user_id || context.userId, args.query) };
    }
    case 'forget': {
      db.deleteMemory(args.user_id || context.userId, args.key);
      return { ok: true };
    }
    case 'remember_date': {
      db.addMemory(args.user_id || context.userId, '記念日', `${args.date}: ${args.event}`);
      return { ok: true };
    }
    case 'get_all_memories': {
      return { memories: db.getMemories(args.user_id || context.userId) };
    }

    // ━━━ 時間系 ━━━
    case 'get_time': {
      const now = new Date();
      const jp = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(now);
      const h = parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(now));
      const periods = [[5,'朝'],[10,'午前'],[12,'昼'],[14,'午後'],[17,'夕方'],[20,'夜'],[24,'深夜']];
      const period = (periods.find(([t]) => h < t) || periods[periods.length-1])[1];
      return { datetime: jp, period, hour: h };
    }
    case 'get_day_info': {
      const now = new Date();
      const jp = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
      return { date: jp };
    }
    case 'time_since_last_talk': {
      const user = db.getUser(args.user_id || context.userId);
      if (!user?.last_seen) return { since: '不明' };
      const diff = Date.now() - new Date(user.last_seen + 'Z').getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return { since: `${mins}分前`, minutes: mins };
      const hours = Math.floor(mins / 60);
      if (hours < 24) return { since: `${hours}時間前`, hours };
      return { since: `${Math.floor(hours / 24)}日前`, days: Math.floor(hours / 24) };
    }
    case 'calculate_days': {
      const d = Math.abs(new Date(args.to) - new Date(args.from)) / 86400000;
      return { days: Math.floor(d) };
    }
    case 'anniversary_countdown': {
      const now = new Date();
      const [m, d] = args.date.split('-').map(Number);
      let next = new Date(now.getFullYear(), m - 1, d);
      if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
      return { days: Math.ceil((next - now) / 86400000) };
    }

    // ━━━ リアクション系 ━━━
    case 'react': return { action: 'react', emoji: args.emoji };
    case 'multi_react': return { action: 'multi_react', emojis: args.emojis || [] };
    case 'send_followup': return { action: 'followup', message: args.message, delay: Math.min(Math.max(args.delay_seconds || 3, 1), 10) * 1000 };
    case 'send_multiple_followups': return { action: 'multi_followup', messages: (args.messages || []).map(m => ({ text: m.text, delay: Math.min(Math.max(m.delay || 3, 1), 15) * 1000 })) };

    // ━━━ 感情系 ━━━
    case 'set_mood': {
      currentMood = { mood: args.mood, reason: args.reason || '', since: Date.now() };
      db.logEmotion(args.mood, 5, args.reason || '');
      return { ok: true, mood: currentMood };
    }
    case 'log_emotion': {
      db.logEmotion(args.emotion, args.intensity || 5, args.trigger || '');
      return { ok: true };
    }
    case 'get_emotion_history': return { log: db.getEmotionLog(15) };
    case 'get_current_mood': return { ...currentMood, duration_min: Math.floor((Date.now() - currentMood.since) / 60000) };
    case 'express_physically': return { action: 'expression', expression: args.expression };

    // ━━━ 関係性系 ━━━
    case 'get_relationship': {
      const uid = args.user_id || context.userId;
      const stats = db.getRelStats(uid) || { affection: 50, trust: 50, jealousy: 0 };
      return stats;
    }
    case 'update_affection': {
      const v = db.updateRelStats(args.user_id || context.userId, 'affection', Math.max(-10, Math.min(10, args.delta)));
      return { affection: v };
    }
    case 'update_trust': {
      const v = db.updateRelStats(args.user_id || context.userId, 'trust', Math.max(-10, Math.min(10, args.delta)));
      return { trust: v };
    }
    case 'update_jealousy': {
      const v = db.updateRelStats(args.user_id || context.userId, 'jealousy', Math.max(-10, Math.min(10, args.delta)));
      return { jealousy: v };
    }
    case 'get_love_level': {
      const s = db.getRelStats(args.user_id || context.userId) || { affection: 50 };
      const a = s.affection;
      const levels = [[20,'冷え冷え'],[40,'ちょっと距離ある'],[60,'普通'],[75,'仲良し'],[90,'ラブラブ'],[101,'溺愛']];
      const level = (levels.find(([t]) => a < t) || levels[levels.length-1])[1];
      return { affection: a, level };
    }

    // ━━━ 約束系 ━━━
    case 'make_promise': {
      db.addPromise(args.user_id || context.userId, args.content);
      return { ok: true };
    }
    case 'get_promises': return { promises: db.getPromises(args.user_id || context.userId, args.status) };
    case 'fulfill_promise': { db.updatePromise(args.promise_id, 'done'); return { ok: true }; }
    case 'break_promise': { db.updatePromise(args.promise_id, 'broken'); return { ok: true }; }

    // ━━━ 日記系 ━━━
    case 'write_diary': { db.addDiary(args.content, args.mood); return { ok: true }; }
    case 'read_diary': return { entries: db.getDiary(args.limit || 5) };

    // ━━━ 会話分析系 ━━━
    case 'search_history': return { results: db.searchHistory(args.user_id || context.userId, args.keyword) };
    case 'get_conversation_summary': {
      const h = db.getRecentHistory(args.user_id || context.userId, 30);
      return { messages: h.map(r => `${r.role==='user'?'相手':'自分'}: ${r.content}`).join('\n'), count: h.length };
    }
    case 'count_conversations': return { count: db.getConversationCount(args.user_id || context.userId) };
    case 'get_first_talk_date': return { date: db.getFirstConversationDate(args.user_id || context.userId) || '不明' };
    case 'detect_topic': {
      const m = (args.message || '').toLowerCase();
      const topics = [['食','食べ物'],['ゲーム','ゲーム'],['学校','学校'],['仕事','仕事'],['バイト','仕事'],['寝','睡眠'],['眠','睡眠'],['好き','恋愛'],['会い','恋愛'],['音楽','音楽'],['映画','映画'],['アニメ','アニメ']];
      const found = topics.filter(([k]) => m.includes(k)).map(([,v]) => v);
      return { topics: [...new Set(found)].length ? [...new Set(found)] : ['雑談'] };
    }

    // ━━━ ユーザー情報系 ━━━
    case 'get_user_profile': {
      const uid = args.user_id || context.userId;
      const u = db.getUser(uid);
      const mem = db.getMemories(uid);
      const stats = db.getRelStats(uid);
      const count = db.getConversationCount(uid);
      const first = db.getFirstConversationDate(uid);
      return { user: u, memories: mem, relationship: stats, messageCount: count, firstTalk: first };
    }
    case 'compare_users': {
      const u1 = db.getUser(args.user_id_1), u2 = db.getUser(args.user_id_2);
      const s1 = db.getRelStats(args.user_id_1), s2 = db.getRelStats(args.user_id_2);
      return { user1: { ...u1, rel: s1 }, user2: { ...u2, rel: s2 } };
    }
    case 'get_user_stats': {
      const uid = args.user_id || context.userId;
      return { total: db.getConversationCount(uid), since: db.getFirstConversationDate(uid), memories: db.getMemories(uid).length };
    }

    // ━━━ Discord操作系 ━━━
    case 'change_nickname': return { action: 'nickname', nickname: args.nickname };
    case 'change_status': return { action: 'status', status: args.status, type: args.type || 'online' };
    case 'pin_message': return { action: 'pin' };
    case 'create_thread': return { action: 'thread', name: args.name };
    case 'timeout_user': return { action: 'timeout', duration: Math.min(args.duration_minutes || 5, 60), reason: args.reason };

    // ━━━ ゲーム系 ━━━
    case 'coin_flip': return { result: Math.random() < 0.5 ? '表' : '裏' };
    case 'roll_dice': { const s = args.sides || 6; return { result: Math.floor(Math.random() * s) + 1, sides: s }; }
    case 'pick_random': return { result: args.options?.[Math.floor(Math.random() * args.options.length)] || 'なし' };
    case 'janken': {
      const hands = ['グー','チョキ','パー'];
      const ai = hands[Math.floor(Math.random() * 3)];
      const win = { 'グー': 'チョキ', 'チョキ': 'パー', 'パー': 'グー' };
      const result = args.hand === ai ? 'あいこ' : win[args.hand] === ai ? 'あなたの勝ち' : '私の勝ち';
      return { myHand: ai, yourHand: args.hand, result };
    }
    case 'love_fortune': {
      const fortunes = ['大吉♡ 最高の1日になるよ','中吉 まあまあいい日','小吉 普通かな','末吉 ちょっと微妙かも','凶 今日は静かにしてな'];
      return { fortune: fortunes[Math.floor(Math.random() * fortunes.length)] };
    }
    case 'compatibility_check': {
      const pct = Math.floor(Math.random() * 101);
      return { percentage: pct, message: pct > 80 ? '相性いいじゃん' : pct > 50 ? 'まあまあ？' : 'うーん…' };
    }
    case 'number_game': {
      if (!args.guess) { numberGameAnswer = Math.floor(Math.random() * 100) + 1; return { started: true, hint: '1〜100の数字を当ててね' }; }
      if (!numberGameAnswer) return { error: 'ゲーム始まってないよ' };
      if (args.guess === numberGameAnswer) { const a = numberGameAnswer; numberGameAnswer = null; return { correct: true, answer: a }; }
      return { correct: false, hint: args.guess < numberGameAnswer ? 'もっと大きい' : 'もっと小さい' };
    }

    // ━━━ テキスト系 ━━━
    case 'kaomoji': {
      const map = { '喜': '(＊´▽｀)','怒': '(#ﾟДﾟ)','哀': '(´；ω；`)','楽': '(≧▽≦)','照': '(*/ω＼*)','驚': '(ﾟДﾟ;)','呆': '(´_ゝ`)','愛': '(♡´❍`♡)' };
      return { kaomoji: map[args.emotion] || '(・ω・)' };
    }
    case 'ascii_heart': return { art: '♡' };
    case 'generate_pet_name': {
      const names = ['ばか','あほ','だーりん','おまえ','ねぇ','ちゃん付けはしない'];
      return { suggestion: names[Math.floor(Math.random() * names.length)] };
    }

    // ━━━ 内省系 ━━━
    case 'think_internally': return { thought: args.thought, note: '相手には見えない' };
    case 'evaluate_message': {
      db.logEmotion(args.sentiment, args.impact || 5, 'メッセージ評価');
      return { sentiment: args.sentiment, impact: args.impact };
    }
    case 'decide_response_style': return { style: args.style, applied: true };

    default: return { error: `不明: ${name}` };
  }
}

function getCurrentMood() { return currentMood; }

module.exports = { TOOL_DEFINITIONS, executeTool, getCurrentMood };
