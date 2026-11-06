import axios from 'axios';
import { Agent } from 'node:https';
import { decodeEventLog, erc20Abi, parseUnits } from 'viem';
import '../env.js';

export const VAULT = '0xa360946725811dabb91c054a3dff25ed25c005e8';
export const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
export const WETH = '0x7b79995e5f793a07bc00c21412e50ecae098e7f9';
const agent = new Agent({ keepAlive: true });
const cache = new Map();
export async function chainRead(method, params) {
  for (let attempt = 0; ; attempt++) {
    const response = await axios.post(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com', { jsonrpc: '2.0', id: 1, method, params }, { httpsAgent: agent, timeout: 60000, validateStatus: () => true });
    if ((response.status === 429 || response.data?.error?.code === -32005) && attempt < 3) { await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt)); continue; }
    if (response.status !== 200 || response.data?.error) throw new Error('Sepolia receipt verification is unavailable; retain the transaction hashes and retry recording.');
    return response.data.result;
  }
}
export async function verifiedTransfer(hash, token, from, to) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('A real transaction hash is required.');
  let receipt = cache.get(hash.toLowerCase());
  if (!receipt) {
    receipt = await chainRead('eth_getTransactionReceipt', [hash]);
    if (!receipt || receipt.status !== '0x1') throw new Error('Transaction is pending or reverted.');
    if (cache.size > 1000) cache.clear();
    cache.set(hash.toLowerCase(), receipt);
  }
  let amount = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (event.eventName === 'Transfer' && event.args.from.toLowerCase() === from.toLowerCase() && event.args.to.toLowerCase() === to.toLowerCase()) amount += event.args.value;
    } catch {}
  }
  if (amount <= 0n) throw new Error('Receipt does not contain the expected token transfer between this burner and vault.');
  return { receipt, amount, gasWei: (BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)).toString() };
}
export function exitPayout(entryUnits, wethUnits, exitPrice) {
  const gross = BigInt(wethUnits) * parseUnits(String(exitPrice), 6) / 10n ** 18n;
  const fee = BigInt(entryUnits) * 30n / 10_000n;
  return gross > fee ? gross - fee : 0n;
}
export async function blockTimestamp(blockNumber) {
  const block = await chainRead('eth_getBlockByNumber', [blockNumber, false]);
  return new Date(Number(BigInt(block.timestamp)) * 1000);
}
