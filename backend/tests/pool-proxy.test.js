import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import poolRoutes from '../src/routes/pool.js';

test('session RPC bypasses generic JWT middleware and always returns JSON-RPC envelopes', async () => {
  process.env.PIMLICO_API_KEY = 'test-only-key';
  const app = express();
  app.use(express.json());
  app.use('/api/pool', poolRoutes);
  app.use('/api', (_req, res) => res.status(401).json({ error: 'No token provided' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  let upstream = { jsonrpc: '2.0', id: 1, result: { standard: { maxFeePerGas: '0x1' } } };
  const originalPost = axios.post;
  let upstreamUrl;
  axios.post = async (url) => { upstreamUrl = url; return { data: upstream, status: 200 }; };
  const request = async (path, body, token) => {
    const response = await originalFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await request('/api/pool/session', {})).status, 401);
    const token = jwt.sign({ id: 'proxy-test' }, process.env.JWT_SECRET || 'world-id-secret-key-2024');
    const session = await request('/api/pool/session', { sender: '0x1212121212121212121212121212121212121212' }, token);
    assert.equal(session.status, 200);
    const rpc = { jsonrpc: '2.0', id: 7, method: 'pimlico_getUserOperationGasPrice', params: [] };
    const gas = await request(session.body.path, rpc);
    assert.equal(gas.body.jsonrpc, '2.0');
    assert.equal(gas.body.id, 7);
    assert.ok(gas.body.result.standard);
    assert.ok(upstreamUrl.includes('/v2/11155111/rpc'));
    const baseSession = await request('/api/pool/session', { sender: '0x1212121212121212121212121212121212121212', chainId: 8453 }, token);
    await request(baseSession.body.path, rpc);
    assert.ok(upstreamUrl.includes('/v2/8453/rpc'));
    assert.equal((await request('/api/pool/session', { sender: '0x1212121212121212121212121212121212121212', chainId: 999 }, token)).status, 400);
    assert.equal((await request('/api/pool/bundler/expired', rpc)).body.error.code, -32001);
    assert.equal((await request(session.body.path, { ...rpc, method: 'unsupported' })).body.error.code, -32601);
    assert.equal((await request(session.body.path, { ...rpc, method: 'eth_sendUserOperation', params: [{ sender: '0xwrong' }] })).body.error.code, -32602);
    upstream = { error: 'invalid credentials' };
    assert.equal((await request(session.body.path, rpc)).body.error.code, -32000);
  } finally {
    axios.post = originalPost;
    await new Promise(resolve => server.close(resolve));
  }
});
