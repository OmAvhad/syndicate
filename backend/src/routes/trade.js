import express from 'express';
import crypto from 'crypto';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Trade from '../models/Trade.js';
import TradeSignal from '../models/TradeSignal.js';
import TradePromise from '../models/TradePromise.js';
import { verifiedTransfer, VAULT, USDC, WETH, exitPayout, blockTimestamp } from '../services/tradeReceipts.js';
import { claimTradeResult, readResultClaims, matchingClaim } from '../services/promiseClaims.js';
import { hashTradePayload, encryptTradeSignal, decryptTradeSignal, encryptForMetaMask } from '../services/tradeCrypto.js';
import { storeTradeSignalInArkiv, storeTradePromiseInArkiv } from '../services/arkiv.js';
import { sendSignalToFollower, broadcastToAll } from '../websocket.js';
import { recalculateLeaderStats } from '../services/statsCalculator.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/trades/promise (spec.md)
 * "After placing trades it should trigger '/promise' api in this api send payload
 * of the above trade details but hash it before sending store a hash key in the .env
 * wait for promise response (mock it for now)"
 */
router.post('/promise', async (req, res) => {
  try {
    const {
      symbol,
      side,
      orderType = 'LIMIT',
      limit,
      amount,
      stopLoss = 0,
      target = 0,
      burnerAccountAddress = '',
      payloadHash,
      network = 'SEPOLIA_TESTNET',
      definitiveQuoteId,
    } = req.body;

    if (!symbol || !side || limit === undefined || amount === undefined) {
      return res.status(400).json({ error: 'Missing required trade parameters (symbol, side, limit, amount)' });
    }

    // Retrieve leader to compute sequential trade counter (Trade #1, Trade #2...)
    const leader = await User.findByIdAndUpdate(req.user.userId, { $inc: { tradeCount: 1 } }, { new: true });
    if (!leader) return res.status(404).json({ error: 'Leader not found.' });
    const tradeIndex = leader.tradeCount;

    const tradeData = {
      tradeIndex,
      symbol,
      side,
      orderType,
      limit: Number(limit),
      amount: Number(amount),
      stopLoss: Number(stopLoss),
      target: Number(target),
      burnerAccountAddress,
      network,
      definitiveQuoteId: definitiveQuoteId || null,
    };

    // Calculate/verify server-side HMAC hash using secret stored in .env including tradeIndex
    const calculatedHash = hashTradePayload(tradeData);

    const promiseId = `prm_${tradeIndex}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    console.log(`[Trade Promise] Leader ${req.user.userId} committed Trade #${tradeIndex} promise ${promiseId} for ${symbol} ${side}`);
    console.log(`[Trade Promise] Hash: ${calculatedHash}`);

    // Store sealed promise on Arkiv with 30-day audit retention
    const arkivResult = await storeTradePromiseInArkiv({
      promiseId,
      leaderPublicKey: leader?.walletAddress || '0x0000000000000000000000000000000000000000',
      leaderNullifier: leader?.nullifierHash || '',
      tradeIndex,
      payloadHash: calculatedHash,
      timestamp: new Date().toISOString(),
    });
    await TradePromise.create({ promiseId, userId: leader._id, tradeIndex, leaderPublicKey: leader.walletAddress, payloadHash: calculatedHash, payload: tradeData, arkivEntityKey: arkivResult.entityKey, arkivOnChain: arkivResult.onChain });

    return res.json({
      success: true,
      promiseId,
      tradeIndex,
      status: 'COMMITTED',
      symbol: tradeData.symbol,
      side: tradeData.side,
      limit: tradeData.limit,
      amount: tradeData.amount,
      payloadHash: calculatedHash,
      arkivEntityKey: arkivResult.entityKey,
      arkivTxHash: arkivResult.txHash,
      timestamp: new Date().toISOString(),
      message: `Trade promise #${tradeIndex} cryptographically sealed and committed on Arkiv`,
    });
  } catch (error) {
    console.error('[Trade Promise] Error:', error.message);
    return res.status(500).json({ error: 'Failed to commit trade promise: ' + error.message });
  }
});

/**
 * POST /api/trades/execute (spec.md)
 * "1. trade execution (mock it for now - send the same payload for which we sent for promise)"
 * "if the user executes the trade call trade-execution api and send the trade details,
 * the user can change the amount details and send order"
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      symbol,
      side,
      orderType = 'LIMIT',
      limit,
      amount,
      stopLoss = 0,
      target = 0,
      burnerAccountAddress = '',
      payloadHash,
      promiseId,
      tradeIndex = 1,
      isCopyTrade = false,
      originalSignalId = null,
    } = req.body;

    const currentUserId = req.user.userId;

    if (!symbol || !side || limit === undefined || amount === undefined) {
      return res.status(400).json({ error: 'Missing required execution parameters' });
    }

    const tradeData = {
      tradeIndex: Number(tradeIndex || 1),
      symbol,
      side,
      orderType,
      limit: Number(limit),
      amount: Number(amount),
      stopLoss: Number(stopLoss),
      target: Number(target),
      burnerAccountAddress,
    };

    const isBaseMainnet = req.body.network === 'BASE_MAINNET';
    const executionTxHash = req.body.executionTxHash || req.body.definitiveOrderId || `base_def_${Date.now()}`;
    const existing = await Trade.findOne({ userId: currentUserId, executionTxHash, receiptsVerified: true });
    if (existing) return res.json({ success: true, tradeId: existing._id, executionTxHash, status: existing.status });
    if (!/^0x[0-9a-f]{40}$/i.test(burnerAccountAddress)) return res.status(400).json({ error: 'The actual execution burner address is required.' });

    let entry = { amount: BigInt(Math.round(Number(amount) * 1e6)), gasWei: '21000' };
    let delivery = { amount: 100000000000000n, gasWei: '21000' };
    let entryTime = new Date();

    if (!isBaseMainnet) {
      entry = await verifiedTransfer(executionTxHash, USDC, burnerAccountAddress, VAULT);
      delivery = await verifiedTransfer(req.body.entryDeliveryTxHash, WETH, VAULT, burnerAccountAddress);
      if (BigInt(delivery.receipt.blockNumber) < BigInt(entry.receipt.blockNumber)) throw new Error('Position delivery predates entry.');
      if (entry.amount !== BigInt(Math.round(Number(amount) * 1e6))) throw new Error('USDC transfer does not match the recorded capital.');
      entryTime = await blockTimestamp(entry.receipt.blockNumber);
    }

    const sourceSignal = originalSignalId ? await TradeSignal.findOne({ signalId: originalSignalId, followerId: currentUserId, status: 'ACTIVE' }) : null;
    if (isCopyTrade && (!sourceSignal || new Date(sourceSignal.expiresAt) < entryTime)) return res.status(400).json({ error: 'An owned signal valid at entry is required to record a copy.' });
    const sealed = !isCopyTrade ? await TradePromise.findOne({ promiseId, userId: currentUserId }) : null;
    if (sealed && sealed.payloadHash !== hashTradePayload(tradeData)) return res.status(400).json({ error: 'Execution parameters do not match the sealed promise.' });
    const hash = isCopyTrade ? sourceSignal.tradePayload.payloadHash : (sealed?.payloadHash || payloadHash || hashTradePayload(tradeData));
    const executionPrice = Number(limit);

    // Save Trade record to MongoDB
    const entryRecord = {
      userId: currentUserId,
      isCopyTrade: Boolean(isCopyTrade),
      tradeIndex: Number(tradeIndex || 1),
      network: isBaseMainnet ? 'BASE_MAINNET' : 'SEPOLIA_TESTNET',
      definitiveOrderId: req.body.definitiveOrderId || null,
      definitiveQuoteId: req.body.definitiveQuoteId || null,
      symbol: tradeData.symbol,
      side: tradeData.side,
      orderType: tradeData.orderType,
      limit: tradeData.limit,
      amount: tradeData.amount,
      stopLoss: tradeData.stopLoss,
      target: tradeData.target,
      burnerAccountAddress: tradeData.burnerAccountAddress,
      payloadHash: hash,
      promiseId: sealed?.promiseId || sourceSignal?.tradePayload?.promiseId || promiseId,
      promisePayload: sealed?.payload || sourceSignal?.tradePayload || (!isCopyTrade ? tradeData : undefined),
      promiseLeaderAddress: sealed?.leaderPublicKey || sourceSignal?.leaderPublicKey || (await User.findById(currentUserId))?.walletAddress,
      promiseEntityKey: sealed?.arkivEntityKey,
      leaderId: sourceSignal?.leaderId,
      originalSignalId,
      entryDeliveryTxHash: req.body.entryDeliveryTxHash || null,
      entryUsdcUnits: entry.amount.toString(),
      wethUnits: delivery.amount.toString(),
      entryGasWei: entry.gasWei,
      entryBlockTimestamp: entryTime,
      receiptsVerified: true,
      status: 'EXECUTED',
      executionPrice,
      executionTxHash,
    };
    const legacy = !isCopyTrade && promiseId ? await Trade.findOne({ userId: currentUserId, promiseId, receiptsVerified: { $ne: true } }) : null;
    const trade = legacy ? await Trade.findByIdAndUpdate(legacy._id, { $set: entryRecord }, { new: true }) : await Trade.create(entryRecord);

    // If this execution came from a follower copying a signal, mark signal as executed
    if (originalSignalId) {
      await TradeSignal.findOneAndUpdate(
        { signalId: originalSignalId, followerId: currentUserId },
        { status: 'EXECUTED', executedAt: new Date() }
      );
    }

    console.log(`[Trade Execution] Order ${trade._id} filled: ${symbol} ${side} ${amount} @ ${limit} (Copy: ${isCopyTrade})`);

    return res.json({
      success: true,
      tradeId: trade._id,
      tradeIndex: trade.tradeIndex || 1,
      symbol: trade.symbol,
      side: trade.side,
      orderType: trade.orderType,
      limit: trade.limit,
      amount: trade.amount,
      executionPrice,
      executionTxHash,
      status: 'FILLED',
      timestamp: new Date().toISOString(),
      message: isCopyTrade
        ? 'Copy trade order executed successfully'
        : 'Leader trade order executed and filled',
    });
  } catch (error) {
    console.error('[Trade Execution] Error:', error.message);
    return res.status(500).json({ error: 'Failed to execute trade order: ' + error.message });
  }
});

/**
 * POST /api/trades/signal (spec.md)
 * "2. trade signal - send signal to followers about the trade (this trade should be encrypted by the follower's public key),
 * after encryption save it in ArkDB with hash key (id)
 * we will be storing it in a new table, create a table with following columns
 * id, encryptedTradeSignal, leader publickey, follower publickey, ttl (time-to-live)
 * timetolive should only be for 10 minutes
 * Using websockets send the trade signal to the user decrypt it for the user and show on UI only till its time to live"
 */
router.post('/signal', async (req, res) => {
  try {
    const leaderId = req.user.userId;
    const {
      symbol,
      side,
      orderType = 'LIMIT',
      limit,
      amount,
      stopLoss = 0,
      target = 0,
      burnerAccountAddress = '',
      payloadHash,
      tradeIndex = 1,
      network = 'SEPOLIA_TESTNET',
      definitiveQuoteId,
      definitiveOrderId,
    } = req.body;

    const leader = await User.findById(leaderId);
    if (!leader || !leader.walletAddress) {
      return res.status(400).json({ error: 'Leader must have a connected wallet address to broadcast signals' });
    }

    const effectiveTradeIndex = Number(tradeIndex || leader.tradeCount || 1);

    const tradeData = {
      tradeIndex: effectiveTradeIndex,
      symbol,
      side,
      orderType,
      limit: Number(limit),
      amount: Number(amount),
      stopLoss: Number(stopLoss),
      target: Number(target),
      burnerAccountAddress,
      network,
      definitiveQuoteId: definitiveQuoteId || null,
      definitiveOrderId: definitiveOrderId || null,
      payloadHash: payloadHash || hashTradePayload({ tradeIndex: effectiveTradeIndex, symbol, side, orderType, limit, amount, stopLoss, target, burnerAccountAddress }),
      leaderUsername: leader.username || null,
      promiseId: req.body.promiseId,
      leaderNullifier: leader.nullifierHash,
    };

    // 1. Fetch all active followers for this leader from MongoDB Follow collection
    const now = new Date();
    const activeFollows = await Follow.find({
      leaderId,
      status: 'active',
      expiresAt: { $gt: now },
    }).populate('followerId', 'username walletAddress nullifierHash encryptionPublicKey');

    if (activeFollows.length === 0) {
      return res.json({
        success: true,
        message: 'Trade executed. No active followers to broadcast signal to.',
        signalsCreated: 0,
        followersCount: 0,
      });
    }

    const ttlSeconds = 600; // 10 minutes strictly per spec.md
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const createdSignals = [];

    // 2. For each active follower, encrypt with follower public key, store in ArkDB, and send over WebSocket
    for (const follow of activeFollows) {
      const follower = follow.followerId;
      if (!follower || !follower.walletAddress) continue;

      const signalId = `sig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      let encryptedTradeSignal = '';
      let encryptedPayloadHex = null;
      let requiresMetaMaskDecrypt = false;

      // If follower has an asymmetric encryption public key registered via eth_getEncryptionPublicKey:
      if (follower.encryptionPublicKey) {
        try {
          const metaEnc = encryptForMetaMask(tradeData, follower.encryptionPublicKey);
          encryptedTradeSignal = metaEnc.jsonString;
          encryptedPayloadHex = metaEnc.encryptedHex;
          requiresMetaMaskDecrypt = true;
          console.log(`[Trade Signal] Encrypted using MetaMask ECIES public key for ${follower.username || follower._id}`);
        } catch (encErr) {
          console.warn('[Trade Signal] MetaMask encryption failed, falling back to AES-GCM:', encErr.message);
        }
      }

      // Fallback to symmetric AES-GCM if no eth encryption key or failure
      if (!encryptedPayloadHex) {
        encryptedTradeSignal = encryptTradeSignal(tradeData, follower.walletAddress);
        requiresMetaMaskDecrypt = false;
      }

      // Save entity to ArkDB / Arkiv with 10-minute TTL
      const arkivResult = await storeTradeSignalInArkiv({
        signalId,
        encryptedTradeSignal,
        leaderPublicKey: leader.walletAddress,
        followerPublicKey: follower.walletAddress,
        ttl: ttlSeconds,
      });

      // Save record in MongoDB for query persistence
      const signalRecord = await TradeSignal.create({
        signalId,
        leaderId: leader._id,
        leaderPublicKey: leader.walletAddress,
        followerId: follower._id,
        followerPublicKey: follower.walletAddress,
        encryptedTradeSignal,
        encryptedPayloadHex,
        requiresMetaMaskDecrypt,
        tradePayload: tradeData,
        arkivEntityKey: arkivResult.entityKey,
        arkivTxHash: arkivResult.txHash,
        ttlSeconds,
        expiresAt,
        status: 'ACTIVE',
      });

      // Payload delivered to the follower
      const signalMessage = {
        signalId,
        followerPublicKey: follower.walletAddress,
        tradeIndex: effectiveTradeIndex,
        leaderPublicKey: leader.walletAddress,
        leaderUsername: leader.username || 'Verified Leader',
        symbol: tradeData.symbol,
        side: tradeData.side,
        orderType: tradeData.orderType,
        arkivEntityKey: arkivResult.entityKey,
        ttlSeconds,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        requiresMetaMaskDecrypt,
        encryptedPayloadHex,
        // If not requiring MetaMask decrypt, provide the initial plain numbers
        limit: requiresMetaMaskDecrypt ? null : tradeData.limit,
        amount: requiresMetaMaskDecrypt ? null : tradeData.amount,
        stopLoss: requiresMetaMaskDecrypt ? null : tradeData.stopLoss,
        target: requiresMetaMaskDecrypt ? null : tradeData.target,
        burnerAccountAddress: requiresMetaMaskDecrypt ? null : tradeData.burnerAccountAddress,
      };

      // 3. Send over WebSocket directly to follower in real-time
      const sentCount = sendSignalToFollower(follower._id.toString(), signalMessage);
      console.log(`[Trade Signal] Dispatched signal ${signalId} to follower ${follower.username || follower._id} (requiresMetaMask: ${requiresMetaMaskDecrypt}, WebSockets active: ${sentCount})`);

      createdSignals.push({
        signalId,
        followerId: follower._id,
        arkivEntityKey: arkivResult.entityKey,
        requiresMetaMaskDecrypt,
      });
    }

    return res.json({
      success: true,
      message: `Trade signal encrypted and anchored to ArkDB for ${createdSignals.length} follower(s) with 10-minute TTL`,
      signalsCreated: createdSignals.length,
      followersNotified: createdSignals.length,
      signals: createdSignals,
      ttlSeconds,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[Trade Signal] Error broadcasting signal:', error.message);
    return res.status(500).json({ error: 'Failed to broadcast trade signal: ' + error.message });
  }
});

/**
 * GET /api/trades/signals/active (spec.md)
 * Retrieve currently active trade signals for logged-in follower with remaining TTL
 */
router.post('/signals/:signalId/refresh-encryption', async (req, res) => {
  try {
    const { encryptionPublicKey, walletAddress } = req.body;
    if (typeof encryptionPublicKey !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encryptionPublicKey) || Buffer.from(encryptionPublicKey, 'base64').length !== 32) {
      return res.status(400).json({ error: 'A valid MetaMask encryption public key is required.' });
    }
    const follower = await User.findById(req.user.userId);
    if (!follower?.walletAddress || follower.walletAddress.toLowerCase() !== walletAddress?.toLowerCase()) {
      return res.status(409).json({ error: 'Your linked follower wallet changed. Reopen the signal with its original wallet.' });
    }
    const signal = await TradeSignal.findOne({ signalId: req.params.signalId, followerId: req.user.userId, status: 'ACTIVE', expiresAt: { $gt: new Date() } });
    if (!signal) return res.status(404).json({ error: 'This signal is expired, already executed, or not available to your account.' });
    if (!signal.requiresMetaMaskDecrypt || signal.followerPublicKey.toLowerCase() !== follower.walletAddress.toLowerCase()) {
      return res.status(409).json({ error: 'This signal belongs to a different encryption wallet.' });
    }
    const payload = signal.tradePayload.toObject ? signal.tradePayload.toObject() : signal.tradePayload;
    const encrypted = encryptForMetaMask(payload, encryptionPublicKey);
    const update = await User.updateOne({ _id: follower._id, walletAddress: follower.walletAddress }, { $set: { encryptionPublicKey } });
    if (!update.matchedCount) return res.status(409).json({ error: 'Your linked wallet changed during key refresh.' });
    // Refresh only the delivery envelope. Original Arkiv ciphertext/commitment
    // and signal expiry remain unchanged; no plaintext is returned to the client.
    const saved = await TradeSignal.updateOne({ _id: signal._id, followerId: req.user.userId, status: 'ACTIVE', expiresAt: { $gt: new Date() } }, { $set: { encryptedPayloadHex: encrypted.encryptedHex } });
    if (!saved.matchedCount) return res.status(410).json({ error: 'The signal expired during key refresh.' });
    return res.json({ success: true, encryptedPayloadHex: encrypted.encryptedHex, followerPublicKey: follower.walletAddress, expiresAt: signal.expiresAt });
  } catch { return res.status(500).json({ error: 'Unable to refresh signal encryption.' }); }
});

router.get('/signals/active', async (req, res) => {
  try {
    const followerId = req.user.userId;
    const now = new Date();

    const activeSignals = await TradeSignal.find({
      followerId,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    })
      .populate('leaderId', 'username walletAddress nullifierHash')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = activeSignals.map((s) => {
      const remainingSeconds = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000));
      return {
        signalId: s.signalId,
        tradeIndex: s.tradePayload?.tradeIndex || 1,
        leaderPublicKey: s.leaderPublicKey,
        leaderUsername: s.leaderId?.username || 'Verified Leader',
        symbol: s.tradePayload?.symbol,
        side: s.tradePayload?.side,
        orderType: s.tradePayload?.orderType,
        network: s.tradePayload?.network || 'SEPOLIA_TESTNET',
        definitiveQuoteId: s.tradePayload?.definitiveQuoteId || null,
        definitiveOrderId: s.tradePayload?.definitiveOrderId || null,
        requiresMetaMaskDecrypt: Boolean(s.requiresMetaMaskDecrypt),
        encryptedPayloadHex: s.encryptedPayloadHex || null,
        followerPublicKey: s.followerPublicKey,
        limit: s.requiresMetaMaskDecrypt ? null : s.tradePayload?.limit,
        amount: s.requiresMetaMaskDecrypt ? null : s.tradePayload?.amount,
        stopLoss: s.requiresMetaMaskDecrypt ? null : s.tradePayload?.stopLoss,
        target: s.requiresMetaMaskDecrypt ? null : s.tradePayload?.target,
        burnerAccountAddress: s.requiresMetaMaskDecrypt ? null : s.tradePayload?.burnerAccountAddress,
        arkivEntityKey: s.arkivEntityKey,
        ttlSeconds: s.ttlSeconds,
        remainingSeconds,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      };
    });

    return res.json({
      success: true,
      signals: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('[Active Signals] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch active trade signals' });
  }
});

/**
 * GET /api/trades/history
 * Retrieve trade order execution history for user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page || '0', 10) || 0));
    const trades = await Trade.find({ userId })
      .sort({ createdAt: -1 })
      .skip(page * 25).limit(25)
      .lean();

    return res.json({
      success: true,
      trades,
      total: await Trade.countDocuments({ userId }), page,
    });
  } catch (error) {
    console.error('[Trade History] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

router.post('/:tradeId/exit', async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.tradeId, userId: req.user.userId });
    if (!trade || !trade.receiptsVerified) return res.status(404).json({ error: 'A receipt-verified trade belonging to your account is required.' });
    if (trade.status === 'CLOSED') return res.json({ success: true, trade });
    const { exitType, exitReturnTxHash, exitPayoutTxHash } = req.body;
    if (!['tp', 'sl'].includes(exitType)) return res.status(400).json({ error: 'Choose bull/take-profit or bear/stop-loss.' });
    const price = exitType === 'tp' ? trade.target : trade.stopLoss;
    if (!price || price <= 0) return res.status(400).json({ error: 'The stored exit target is invalid.' });
    const returned = await verifiedTransfer(exitReturnTxHash, WETH, trade.burnerAccountAddress, VAULT);
    const payout = await verifiedTransfer(exitPayoutTxHash, USDC, VAULT, trade.burnerAccountAddress);
    if (returned.amount !== BigInt(trade.wethUnits) || payout.amount !== exitPayout(trade.entryUsdcUnits, trade.wethUnits, price)) throw new Error('Exit transfers do not match this position and scenario payout.');
    if (BigInt(payout.receipt.blockNumber) < BigInt(returned.receipt.blockNumber)) throw new Error('Exit payout predates the position return.');
    const closed = await Trade.findOneAndUpdate({ _id: trade._id, userId: req.user.userId, status: 'EXECUTED' }, { $set: { status: 'CLOSED', exitType, exitPrice: price, exitReturnTxHash, exitPayoutTxHash, exitUsdcUnits: payout.amount.toString(), realizedPnlUnits: (payout.amount - BigInt(trade.entryUsdcUnits)).toString(), exitGasWei: returned.gasWei, closedAt: await blockTimestamp(payout.receipt.blockNumber) } }, { new: true });
    // Recalculate cached leader stats
    recalculateLeaderStats(req.user.userId).catch(() => {});
    return res.json({ success: true, trade: closed || await Trade.findById(trade._id) });
  } catch (error) { return res.status(400).json({ error: error.message || 'Exit recording failed; keep both receipt hashes and retry.' }); }
});
router.get('/claims/status', async (req, res) => {
  try {
    const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(id => /^[0-9a-f]{24}$/i.test(id)).slice(0, 50) : [];
    const trades = await Trade.find({ userId: req.user.userId, ...(ids.length ? { _id: { $in: ids } } : {}) }).sort({ createdAt: -1 }).limit(50).lean();
    const claims = await readResultClaims(req.user.userId, undefined, trades.map(trade => trade._id));
    return res.json({ success: true, statuses: Object.fromEntries(trades.map(trade => [String(trade._id), matchingClaim(trade, claims)?.entityKey || null])) });
  } catch { return res.status(503).json({ error: 'Arkiv claim status is unavailable. Unknown does not mean unclaimed; retry verification.' }); }
});
router.post('/:tradeId/claim', async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.tradeId, userId: req.user.userId });
    if (!trade) return res.status(404).json({ error: 'Trade not found.' });
    const claim = await claimTradeResult(trade);
    trade.claimEntityKey = claim.entityKey;
    if (claim.txHash) trade.claimTxHash = claim.txHash;
    await trade.save();
    recalculateLeaderStats(req.user.userId).catch(() => {});
    return res.json({ success: true, ...claim });
  } catch (error) { return res.status(400).json({ error: error.message || 'Claim verification/write failed. Refresh Arkiv status before retrying.' }); }
});
router.get('/:tradeId', async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.tradeId, userId: req.user.userId });
    if (!trade) return res.status(404).json({ error: 'Trade not found.' });
    return res.json({ success: true, trade });
  } catch { return res.status(400).json({ error: 'Invalid trade identifier.' }); }
});
export default router;

