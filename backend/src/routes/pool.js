import express from 'express';
import { randomBytes } from 'node:crypto';
import { Agent } from 'node:https';
import axios from 'axios';
import auth from '../middleware/auth.js';

const router = express.Router();
const sessions = new Map();
const pimlicoAgent = new Agent({ keepAlive: true });
const methods = new Set(['eth_chainId', 'eth_supportedEntryPoints', 'pimlico_getUserOperationGasPrice', 'eth_estimateUserOperationGas', 'eth_sendUserOperation', 'eth_getUserOperationReceipt', 'eth_getUserOperationByHash']);
function rpcError(req, res, code, message, data) {
  return res.json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code, message, ...(data ? { data } : {}) } });
}
router.post('/session', auth, (req, res) => {
  if (!process.env.PIMLICO_API_KEY) return res.status(503).json({ error: 'PIMLICO_API_KEY is not configured on the backend.' });
  if (!/^0x[0-9a-f]{40}$/i.test(req.body.sender || '')) return res.status(400).json({ error: 'Invalid burner address.' });
  const chainId = req.body.chainId ?? 11155111;
  if (![11155111, 8453].includes(chainId)) return res.status(400).json({ error: 'Unsupported bundler chain.' });
  for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { sender: req.body.sender.toLowerCase(), chainId, expires: Date.now() + 30 * 60_000, calls: 0 });
  res.json({ path: `/api/pool/bundler/${token}` });
});
router.post('/bundler/:token', async (req, res) => {
  const session = sessions.get(req.params.token);
  if (!session || session.expires < Date.now()) return rpcError(req, res, -32001, 'Bundler session expired. Retry funding to reconnect.');
  if (++session.calls > 1500) return rpcError(req, res, -32005, 'Bundler session request limit reached.');
  const { method, params } = req.body;
  if (!methods.has(method)) return rpcError(req, res, -32601, 'Unsupported bundler method.');
  if (['eth_sendUserOperation', 'eth_estimateUserOperationGas'].includes(method) && params?.[0]?.sender?.toLowerCase() !== session.sender) {
    return rpcError(req, res, -32602, 'Operation sender must match the trading burner.');
  }
  try {
    const response = await axios.post(`https://api.pimlico.io/v2/${session.chainId}/rpc?apikey=${encodeURIComponent(process.env.PIMLICO_API_KEY)}`, req.body, {
      timeout: 120_000, httpsAgent: pimlicoAgent, validateStatus: () => true,
    });
    const body = response.data;
    if (body && typeof body === 'object' && Object.hasOwn(body, 'result')) {
      return res.json({ jsonrpc: '2.0', id: req.body.id ?? null, result: body.result });
    }
    if (body?.error && typeof body.error.code === 'number' && typeof body.error.message === 'string') {
      return res.json({ jsonrpc: '2.0', id: req.body.id ?? null, error: body.error });
    }
    return rpcError(req, res, -32000, 'Pimlico returned an invalid RPC response. Check backend configuration/connectivity.', { httpStatus: response.status });
  } catch { return rpcError(req, res, -32000, 'Pimlico request failed. Check the saved operation status before retrying.'); }
});
export default router;
