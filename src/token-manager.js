const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '..', 'tokens.enc');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(encryptedBase64, password) {
  const data = Buffer.from(encryptedBase64, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

function saveEncryptedToken(tokenData, password) {
  const json = JSON.stringify(tokenData);
  const encryptedData = encrypt(json, password);
  fs.writeFileSync(TOKENS_FILE, encryptedData, 'utf8');
  fs.chmodSync(TOKENS_FILE, 0o600);
}

function loadEncryptedToken(password) {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  const encryptedData = fs.readFileSync(TOKENS_FILE, 'utf8');
  try {
    const json = decrypt(encryptedData, password);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hasEncryptedTokens() {
  return fs.existsSync(TOKENS_FILE);
}

module.exports = { encrypt, decrypt, saveEncryptedToken, loadEncryptedToken, hasEncryptedTokens };
