const readline = require('readline');
const { saveEncryptedToken, hasEncryptedTokens } = require('../src/token-manager');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  Rula Bot - トークン暗号化セットアップ');
  console.log('========================================');
  console.log('');

  if (hasEncryptedTokens()) {
    const overwrite = await ask('⚠️  既に暗号化トークンが存在します。上書きしますか？ (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('キャンセルしました。');
      rl.close();
      return;
    }
  }

  console.log('トークンをAES-256-GCM暗号化で安全に保存します。');
  console.log('マスターパスワードはBot起動時に毎回入力が必要です。');
  console.log('');

  const botToken = await ask('Discord Bot Token (空欄でスキップ): ');
  const userToken = await ask('Discord User Token (空欄でスキップ): ');

  if (!botToken && !userToken) {
    console.log('❌ 少なくとも1つのトークンを入力してください。');
    rl.close();
    return;
  }

  const password = await ask('マスターパスワードを設定 (起動時に必要): ');
  if (password.length < 8) {
    console.log('❌ パスワードは8文字以上にしてください。');
    rl.close();
    return;
  }

  const confirmPassword = await ask('パスワード再入力: ');
  if (password !== confirmPassword) {
    console.log('❌ パスワードが一致しません。');
    rl.close();
    return;
  }

  const tokenData = {};
  if (botToken) tokenData.botToken = botToken;
  if (userToken) tokenData.userToken = userToken;

  saveEncryptedToken(tokenData, password);

  console.log('');
  console.log('✅ トークンを暗号化して保存しました (tokens.enc)');
  console.log('');
  console.log('起動方法:');
  console.log('  1. npm start → マスターパスワードを入力');
  console.log('  2. .envのTOKEN_MODEで bot/user を切り替え');
  console.log('');
  console.log('⚠️  マスターパスワードを忘れると復元できません！');
  console.log('⚠️  tokens.enc は .gitignore に含まれています');

  rl.close();
}

main().catch(err => {
  console.error('エラー:', err.message);
  rl.close();
  process.exit(1);
});
