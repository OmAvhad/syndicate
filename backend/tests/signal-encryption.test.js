import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getEncryptionPublicKey, decrypt } from '@metamask/eth-sig-util';
import routes from '../src/routes/trade.js';
import User from '../src/models/User.js';
import TradeSignal from '../src/models/TradeSignal.js';

test('refresh encrypts only an owned active signal without returning plaintext or extending expiry', async () => {
  const originals = [User.findById, User.updateOne, TradeSignal.findOne, TradeSignal.updateOne];
  const wallet = '0x1212121212121212121212121212121212121212';
  const expiresAt = new Date(Date.now() + 60_000);
  let exists = true, refreshed;
  User.findById = async () => ({ _id: 'follower', walletAddress: wallet });
  User.updateOne = async () => ({ matchedCount: 1 });
  TradeSignal.findOne = async query => {
    assert.equal(query.followerId, 'follower');
    assert.equal(query.status, 'ACTIVE');
    assert.ok(query.expiresAt.$gt instanceof Date);
    return exists ? { _id: 'signal', followerPublicKey: wallet, requiresMetaMaskDecrypt: true, tradePayload: { symbol: 'ETH/USDC', amount: 3 }, expiresAt } : null;
  };
  TradeSignal.updateOne = async (query, update) => {
    assert.equal(query.followerId, 'follower');
    assert.equal(query.status, 'ACTIVE');
    assert.deepEqual(Object.keys(update.$set), ['encryptedPayloadHex']);
    refreshed = update.$set.encryptedPayloadHex;
    return { matchedCount: 1 };
  };
  const app = express(); app.use(express.json()); app.use('/api/trades', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const key = randomBytes(32).toString('hex');
    const token = jwt.sign({ userId: 'follower' }, process.env.JWT_SECRET || 'world-id-secret-key-2024');
    const send = () => fetch(`http://127.0.0.1:${server.address().port}/api/trades/signals/test/refresh-encryption`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ walletAddress: wallet, encryptionPublicKey: getEncryptionPublicKey(key) }) });
    const response = await send();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.expiresAt, expiresAt.toISOString());
    assert.equal(body.amount, undefined);
    assert.equal(body.encryptedPayloadHex, refreshed);
    const envelope = JSON.parse(Buffer.from(refreshed.slice(2), 'hex').toString());
    assert.deepEqual(JSON.parse(decrypt({ encryptedData: envelope, privateKey: key })), { symbol: 'ETH/USDC', amount: 3 });
    exists = false;
    assert.equal((await send()).status, 404);
  } finally {
    [User.findById, User.updateOne, TradeSignal.findOne, TradeSignal.updateOne] = originals;
    await new Promise(resolve => server.close(resolve));
  }
});
