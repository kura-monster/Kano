// Gemini Flash による画像/GIF/動画サムネ解析モジュール

async function analyzeImage(imageUrl, apiKey, prompt) {
  if (!apiKey || !imageUrl) return '';
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return '';
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) return ''; // 10MB制限
    const base64 = buf.toString('base64');

    let mime = 'image/jpeg';
    const ext = (imageUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp)/i) || [])[1];
    if (ext) {
      const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
      mime = map[ext.toLowerCase()] || 'image/jpeg';
    }

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt || 'この画像を日本語で簡潔に説明して。文字やテキストがあればそれも書いて。40文字以内。' },
            { inline_data: { mime_type: mime, data: base64 } },
          ]}],
          generationConfig: { maxOutputTokens: 80, temperature: 0.3 },
        }),
      }
    );

    if (!apiRes.ok) {
      const err = await apiRes.text();
      console.log(`[Vision] API ${apiRes.status}: ${err.substring(0, 100)}`);
      return '';
    }

    const data = await apiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return text.substring(0, 100);
  } catch (e) {
    console.log('[Vision] エラー:', e.message);
    return '';
  }
}

function extractEmbedInfo(embeds) {
  if (!embeds || embeds.length === 0) return { text: '', imageUrl: null };
  const parts = [];
  let imageUrl = null;

  for (const e of embeds) {
    if (e.provider?.name) parts.push(e.provider.name);
    if (e.author?.name) parts.push(e.author.name);
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description.substring(0, 80));
    if (!imageUrl) {
      imageUrl = e.image?.url || e.thumbnail?.proxyURL || e.thumbnail?.url || null;
    }
  }

  return { text: parts.join(' / ').substring(0, 150), imageUrl };
}

async function describeMedia(attachments, embeds, apiKey) {
  const descriptions = [];

  // ① 画像/GIF添付ファイルをGeminiで解析
  const imageAttachments = (attachments || []).filter(a =>
    (a.contentType || '').startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name || '')
  );

  if (imageAttachments.length > 0 && apiKey) {
    const first = imageAttachments[0];
    const isGif = (first.contentType || '').includes('gif') || /\.gif$/i.test(first.name || '');
    const prompt = isGif
      ? 'このGIF画像を日本語で説明して。動きやテキストがあれば含めて。40文字以内。'
      : 'この画像を日本語で簡潔に説明して。文字やテキストがあればそれも書いて。40文字以内。';
    const desc = await analyzeImage(first.url, apiKey, prompt);
    if (desc) descriptions.push(desc);
  }

  // ② Discord埋め込み情報を抽出
  const embed = extractEmbedInfo(embeds);
  if (embed.text) descriptions.push(embed.text);

  // ③ 埋め込みの画像/サムネをGeminiで解析（添付がなかった場合）
  if (imageAttachments.length === 0 && embed.imageUrl && apiKey) {
    const desc = await analyzeImage(embed.imageUrl, apiKey,
      'この画像/動画サムネを日本語で説明して。文字やテキストがあればそれも書いて。40文字以内。'
    );
    if (desc) descriptions.push(desc);
  }

  // ④ 動画添付の検出
  const videoAttachments = (attachments || []).filter(a =>
    (a.contentType || '').startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(a.name || '')
  );
  if (videoAttachments.length > 0 && descriptions.length === 0) {
    descriptions.push('動画が送られた');
  }

  return descriptions.join('。').substring(0, 200);
}

module.exports = { describeMedia, analyzeImage, extractEmbedInfo };
