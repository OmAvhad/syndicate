import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { encodeEventTopics, erc20Abi, toHex } from 'viem';
import routes from '../src/routes/trade.js';
import Trade from '../src/models/Trade.js';
import TradePromise from '../src/models/TradePromise.js';
import { hashTradePayload } from '../src/services/tradeCrypto.js';
import { exitPayout, VAULT, USDC, WETH } from '../src/services/tradeReceipts.js';
import { claimTradeResult, TradeClaimSchema } from '../src/services/promiseClaims.js';

test('verified entry, bull/bear exits, realized P/L and duplicate exit recording', async () => {
  const original = [axios.post, Trade.findOne, Trade.create, Trade.findOneAndUpdate, TradePromise.findOne];
  const burner = '0x1212121212121212121212121212121212121212';
  const hashes = ['1', '2', '3', '4'].map(c => `0x${c.repeat(64)}`);
  const payload = { tradeIndex: 1, symbol: 'ETH/USDC', side: 'BUY', orderType: 'BRACKET', limit: 3000, amount: 3, target: 3350, stopLoss: 2800, burnerAccountAddress: burner };
  const payloadHash = hashTradePayload(payload);
  let record, scenario = 'tp';
  const transfer = (hash, token, from, to, amount, block) => ({ status: '0x1', blockNumber: toHex(block), gasUsed: '0x64', effectiveGasPrice: '0x1', from, transactionHash: hash, logs: [{ address: token, topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }), data: toHex(amount, { size: 32 }) }] });
  axios.post = async (_url, body) => {
    if (body.method === 'eth_getBlockByNumber') return { status: 200, data: { result: { timestamp: toHex(Math.floor(Date.now() / 1000)) } } };
    const receipts = [transfer(hashes[0], USDC, burner, VAULT, 3000000n, 100), transfer(hashes[1], WETH, VAULT, burner, 1000000000000000n, 101), transfer(hashes[2], WETH, burner, VAULT, 1000000000000000n, 102), transfer(hashes[3], USDC, VAULT, burner, exitPayout('3000000', '1000000000000000', scenario === 'tp' ? 3350 : 2800), 103)];
    return { status: 200, data: { result: receipts[hashes.indexOf(body.params[0])] } };
  };
  Trade.findOne = async query => query._id ? record : query.receiptsVerified === true && record?.executionTxHash === query.executionTxHash ? record : null;
  Trade.create = async data => (record = { ...data, _id: '111111111111111111111111' });
  Trade.findOneAndUpdate = async (_query, update) => Object.assign(record, update.$set);
  TradePromise.findOne = async () => ({ promiseId: 'promise', payload, payloadHash, leaderPublicKey: burner });
  const app = express(); app.use(express.json()); app.use('/api/trades', routes);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const token = jwt.sign({ userId: 'follower-test' }, process.env.JWT_SECRET || 'world-id-secret-key-2024');
  const send = async (path, data) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api/trades${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }); return { status: r.status, body: await r.json() }; };
  try {
    const entered = await send('/execute', { ...payload, promiseId: 'promise', executionTxHash: hashes[0], entryDeliveryTxHash: hashes[1] });
    assert.equal(entered.status, 200); assert.equal(record.entryUsdcUnits, '3000000'); assert.equal(record.receiptsVerified, true);
    const closed = await send(`/${record._id}/exit`, { exitType: 'tp', exitReturnTxHash: hashes[2], exitPayoutTxHash: hashes[3] });
    assert.equal(closed.status, 200); assert.equal(record.realizedPnlUnits, '341000');
    const repeat = await send(`/${record._id}/exit`, { exitType: 'sl' });
    assert.equal(repeat.body.trade.exitType, 'tp'); // closed trades cannot exit again
    assert.equal(exitPayout('3000000', '1000000000000000', 2800) - 3000000n, -209000n);
  } finally {
    [axios.post, Trade.findOne, Trade.create, Trade.findOneAndUpdate, TradePromise.findOne] = original;
    await new Promise(resolve => server.close(resolve));
  }
});

test('claim verifies Arkiv commitment, writes once, and discovers an existing claim on retry', async () => {
  const payload = { tradeIndex: 2, symbol: 'ETH/USDC', side: 'BUY', orderType: 'BRACKET', limit: 3000, amount: 3, stopLoss: 2800, target: 3350, burnerAccountAddress: '0x1212121212121212121212121212121212121212' };
  const hash = hashTradePayload(payload);
  const trade = { _id: 'trade-claim', userId: 'user', status: 'CLOSED', receiptsVerified: true, promiseId: 'pretrade', payloadHash: hash, promisePayload: payload, promiseLeaderAddress: payload.burnerAccountAddress, entryBlockTimestamp: new Date(), executionTxHash: 'entry', entryDeliveryTxHash: 'delivery', exitReturnTxHash: 'return', exitPayoutTxHash: 'payout', entryUsdcUnits: '3000000', exitUsdcUnits: '3341000', realizedPnlUnits: '341000', burnerAccountAddress: payload.burnerAccountAddress };
  let rows = [], writes = 0;
  const reader = { select() { const query = { from(schema) { this.schema = schema; return this; }, where() { return this; }, ownedBy() { return this; }, limit() { return this; }, async fetch() { return { entities: this.schema === TradeClaimSchema ? rows : [{ $key: 'original-promise', payloadHash: { value: hash }, leaderPublicKey: { value: payload.burnerAccountAddress }, timestamp: { value: new Date(Date.now() - 10000).toISOString() } }] }; } }; return query; } };
  const writer = { account: { address: payload.burnerAccountAddress }, async createEntity(_schema, data) { writes++; rows = [{ $key: 'claim-key', ...data }]; return { entityKey: 'claim-key', txHash: 'claim-tx' }; } };
  assert.equal((await claimTradeResult(trade, { reader, writer })).entityKey, 'claim-key');
  assert.equal((await claimTradeResult(trade, { reader, writer })).alreadyClaimed, true);
  assert.equal(writes, 1);
  await assert.rejects(claimTradeResult({ ...trade, _id: 'other', promisePayload: { ...payload, amount: 99 } }, { reader, writer }), /does not match/);
  assert.equal(writes, 1);
  await assert.rejects(claimTradeResult({ ...trade, status: 'EXECUTED' }, { reader, writer }), /closed/);
});
