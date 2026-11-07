import { defineSchema, str } from '@arkiv-network/sdk/schema';
import { eq, and, or } from '@arkiv-network/sdk/query';
import { ExpirationTime } from '@arkiv-network/sdk';
import { getArkivPublicClient, getArkivWalletClient, TradePromiseSchema } from './arkiv.js';
import { hashTradePayload } from './tradeCrypto.js';
const fields = ['tradeId', 'userId', 'role', 'promiseId', 'promiseEntityKey', 'payloadHash', 'burnerAddress', 'entryTxHash', 'entryDeliveryTxHash', 'exitReturnTxHash', 'exitPayoutTxHash', 'entryUsdcUnits', 'exitUsdcUnits', 'realizedPnlUnits', 'claimedAt'];
export const TradeClaimSchema = defineSchema('trade_result_claims', Object.fromEntries(fields.map(field => [field, str().indexed()])));
const value = field => field?.value ?? field;
const locks = new Set();
function clients() {
  const writer = getArkivWalletClient();
  if (!writer) throw new Error('Arkiv writer is not configured; claim state cannot be verified.');
  return { writer, reader: getArkivPublicClient() };
}
export async function readResultClaims(userId, connection = clients(), tradeIds = []) {
  const { writer, reader } = connection;
  const ids = tradeIds.map(id => eq('tradeId', str(String(id))));
  const predicate = ids.length ? and(eq('userId', str(String(userId))), ids.length === 1 ? ids[0] : or(...ids)) : eq('userId', str(String(userId)));
  const result = await reader.select().from(TradeClaimSchema).where(predicate).ownedBy(writer.account.address).limit(100).fetch();
  return result.entities.map(row => Object.fromEntries([['entityKey', row.$key], ...fields.map(field => [field, value(row[field])])]));
}
export function matchingClaim(trade, claims) {
  return claims.find(claim => claim.tradeId === String(trade._id) && claim.entryTxHash?.toLowerCase() === trade.executionTxHash?.toLowerCase() && claim.exitPayoutTxHash?.toLowerCase() === trade.exitPayoutTxHash?.toLowerCase() && claim.payloadHash === trade.payloadHash);
}
export async function claimTradeResult(trade, connection) {
  if (locks.has(String(trade._id))) throw new Error('A claim is already being processed. Refresh Arkiv status before retrying.');
  locks.add(String(trade._id));
  try {
    if (trade.status !== 'CLOSED' || !trade.receiptsVerified || !trade.promiseId || !trade.exitPayoutTxHash) throw new Error('A closed, receipt-verified trade with a pre-trade promise is required.');
    const { writer, reader } = connection || clients();
    const previous = matchingClaim(trade, await readResultClaims(trade.userId, { writer, reader }, [trade._id]));
    if (previous) return { entityKey: previous.entityKey, alreadyClaimed: true };
    const result = await reader.select().from(TradePromiseSchema).where(eq('promiseId', str(trade.promiseId))).ownedBy(writer.account.address).limit(10).fetch();
    const promise = result.entities.find(row => value(row.payloadHash) === trade.payloadHash && String(value(row.leaderPublicKey)).toLowerCase() === trade.promiseLeaderAddress?.toLowerCase());
    if (!promise) throw new Error('A matching confirmed Arkiv promise could not be found. It may be unanchored or expired; no claim was written.');
    if (!trade.promisePayload || hashTradePayload(trade.promisePayload) !== trade.payloadHash) throw new Error('Stored execution does not match the committed promise payload.');
    const committedAt = new Date(value(promise.timestamp));
    if (!Number.isFinite(+committedAt) || committedAt > new Date(trade.entryBlockTimestamp)) throw new Error('The promise must predate the on-chain entry.');
    const data = { tradeId: String(trade._id), userId: String(trade.userId), role: trade.isCopyTrade ? 'FOLLOWER' : 'LEADER', promiseId: trade.promiseId, promiseEntityKey: promise.$key, payloadHash: trade.payloadHash, burnerAddress: trade.burnerAccountAddress, entryTxHash: trade.executionTxHash, entryDeliveryTxHash: trade.entryDeliveryTxHash, exitReturnTxHash: trade.exitReturnTxHash, exitPayoutTxHash: trade.exitPayoutTxHash, entryUsdcUnits: trade.entryUsdcUnits, exitUsdcUnits: trade.exitUsdcUnits, realizedPnlUnits: trade.realizedPnlUnits, claimedAt: new Date().toISOString() };
    const written = await writer.createEntity(TradeClaimSchema, Object.fromEntries(fields.map(field => [field, str(data[field])])), { expiration: ExpirationTime.fromDays(30) });
    return { entityKey: written.entityKey, txHash: written.txHash, alreadyClaimed: false };
  } finally { locks.delete(String(trade._id)); }
}
