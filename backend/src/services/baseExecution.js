import axios from 'axios';
import { Agent } from 'node:https';
import { decodeEventLog, erc20Abi, parseUnits } from 'viem';
const agent = new Agent({ keepAlive: true });
export const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const BASE_WETH = '0x4200000000000000000000000000000000000006';
const devKey = 'dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b';
export async function baseRead(method, params) {
  const { data } = await axios.post(process.env.BASE_RPC_URL || 'https://mainnet.base.org', { jsonrpc: '2.0', id: 1, method, params }, { httpsAgent: agent, timeout: 30000 });
  if (data.error) throw new Error('Base receipt verification unavailable. Keep the order ID and retry.');
  return data.result;
}
export async function definitiveOrder(orderId, burner) {
  if (!orderId || !/^[a-zA-Z0-9_-]{1,100}$/.test(orderId)) throw new Error('A Definitive order ID is required.');
  const { data } = await axios.get(`https://flash.definitive.fi/v1/orders/${encodeURIComponent(orderId)}`, { params: { funderAddress: burner }, headers: { 'x-definitive-api-key': process.env.DEFINITIVE_API_KEY || devKey }, httpsAgent: agent, timeout: 30000 });
  if (data.order?.funderAddress?.toLowerCase() !== burner.toLowerCase()) throw new Error('Definitive order funder mismatch.');
  return data;
}
export function tokenNet(receipt, token, burner) {
  let net = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;
    try {
      const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (event.eventName !== 'Transfer') continue;
      if (event.args.to.toLowerCase() === burner.toLowerCase()) net += event.args.value;
      if (event.args.from.toLowerCase() === burner.toLowerCase()) net -= event.args.value;
    } catch {}
  }
  return net;
}
export async function verifyBaseExecution(orderId, hash, burner, side, amount) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('A real Base settlement hash is required.');
  const detail = await definitiveOrder(orderId, burner);
  if (detail.order.status !== 'ORDER_STATUS_FILLED' && detail.order.closeReason !== 'REASON_FULLY_FILLED') throw new Error('Definitive order is not fully filled.');
  if (detail.order.side?.toUpperCase() !== side || !detail.fills?.some(fill => fill.transactionId?.toLowerCase() === hash.toLowerCase())) throw new Error('Settlement does not match the Definitive order.');
  const hashes = new Set(detail.fills.map(fill => fill.transactionId));
  if (hashes.size !== 1) throw new Error('Multiple-fill orders require reconciliation before recording.');
  const receipt = await baseRead('eth_getTransactionReceipt', [hash]);
  if (!receipt || receipt.status !== '0x1') throw new Error('Base settlement is pending or reverted.');
  const usdc = tokenNet(receipt, BASE_USDC, burner);
  const weth = tokenNet(receipt, BASE_WETH, burner);
  const spent = side === 'BUY' ? -usdc : -weth;
  const received = side === 'BUY' ? weth : usdc;
  if (spent <= 0n || received <= 0n || spent !== parseUnits(String(amount), side === 'BUY' ? 6 : 18)) throw new Error('Actual Base transfers do not match the trade amount and direction.');
  const block = await baseRead('eth_getBlockByNumber', [receipt.blockNumber, false]);
  const gasWei = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice) + BigInt(receipt.l1Fee || '0x0') + BigInt(receipt.operatorFee || '0x0');
  return { usdc: usdc < 0n ? -usdc : usdc, weth: weth < 0n ? -weth : weth, time: new Date(Number(BigInt(block.timestamp)) * 1000), gasWei: gasWei.toString(), bracketOrderId: detail.order.attachedBracket?.bracketOrderId || null };
}

export async function syncBaseTrade(trade) {
  if (trade.network !== 'BASE_MAINNET' || trade.status !== 'EXECUTED' || !trade.receiptsVerified || trade.side !== 'BUY') return trade;
  const entry = await definitiveOrder(trade.definitiveOrderId, trade.burnerAccountAddress);
  const bracketId = entry.order.attachedBracket?.bracketOrderId;
  if (!bracketId) return trade;
  trade.bracketOrderId = bracketId;
  const exit = await definitiveOrder(bracketId, trade.burnerAccountAddress);
  if (exit.order.status === 'ORDER_STATUS_FILLED' || exit.order.closeReason === 'REASON_FULLY_FILLED') {
    const hashes = [...new Set(exit.fills.map(fill => fill.transactionId))];
    if (hashes.length !== 1) throw new Error('Protective order has multiple fills; automatic result reconciliation stopped.');
    const result = await verifyBaseExecution(bracketId, hashes[0], trade.burnerAccountAddress, 'SELL', exit.order.qty);
    if (result.weth !== BigInt(trade.wethUnits)) throw new Error('Protective exit quantity does not close this entire position.');
    if (result.time < new Date(trade.entryBlockTimestamp)) throw new Error('Protective exit predates entry.');
    trade.status = 'CLOSED';
    trade.exitReturnTxHash = hashes[0];
    trade.exitPayoutTxHash = hashes[0];
    trade.exitUsdcUnits = result.usdc.toString();
    trade.realizedPnlUnits = (result.usdc - BigInt(trade.entryUsdcUnits)).toString();
    trade.exitGasWei = result.gasWei;
    trade.exitPrice = Number(result.usdc) / 1e6 / (Number(result.weth) / 1e18);
    trade.closedAt = result.time;
    // Do not infer which trigger fired from P/L or execution slippage.
    trade.exitType = 'protective';
  }
  await trade.save();
  return trade;
}
