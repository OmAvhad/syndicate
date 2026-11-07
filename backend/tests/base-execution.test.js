import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { encodeEventTopics, encodeAbiParameters, erc20Abi } from 'viem';
import { verifyBaseExecution, syncBaseTrade, BASE_USDC, BASE_WETH } from '../src/services/baseExecution.js';

test('Base recording verifies actual settlement and reconciles a protective exit from receipts', async () => {
  const burner = '0x1111111111111111111111111111111111111111';
  const vault = '0x2222222222222222222222222222222222222222';
  const entryHash = `0x${'aa'.repeat(32)}`;
  const exitHash = `0x${'bb'.repeat(32)}`;
  const transfer = (address, from, to, value) => ({ address, topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }), data: encodeAbiParameters([{ type: 'uint256' }], [value]) });
  const receipt = logs => ({ status: '0x1', blockNumber: '0x100', gasUsed: '0x100', effectiveGasPrice: '0x2', l1Fee: '0x10', logs });
  let settled = true;
  const originalGet = axios.get, originalPost = axios.post;
  axios.get = async url => ({ data: url.includes('protective') ? { order: { funderAddress: burner, side: 'sell', status: 'ORDER_STATUS_FILLED', qty: '0.0002' }, fills: [{ transactionId: exitHash }] } : { order: { funderAddress: burner, side: 'buy', status: settled ? 'ORDER_STATUS_FILLED' : 'ORDER_STATUS_ACCEPTED', attachedBracket: { bracketOrderId: 'protective' } }, fills: [{ transactionId: entryHash }] } });
  axios.post = async (_url, request) => ({ data: { result: request.method === 'eth_getBlockByNumber' ? { timestamp: '0x1000' } : request.params[0] === entryHash ? receipt([transfer(BASE_USDC, burner, vault, 500000n), transfer(BASE_WETH, vault, burner, 200000000000000n)]) : receipt([transfer(BASE_WETH, burner, vault, 200000000000000n), transfer(BASE_USDC, vault, burner, 480000n)]) } });
  try {
    const entry = await verifyBaseExecution('entry', entryHash, burner, 'BUY', '0.5');
    assert.equal(entry.usdc, 500000n);
    assert.equal(entry.weth, 200000000000000n);
    assert.equal(entry.gasWei, '528');
    await assert.rejects(() => verifyBaseExecution('entry', entryHash, burner, 'BUY', '0.55'), /do not match/);
    settled = false;
    await assert.rejects(() => verifyBaseExecution('entry', entryHash, burner, 'BUY', '0.5'), /not fully filled/);
    settled = true;
    const trade = { network: 'BASE_MAINNET', side: 'BUY', status: 'EXECUTED', receiptsVerified: true, definitiveOrderId: 'entry', burnerAccountAddress: burner, entryUsdcUnits: '500000', wethUnits: '200000000000000', entryBlockTimestamp: entry.time, save: async () => {} };
    await syncBaseTrade(trade);
    assert.equal(trade.status, 'CLOSED');
    assert.equal(trade.realizedPnlUnits, '-20000');
    assert.equal(trade.exitType, 'protective');
    assert.equal(trade.exitPayoutTxHash, exitHash);
  } finally { axios.get = originalGet; axios.post = originalPost; }
});
