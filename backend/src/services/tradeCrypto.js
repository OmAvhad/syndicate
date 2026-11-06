import crypto from 'crypto';
import '../env.js';

const getHashSecret = () => process.env.TRADE_HASH_SECRET || 'syndicate_trade_hash_secret_key_2026_arkdb';

/**
 * Computes deterministic HMAC-SHA256 hash of trade payload for /promise and order integrity
 */
export function hashTradePayload(tradeData) {
  const secret = getHashSecret();
  const normalized = {
    symbol: tradeData.symbol?.trim().toUpperCase(),
    side: tradeData.side?.trim().toUpperCase(),
    orderType: tradeData.orderType?.trim().toUpperCase() || 'LIMIT',
    limit: Number(tradeData.limit),
    amount: Number(tradeData.amount),
    stopLoss: Number(tradeData.stopLoss || 0),
    target: Number(tradeData.target || 0),
    burnerAccountAddress: tradeData.burnerAccountAddress?.trim().toLowerCase() || '',
  };

  const payloadString = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Derives a 32-byte AES key from follower's public key and the secret
 */
function deriveKey(followerPublicKey) {
  const secret = getHashSecret();
  const salt = `arkiv_follower_key_${followerPublicKey.toLowerCase()}`;
  return crypto.pbkdf2Sync(secret, salt, 10000, 32, 'sha256');
}

/**
 * Encrypt trade signal using follower's public key (AES-256-GCM)
 */
export function encryptTradeSignal(tradeData, followerPublicKey) {
  const key = deriveKey(followerPublicKey);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(tradeData);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt trade signal using follower's public key (AES-256-GCM)
 */
export function decryptTradeSignal(encryptedString, followerPublicKey) {
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted trade signal format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = deriveKey(followerPublicKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Crypto] Decrypt trade signal failed:', error.message);
    return null;
  }
}

