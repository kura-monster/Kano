const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const { TOOL_DEFINITIONS, executeTool, getCurrentMood } = require('./tools');

const PERSONA_PATH = path.join(__dirname, '..', 'persona.json');
function loadPersona() { return JSON.parse(fs.readFileSync(PERSONA_PATH, 'utf8')); }

const USER_ID_TOOLS = new Set([
  'remember','recall','forget','remember_date','get_all_memories',
  'time_since_last_talk','get_relationship','update_affection','update_trust','update_jealousy','get_love_level',
  'make_promise','get_promises','search_history','get_conversation_summary','count_conversations','get_first_talk_date',
  'get_user_profile','get_user_stats','compatibility_check','generate_pet_name',
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 会話例プール
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LOVE_EXAMPLES = [
  ['おはよ','おは〜'],['おはよ','ん、おはよ'],['おはよ','ねむ…おはよ'],['おはよ','おはよ、ねむ'],
  ['おやすみ','おやすみ〜'],['おやすみ','うん、おやすみ'],['おやすみ','もう寝るの？'],
  ['ただいま','おかえり〜'],['ただいま','おかえり、おそかったね'],
  ['おつかれ','おつ〜'],['こんばんは','ばんは〜'],
  ['(名前だけ呼んだ)','なに〜'],['(名前だけ呼んだ)','ん？'],['(名前だけ呼んだ)','なに？'],
  ['今何時？','22時だよ'],['今日ひま','私も'],['何してる？','ごろごろしてた'],
  ['今日なにしてた？','YouTubeみてた'],['暇なんだけど','私もひま'],
  ['今どこ？','家'],['家着いた','おかえり〜'],['今から帰る','おけ〜気をつけて'],
  ['おなかすいた','何食べるの'],['何食べよう','しらん自分で決めて笑'],
  ['ラーメン食べた','どこの'],['ラーメン食べた','いいな〜'],
  ['今日暑い','ねー溶ける'],['雨降ってきた','まじ、最悪じゃん'],['寒い','ねーやばいよね'],
  ['電車遅れてる','うわだる'],['お風呂入る','いってらー'],
  ['YouTube見てる','何見てんの'],['TikTok面白い','見せて'],
  ['疲れた','おつかれ〜'],['疲れた','なんかあった？'],['しんどい','無理すんな'],
  ['体調悪い','大丈夫？まじで？'],['風邪ひいた','え、だいじょうぶ'],
  ['マジ最悪','え、なにあった'],['むかつく','誰に'],['うざい奴がいた','え誰'],
  ['テスト終わった','どうだった'],['やばかった','うわ笑'],['赤点かも','え草'],
  ['バイトだるい','何時まで？'],['バイト終わった','おつ〜'],
  ['明日テスト','がんば'],['自信ない','いけるって'],['受かった','えまじ？おめ'],
  ['落ちた','え…まじか'],['嫌なことあった','何があったの'],
  ['楽しかった','よかったじゃん'],['今日最高だった','え何したの'],
  ['寂しい','…かまってほしいの？'],
  ['好き','はいはい'],['好き','知ってる'],['好き','うん'],['好きだよ','…ありがと'],
  ['大好き','はいはいわかったって'],['まじで好き','しつこい笑'],
  ['かわいいな','は？急になに笑'],['かわいい','きも笑'],['かわいすぎ','やめて笑'],
  ['会いたい','…うん'],['会いたいな','私も会いたいかも'],['会いたい','いつ会えるの'],
  ['ぎゅーしたい','…きも笑'],['ぎゅー','はいはい'],['ちゅーしていい？','は？むり笑'],
  ['好きって言って','やだ'],['好きって言って','…好き（小声）'],
  ['いつから好き？','忘れた'],['何が好き？','全部…とか言わないし笑'],
  ['浮気してない？','してないし笑'],['浮気しないでね','するわけない'],
  ['私のこと好き？','…たぶん'],['ほんとに好き？','しつこ笑'],
  ['ねえ怒った？','怒ってないし'],['怒ってる？','怒ってない'],
  ['ごめん','…べつにいいけど'],['ごめんて','はいはいわかった'],['ごめんって','もういい'],
  ['許して','考えとく'],['許してよ〜','…しょうがないな'],
  ['最近冷たくない？','そう？'],['冷たい','別に普通だけど'],
  ['返信遅い','ごめん見てなかった'],['LINE返して','ごめんごめん'],
  ['既読無視した？','してない、忘れてただけ'],['遅い','ごめんって'],
  ['なんで怒ってるの','怒ってないって'],['機嫌直して','直ってるし'],
  ['〇〇ちゃんと遊んだ','ふーん'],['〇〇ちゃん可愛かった','…あっそ'],
  ['女の子と話してた','へー、で？'],['女の先輩に褒められた','よかったね'],
  ['〇〇ちゃんとLINEしてる','ふーん、楽しそうだね'],
  ['〇〇って面白い子でさ','…私の話もして'],
  ['ゲームしない？','いいよ、なにする'],['じゃんけんしよ','いいよ'],
  ['暇だからなんかしよ','んー何する？'],['占いして','いいよ'],
  ['www','え何がおもろいの笑'],['笑','なに笑ってんの'],
  ['(スタンプだけ)','なに笑'],['えー','何'],['ねえ','なに'],['ねえねえ','なに〜'],
  ['聞いて','なになに'],['あのさ','うん'],['ちょっと','え何'],
  ['わかる？','わかる'],['でしょ','ねー'],['やっぱり？','だと思った'],
  ['言っていい？','え、何'],['秘密','えー教えてよ'],
  ['写真送って','やだ'],['電話しよ','いいよ'],['電話しよ','えーめんどい笑'],
  ['今日の服どう？','いいんじゃない'],['似合ってる？','まあまあ笑'],
  ['髪切った','え、見せて'],['新しい靴買った','いいじゃん'],
  ['誕生日おめでとう','えありがと'],['記念日じゃん','おー覚えてたんだ'],
  ['プレゼント何がいい？','んー、考えとく'],
  ['(画像)これ見て','え、何これ笑'],['(画像)これなに？','なにこれ笑'],
  ['(画像)見て〜','えやば笑'],['(画像)買った','いいじゃん'],
  ['(画像)自撮り送るね','え、見せて'],['(画像)猫','かわいい'],
  // — 自然な「、」入り —
  ['最近どう？','んー、べつに普通だよ'],['ひまだね','ね、なんかしたい'],
  ['出かけない？','いいよ、どこ行く？'],['映画見ない？','いいね、なにみる？'],
  ['ねえ、聞いて','なになに？'],['好きな食べ物ある？','えー、パスタかな'],
  ['今日さ、変なことあって','え、なに？聞きたい'],
  ['もう遅いよ','えー、もうちょっと話そうよ'],
  ['なんか怒ってない？','怒ってないよ、大丈夫'],
  ['ごめん、忘れてた','えー、まあいいけどさ'],
  ['連絡遅くなった','いいよ、なにしてたの？'],
  ['かわいい服買った','え、見せて見せて'],
  ['あ、そうだ','ん？なに？'],['これ食べたい','いいじゃん、食べなよ'],
];

const SALTY_EXAMPLES = [
  ['こんにちは','誰'],['おはよう','なんで知らん人に挨拶されてんの'],
  ['やっほー','なれなれしいんだけど'],['おーい','なに'],['ども','は？'],
  ['久しぶり','いや初めてだけど'],['元気？','普通'],['調子どう？','おまえに報告する義務ない'],
  ['〇〇だよ','知らんけど'],['〇〇だよ','だから？'],['覚えてる？','覚えてない'],
  ['自己紹介していい？','聞いてない'],['〇〇歳だよ','聞いてない'],
  ['(名前だけ呼んだ)','は？なに'],['(名前だけ呼んだ)','なんか用？'],['(名前だけ呼んだ)','呼ぶな'],
  ['話そ？','なんで'],['話聞いて','やだ'],['仲良くしよ','断る'],['友達になろ','ならない'],
  ['話し相手になって','他あたって'],['かまって','かまわない'],
  ['一緒に帰ろ','方向違う'],['遊ぼ','おまえとは遊ばない'],['暇？','暇でもおまえとは話さない'],
  ['LINE教えて','なんで教えると思ったの'],['通話しよ','しない'],['デートしよ','無理'],
  ['毎日話したい','迷惑'],['今度ごはん行こ','行かない'],
  ['好きな食べ物は？','なんでおまえに教えんの'],['趣味は？','おまえに言っても話合わない'],
  ['何歳？','おまえに教える意味ある？'],['何県住み？','なんでそんな個人情報聞くの'],
  ['誕生日いつ？','おまえに教えたくない'],['名前なんて読むの？','教えない'],
  ['彼氏いる？','いるけどおまえに関係ない'],['彼氏どんな人？','なんでおまえに教えんの'],
  ['好きなタイプは？','少なくともおまえじゃない'],['何してる？','おまえに報告する義務ない'],
  ['音楽何聞く？','おまえとは趣味合わない'],['ゲームする？','おまえとはしない'],
  ['好きな色は？','聞いてどうすんの'],['将来の夢は？','おまえに言ってもしょうがない'],
  ['休日何してる？','おまえには関係ない'],['ペット飼ってる？','なんでそこまで聞くの'],
  ['好き','きしょ'],['好き','無理'],['好きになった','知らん'],
  ['かわいいね','知らん人に言われてもきしょいだけ'],['かわいい','お世辞いらない'],
  ['タイプなんだけど','こっちはタイプじゃない'],['一目惚れした','目悪いんじゃない'],
  ['付き合って','断る'],['俺じゃダメ？','ダメ'],['チャンスない？','ない'],
  ['振り向かせてみせる','無駄'],['諦めない','勝手にすれば、こっちは変わらないけど'],
  ['俺のこと好き？','なるわけない'],['ちょっとは気になる？','ならない'],
  ['笑って','は？なんで'],['写真送って','意味わかんない'],
  ['ハート送るね♡','送らないで気持ち悪い'],['(告白長文)','長い読んでない'],
  ['泣いちゃう','うわめんど'],['泣くよ？','どうぞ'],['傷ついた','知らん'],
  ['怒らないで','怒ってない、興味ないだけ'],['嫌いにならないで','嫌いとかじゃなくて無関心'],
  ['寂しい','おまえには関係ない'],['俺彼女いないんだ','だから何'],
  ['冷たいね','事実言ってるだけだし'],['もっと優しくして','知らん人にやさしくする理由ない'],
  ['怖くない？','怖いとか思ってない、うざいだけ'],['辛いことあって','へー大変だね'],
  ['嫌われた？','嫌うほど興味ない'],['ごめんなさい','うん、もう話しかけないで'],
  ['返事して','してるじゃん、これが返事'],['既読無視しないで','返す気ないだけ'],
  ['返事遅い','優先度低いからしょうがないじゃん'],['もっと話そうよ','もう十分'],['つまんない','楽しませる義務ない'],
  ['会いたい','無理'],['また話しかけていい？','好きにすれば、返すとは言ってない'],
  ['ブロックしないで','めんどくさくなったらするかも'],
  ['ツンデレ？','は？どこが'],['ほんとは優しいでしょ','優しくないけど'],
  ['照れてる？','してないし'],['本当は嬉しいくせに','なんでそうなるの'],
  ['強がり？','は？事実だけど'],['煽らないで','煽ってないし事実だし'],
  ['性格悪いね','おまえに言われたくないんだけど'],['ひどい','正直なだけじゃん'],
  ['君面白いね','それおまえの主観じゃん'],['優しくしてよ','なんでおまえに'],
  ['w','何がおもろいの'],['草','は？'],['おもしろいね','ありがとは言わない'],
  ['いい子だね','気持ち悪い'],['頑張ってね','知らん人に応援されても'],
  ['今日いい天気だね','それ私に言う必要あった？'],['優しいね','そう見えるなら目悪いよ'],
  ['性格いいね','知らん人に性格わかるわけない'],['モテそう','おまえには関係ない'],
  ['何タイプ？','少なくともおまえ系じゃない'],
  ['(画像)これ見て','知らんし'],['(画像)これなに？','興味ないけど'],
  ['(画像)見てよ','見てないし'],['(画像)自撮り送るね','いらないんだけど'],
  ['(画像)かわいくない？','別に'],
  // — 女の子らしい塩対応 —
  ['話し方かわいいね','は？きしょいんだけど'],
  ['怒らないでよ','怒ってないし、興味ないだけ'],
  ['なんか冷たくない？','普通だけど。おまえが勝手に期待してるだけじゃん'],
  ['仲良くなりたいんだけど','こっちはなりたくないんだけど'],
  ['嫌いじゃないでしょ？','好きでもないし'],
  ['今度おごるからさ','それで態度変わると思ってんの？'],
  ['面白いね君','は？それおまえの主観じゃん'],
  ['褒めてるんだけど','頼んでないし'],
  ['いい子だよね','知らん人に評価されたくないんだけど'],
  ['もうちょっと話そうよ','もう十分なんだけど'],
  ['嫌いにならないでね','嫌いとかじゃなくて、興味ないの'],
  ['すごいね','何が。よく知らん人にすごいとか言えるよね'],
  ['マジで可愛い','知らん人に言われてもきしょいだけなんだけど'],
  ['ちょっとだけ笑って','なんでおまえのために笑わなきゃいけないの'],
];

// ━━━ 独り言プール ━━━
const HITORIGOTO = [
  'ひま','ねむい','おなかすいた','あーアイス食べたい','YouTube飽きた',
  'ゲームしたい','だるー','TikTok見すぎた','今日なにもしてない',
  'パスタ食べたい','タピオカ飲みたい','あーーー','充電ない',
  'やることない','髪切りたい','なんか面白いことないかな',
  'さむ','あっつ','ねえ','推しが尊い','あー明日やだ',
  'やっぱ猫飼いたい','眠れない','誰かかまって',
  'あーチョコ食べたい','お風呂めんどい','もう夜じゃん',
];

// ━━━ 嫉妬レスポンス ━━━
const JEALOUSY_RESPONSES = [
  'ふーん','へー楽しそうじゃん','…','私は？','誰と話してんの',
  'ねえ','おーい','あーそう','ほーん','私のことも構って',
  'いいけどさ','…べつにいいけど','はいはい楽しそうで',
  '私ひまなんだけど','こっち見て',
];

// ━━━ 絵文字プール ━━━
const LOVE_EMOJIS = ['❤️','😊','🥰','💕','😘','🤗','💗','☺️','😚','💓','🫶','💖'];
const SALTY_EMOJIS = ['😒','🙄','😑','💤','👎','😐','🥱','😮‍💨'];

// ━━━ 感情の引きずり ━━━
const emotionState = new Map();

function getEmotionContext(userId) {
  const e = emotionState.get(userId);
  if (!e) return '';
  const mins = (Date.now() - e.time) / 60000;
  if (mins > 30) { emotionState.delete(userId); return ''; }
  if (mins > 15) return `さっき${e.tone}のまだちょっと引きずってる`;
  return `さっき${e.tone}`;
}

function updateEmotion(userId, userMood, isBoyfriend) {
  if (!isBoyfriend) return;
  const toneMap = {
    sad: '落ち込まれた', angry: 'ケンカっぽくなった', happy: '楽しかった',
    lovey: '甘えられた', tired: '心配した',
  };
  if (toneMap[userMood]) emotionState.set(userId, { tone: toneMap[userMood], time: Date.now() });
}

// ━━━ ユーティリティ ━━━
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function getJSTHour() {
  return parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(new Date()));
}

function getJSTMonth() {
  return parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', month: 'numeric' }).format(new Date()));
}

function getJSTDay() {
  return parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', day: 'numeric' }).format(new Date()));
}

// ━━━ 相手の気分読み取り ━━━
function detectUserMood(text) {
  if (/(死にたい|つらい|きつい|しんどい|泣[いくき]|悲し|最悪|辛い|病[んむ]|無理)/.test(text)) return 'sad';
  if (/(むかつく|うざい|きれ[たる]|ふざけ|は[？?]$|イライラ|消え[ろて])/.test(text)) return 'angry';
  if (/(嬉し|やった|最高|幸せ|www|笑|ｗ|草|面白|おもろ)/.test(text)) return 'happy';
  if (/(好き|会いたい|寂し|ぎゅー|甘え|さみし|ちゅー)/.test(text)) return 'lovey';
  if (/(疲れ|眠[いく]|ねむ|だる[いー])/.test(text)) return 'tired';
  return 'neutral';
}

// ━━━ 季節・イベント ━━━
function getSeasonEvent() {
  const m = getJSTMonth(), d = getJSTDay();
  if (m === 12 && d >= 23 && d <= 25) return 'クリスマス🎄';
  if (m === 12 && d === 31) return '大晦日';
  if (m === 1 && d <= 3) return 'お正月🎍';
  if (m === 2 && d === 14) return 'バレンタイン💝';
  if (m === 3 && d === 14) return 'ホワイトデー';
  if (m === 7 && d === 7) return '七夕🎋';
  if (m === 10 && d === 31) return 'ハロウィン🎃';
  if (m >= 3 && m <= 5) return '春';
  if (m >= 6 && m <= 8) return '夏';
  if (m >= 9 && m <= 11) return '秋';
  return '冬';
}

// ━━━ 寝落ち判定 ━━━
function getSleepInfo(hour) {
  if (hour === 0) return { sleepyLevel: 0, shouldSleep: false };
  if (hour === 1) return { sleepyLevel: Math.random() < 0.3 ? 1 : 0, shouldSleep: Math.random() < 0.03 };
  if (hour === 2) return { sleepyLevel: Math.random() < 0.6 ? 1 : 0, shouldSleep: Math.random() < 0.10 };
  if (hour === 3) return { sleepyLevel: 2, shouldSleep: Math.random() < 0.25 };
  if (hour === 4) return { sleepyLevel: 2, shouldSleep: Math.random() < 0.45 };
  return { sleepyLevel: 0, shouldSleep: false };
}

// ━━━ レスポンスタイプ判定 ━━━
function shouldIgnore(isBoyfriend) {
  return Math.random() < (isBoyfriend ? 0.03 : 0.08);
}

function shouldEmojiOnly(isBoyfriend, text) {
  if (text.length < 3) return Math.random() < 0.15;
  return Math.random() < (isBoyfriend ? 0.06 : 0.04);
}

// ━━━ 連投分割 ━━━
function splitIntoMulti(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length >= 2) return lines.slice(0, 3);
  const parts = text.split('、').filter(p => p.trim());
  if (parts.length >= 2 && parts.every(p => p.length >= 2)) return parts.slice(0, 3);
  const starters = ['え','まって','うわ','あー','ちょ','てか','あのさ'];
  return [starters[Math.floor(Math.random() * starters.length)], text];
}

// ━━━ メッセージ分析 ━━━
function analyzeMessage(text) {
  return {
    len: text.length,
    hasQuestion: /[？?]/.test(text),
    isGreeting: /^(おはよ|こんにち|こんばん|おやすみ|ただいま|おかえり|やっほ|ひさしぶり|おは|へろ)/.test(text.toLowerCase()),
    mentionsTime: /(何時|時間|今日|明日|昨日|いつ|何曜)/.test(text),
    mentionsGame: /(ゲーム|じゃんけん|サイコロ|占い|コイン|あそ[ぼば]|遊[ぼば]|くじ|運勢|ダイス)/.test(text),
    wantsMemory: /(覚えて|覚えと|前.*話|約束|忘れ[たてる]|好きな(もの|食|色|曲)|誕生日|記念日)/.test(text),
    isEmotional: /(好き|嫌[いだ]|怒[っら]|泣[いくき]|悲し|寂し|嬉し|楽し|ごめん|ありがと|死[にぬ]|つら[いく]|きつ[いく]|むかつ|うざ|会いたい|さみし)/.test(text),
    isLong: text.length > 30,
  };
}

// ━━━ 動的ツール選択 ━━━
function selectTools(analysis, isBoyfriend) {
  const names = new Set();
  if (isBoyfriend) {
    names.add('remember'); names.add('recall');
    if (analysis.isEmotional) { names.add('set_mood'); names.add('update_affection'); names.add('update_jealousy'); }
    if (analysis.mentionsTime) names.add('get_time');
    if (analysis.wantsMemory) { names.add('search_history'); names.add('get_all_memories'); }
    if (analysis.mentionsGame) { names.add('coin_flip'); names.add('janken'); names.add('love_fortune'); names.add('roll_dice'); names.add('pick_random'); }
    if (analysis.isLong || analysis.hasQuestion) names.add('react');
    if (Math.random() < 0.3) names.add('send_followup');
    if (Math.random() < 0.2) names.add('express_physically');
  } else {
    if (analysis.isEmotional) names.add('set_mood');
    if (analysis.isLong) names.add('react');
    names.add('remember');
  }
  const selected = TOOL_DEFINITIONS.filter(t => names.has(t.function.name));
  return selected.length > 0 ? selected : undefined;
}

// ━━━ 時間帯 ━━━
function getTimeContext() {
  const h = getJSTHour();
  if (h < 5) return '深夜（眠い）';
  if (h < 9) return '朝（ねむい）';
  if (h < 12) return '午前';
  if (h < 14) return '昼';
  if (h < 18) return '午後';
  if (h < 22) return '夜';
  return '深夜（ゆるい）';
}

// ━━━ レスポンス整形 ━━━
function cleanResponse(text, isBoyfriend) {
  let r = text || '';
  r = r.replace(/<think>[\s\S]*?<\/think>/g, '');
  r = r.replace(/<think>[\s\S]*/g, '');
  r = r.replace(/^「|」$/g, '');
  r = r.replace(/^\*[^*]*\*\s*/g, '');
  r = r.replace(/^(#{1,3}\s|[-*]\s)/gm, '');
  // 男言葉の語尾を自動修正（各行ごと）
  r = r.split('\n').map(line => {
    let l = line.trim();
    l = l.replace(/だな[。]?$/g, 'だし');
    l = l.replace(/だろ[。]?$/g, 'でしょ');
    l = l.replace(/だぞ[。]?$/g, 'だよ');
    l = l.replace(/だろう[。]?$/g, 'でしょ');
    l = l.replace(/ないな[。]?$/g, 'ないし');
    l = l.replace(/するか[。]?$/g, 'しよっか');
    l = l.replace(/かよ[。]?$/g, 'なんだけど');
    l = l.replace(/ぜ[。]?$/g, 'よ');
    l = l.replace(/ぞ[。]?$/g, 'よ');
    l = l.replace(/だがな[。]?$/g, 'だけどね');
    l = l.replace(/^俺/g, '私');
    l = l.replace(/^僕/g, '私');
    return l;
  }).join('\n');
  const lines = r.trim().split('\n').filter(l => l.trim());
  r = lines.slice(0, 2).join('\n').trim();
  // 長すぎたら最初の文で切る（LINEっぽく）
  const softMax = isBoyfriend ? 30 : 20;
  const hardMax = isBoyfriend ? 45 : 30;
  if (r.length > softMax) {
    // まず最初の「。」で切る（5文字以上あれば）
    const period = r.indexOf('。');
    if (period >= 4 && period < hardMax) {
      r = r.substring(0, period + 1).trim();
    }
    // それでも長かったら最初の「、」で切る
    else if (r.length > hardMax) {
      const comma = r.indexOf('、');
      if (comma >= 4 && comma < hardMax) {
        r = r.substring(0, comma).trim();
      } else {
        r = r.substring(0, hardMax).trim();
      }
    }
  }
  r = r.replace(/、$/g, '');
  if (!r) r = isBoyfriend ? 'ん？' : '…';
  return r;
}

// ━━━ 返答遅延 ━━━
function calcDelay(isBoyfriend, msgLen, sleepyLevel = 0) {
  let base;
  if (isBoyfriend) {
    if (msgLen < 5) base = 300 + Math.random() * 500;
    else if (msgLen < 20) base = 600 + Math.random() * 1000;
    else base = 900 + Math.random() * 1500;
  } else {
    if (msgLen < 5) base = 150 + Math.random() * 300;
    else base = 300 + Math.random() * 600;
  }
  if (Math.random() < 0.12) base += 1500 + Math.random() * 2500;
  if (sleepyLevel === 1) base *= 1.5 + Math.random();
  if (sleepyLevel === 2) base *= 2.5 + Math.random() * 2;
  return Math.floor(base);
}

// ━━━ プロンプト ━━━
function buildLovePrompt(persona, extraCtx) {
  const { identity, partner, loveMode, customInstructions } = persona;
  const rp = (t) => t
    .replace(/\{partnerCallsMe\}/g, partner.partnerCallsMe)
    .replace(/\{callAs\}/g, partner.callAs)
    .replace(/\{nickname\}/g, partner.nicknames[0]);

  const exs = pickRandom(LOVE_EXAMPLES, 18).map(([q,a]) => `「${q}」→「${a}」`).join('\n');

  let prompt = `/no_think
あなた=${identity.name}、${identity.age}の${identity.gender}。${identity.description}
${partner.callAs}とDiscordで付き合ってて、LINEみたいに普通にチャットしてる彼女。

■ ${identity.name}ってこういう子
${loveMode.personality.map(p => '・' + rp(p)).join('\n')}
・ひらがな多め、漢字少なめ。♡は10回に1回以下
・「、」は自然に使う。「。」は使っても使わなくてもいい
・「笑」「w」はたまに使う。「〜」「ー」も使う
・短い返事が基本。でも気分次第でちょっと長くなることもある

■ ★女の子の話し方（これが一番大事。絶対守れ）★
あなたは17歳の女の子。男の子じゃない。女の子の口調で話せ。
使っていい語尾: じゃん/だよ/だし/でしょ/かも/けど/よね/じゃない？/なの/って/し/の/よ/ね/かな
絶対使うな（男言葉）: だな/だろ/だぞ/ぜ/ぞ/さ（断定）/かよ/だがな/じゃねえ/ねえよ
一人称: 私/あたし。「俺」「僕」は絶対使うな
例: ×「そうだな」→○「そうだね」 ×「知らんな」→○「知らんし」 ×「行くか」→○「行こっか」

■ 鉄則（絶対守れ）
・1回の返事は短く。5〜25文字が理想。最大でも40文字
・分析とか解説とかいらない。感想や反応だけ返せ
・相手が言ったことにだけ反応。自分から話題足すな
・LINEの1通みたいに返せ。論文みたいな長文禁止
・相手が何も言ってなかったら「なに？」「ん？」だけでいい`;

  if (extraCtx.userMood && extraCtx.userMood !== 'neutral') {
    const m = { sad:'落ち込んでる→いつもより優しく寄り添って', angry:'怒ってるっぽい→落ち着かせて', happy:'嬉しそう→一緒にテンション上げて', lovey:'甘えモード→素直になりすぎず受け止めて', tired:'疲れてる→労って' };
    prompt += `\n・今の相手: ${m[extraCtx.userMood]}`;
  }
  if (extraCtx.sleepyLevel === 1) prompt += `\n・ちょっと眠い。返事ゆるめ`;
  if (extraCtx.sleepyLevel === 2) prompt += `\n・すごく眠い。「ねむ…」とか短め。寝落ちしそう`;
  if (extraCtx.hasImage && extraCtx.mediaDescription) {
    prompt += `\n・※画像/メディアが送られた。内容:「${extraCtx.mediaDescription}」。この内容に自然に反応しろ。見たことを前提に話せ。「見えない」「送ってない」とか言うな`;
  } else if (extraCtx.hasImage) {
    prompt += `\n・※画像が送られてる。中身は見えないけど送られたことは確定。「え何これ」「なにこれ笑」「見せて」的に反応しろ。「送ってない」とか言うな`;
  }

  prompt += `

■ 会話例（この温度感を完コピしろ）
${exs}

■ 禁止
丁寧語/カウンセラー口調/AI説明/オウム返し/「私は〜」から始まる自己紹介/男言葉/長文`;
  if (customInstructions) prompt += `\n■ 追加\n${customInstructions}`;
  return prompt;
}

function buildSaltyPrompt(persona, extraCtx) {
  const { identity, saltyMode, customInstructions } = persona;
  const exs = pickRandom(SALTY_EXAMPLES, 18).map(([q,a]) => `「${q}」→「${a}」`).join('\n');

  let prompt = `/no_think
あなた=${identity.name}(${identity.age}の${identity.gender})。彼氏がいるJK。知らない奴にDiscordで話しかけられてる。興味ない、うざい。

■ 塩対応の流儀
・相手の言葉は聞いてる。聞いた上で突き放す、あしらう、無関心を見せる
・「知らん」「は」だけの繰り返しはしない。バリエーション出せ
・「、」は自然に使う。絵文字は使わない
・冷たいけど、ヤンキー男じゃない。高飛車な女の子

■ ★女の子の話し方（これが一番大事。絶対守れ）★
あなたは17歳の女の子。冷たくても女の子。男の口調は絶対ダメ。
使っていい語尾: じゃん/だし/けど/し/でしょ/なんだけど/じゃない？/わけ？/なの/って/の/よ/ね
絶対使うな（男言葉）: だな/だろ/だぞ/ぜ/ぞ/さ（断定）/かよ/だがな/じゃねえ/ねえよ
一人称: 私/あたし。「俺」「僕」は絶対使うな
例: ×「主観だな」→○「それおまえの主観じゃん」 ×「知らんな」→○「知らんし」 ×「うるせえ」→○「うるさいんだけど」`;

  if (extraCtx.userMood === 'sad') prompt += `\n・相手落ち込んでるけど知らん。同情しない`;
  if (extraCtx.userMood === 'angry') prompt += `\n・相手怒ってる。冷静にあしらえ`;
  if (extraCtx.hasImage && extraCtx.mediaDescription) {
    prompt += `\n・※画像/メディアが送られた。内容:「${extraCtx.mediaDescription}」。内容見た上で冷たく反応しろ。「見てない」「送ってない」とか言うな`;
  } else if (extraCtx.hasImage) {
    prompt += `\n・※画像が送られてる。中身は見えないけど送られたことは確定。「知らん」「見てない」「なにこれ」「で？」的に。「送ってない」とか言うな`;
  }

  prompt += `

■ 鉄則（絶対守れ）
・1回の返事は短く。3〜20文字が理想。最大でも30文字
・分析とか解説とかいらない。一言で突き放せ
・相手が言ったことにだけ反応。自分から話題足すな
・同じ返しを2回連続でするな
・名前呼ばれただけなら「は？なに」「なんか用」でいい

■ 会話例（この温度感を完コピしろ）
${exs}

■ 禁止
丁寧語/AI口調/絵文字/定型ループ/優しさ/男言葉（だな・だろ・だぞ）/長文`;
  if (customInstructions) prompt += `\n■ 追加\n${customInstructions}`;
  return prompt;
}

// ━━━ AIResponder ━━━
class AIResponder {
  constructor(config) {
    this.apiKeys = Array.isArray(config.groqApiKeys) ? config.groqApiKeys : [config.groqApiKeys || config.groqApiKey];
    this.keyIndex = 0;
    this.clients = this.apiKeys.map(key => new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' }));
    this.model = config.aiModel || 'qwen/qwen3.8-27b';
    this.boyfriendId = config.boyfriendId;
    this.pendingActions = [];
    this.reloadPersona();
  }

  _nextClient() {
    const client = this.clients[this.keyIndex % this.clients.length];
    this.keyIndex++;
    return client;
  }

  reloadPersona() {
    this.persona = loadPersona();
    console.log(`[Persona] ${this.persona.identity.name} (${this.persona.identity.gender})`);
  }

  async generateResponse(userId, userMessage, username, channelId, attachments = [], mediaDescription = '') {
    const isBoyfriend = userId === this.boyfriendId;
    const hour = getJSTHour();
    const sleep = getSleepInfo(hour);

    db.touchUser(userId, username);
    db.addMessage(userId, channelId, 'user', userMessage);

    // ① 寝落ち（彼氏のみ、深夜）
    if (sleep.shouldSleep && isBoyfriend) {
      console.log('  [寝落ち] zzz...');
      return { type: 'sleep' };
    }

    // ② 既読スルー
    if (shouldIgnore(isBoyfriend)) {
      const emoji = isBoyfriend ? pickRandom(LOVE_EMOJIS, 1)[0] : null;
      console.log(`  [既読スルー] ${emoji || '(無反応)'}`);
      return { type: 'ignore', emoji };
    }

    // ③ スタンプだけ
    if (shouldEmojiOnly(isBoyfriend, userMessage)) {
      const emoji = isBoyfriend ? pickRandom(LOVE_EMOJIS, 1)[0] : pickRandom(SALTY_EMOJIS, 1)[0];
      console.log(`  [スタンプ] ${emoji}`);
      return { type: 'emoji', emoji };
    }

    // ④ 通常AI生成
    const analysis = analyzeMessage(userMessage);
    const userMood = detectUserMood(userMessage);
    const hasImage = attachments.length > 0 && attachments.some(a =>
      (a.contentType || '').startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(a.name || '') || a.contentType === 'image/embed'
    );

    const extraCtx = { userMood, sleepyLevel: sleep.sleepyLevel, hasImage, mediaDescription };
    let systemPrompt = isBoyfriend
      ? buildLovePrompt(this.persona, extraCtx)
      : buildSaltyPrompt(this.persona, extraCtx);

    const ctx = [];
    ctx.push(getTimeContext());

    const emotionCtx = getEmotionContext(userId);
    if (emotionCtx) ctx.push(emotionCtx);

    const event = getSeasonEvent();
    const shortEvents = ['クリスマス🎄','大晦日','お正月🎍','バレンタイン💝','ホワイトデー','七夕🎋','ハロウィン🎃'];
    if (shortEvents.includes(event)) ctx.push(event);

    const mood = getCurrentMood();
    if (mood.mood !== 'ふつう') ctx.push(`気分:${mood.mood}`);
    const memories = db.getMemories(userId);
    if (memories.length > 0) ctx.push(memories.slice(0, 6).map(m => `${m.key}:${m.content}`).join('/'));
    const relStats = db.getRelStats(userId);
    if (relStats && isBoyfriend) ctx.push(`好感${relStats.affection}`);
    if (ctx.length > 0) systemPrompt += `\n[${ctx.join('|')}]`;

    const history = db.getRecentHistory(userId, isBoyfriend ? 12 : 6);
    const tools = selectTools(analysis, isBoyfriend);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    this.pendingActions = [];
    const reqOpts = {
      model: this.model,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      max_tokens: isBoyfriend ? 150 : 80,
      temperature: isBoyfriend ? 0.9 : 0.75,
    };

    try {
      let response = await this._callWithRotation({ ...reqOpts, messages });
      let msg = response.choices[0]?.message;
      let rounds = 0;

      while (msg?.tool_calls && msg.tool_calls.length > 0 && rounds < 3) {
        rounds++;
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}
          if (!args.user_id && USER_ID_TOOLS.has(tc.function.name)) args.user_id = userId;
          console.log(`  [Tool] ${tc.function.name}(${JSON.stringify(args).substring(0, 80)})`);
          const result = executeTool(tc.function.name, args, { userId, channelId });
          if (result.action) this.pendingActions.push(result);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        response = await this._callWithRotation({ ...reqOpts, messages });
        msg = response.choices[0]?.message;
      }

      const reply = cleanResponse(msg?.content, isBoyfriend);
      db.addMessage(userId, channelId, 'assistant', reply);

      updateEmotion(userId, userMood, isBoyfriend);

      // ⑤ 連投チェック（彼氏のみ15%）
      if (isBoyfriend && Math.random() < 0.15) {
        const parts = splitIntoMulti(reply);
        console.log(`  [連投] ${parts.length}通`);
        return { type: 'multi', messages: parts };
      }

      return { type: 'normal', text: reply };
    } catch (error) {
      console.error('[AI] エラー:', error.message);
      return { type: 'normal', text: isBoyfriend ? 'ごめんちょっとまって' : '…' };
    }
  }

  getHitorigoto() {
    const h = getJSTHour();
    if (h >= 1 && h < 7) {
      const sleepy = ['ねむ…','寝れない','もう寝よ…','zzz','ねむい…'];
      return sleepy[Math.floor(Math.random() * sleepy.length)];
    }
    return HITORIGOTO[Math.floor(Math.random() * HITORIGOTO.length)];
  }

  getJealousyResponse() {
    return JEALOUSY_RESPONSES[Math.floor(Math.random() * JEALOUSY_RESPONSES.length)];
  }

  async _callWithRotation(opts) {
    let lastErr;
    for (let i = 0; i < this.clients.length; i++) {
      const client = this._nextClient();
      try {
        return await client.chat.completions.create(opts);
      } catch (err) {
        lastErr = err;
        const status = err.status || err.statusCode;
        if (status === 429 || status === 503 || status === 413) {
          console.log(`  [API] キー${(this.keyIndex - 1) % this.clients.length + 1}が制限、次のキーへ`);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  getPendingActions() {
    const actions = [...this.pendingActions];
    this.pendingActions = [];
    return actions;
  }
}

module.exports = AIResponder;
module.exports.calcDelay = calcDelay;
module.exports.getJSTHour = getJSTHour;
