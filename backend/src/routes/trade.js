import express from 'express';
import crypto from 'crypto';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Trade from '../models/Trade.js';
import TradeSignal from '../models/TradeSignal.js';
import { hashTradePayload, encryptTradeSignal, decryptTradeSignal } from '../services/tradeCrypto.js';
import { storeTradeSignalInArkiv, storeTradePromiseInArkiv } from '../services/arkiv.js';
import { sendSignalToFollower, broadcastToAll } from '../websocket.js';

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
    } = req.body;

    if (!symbol || !side || limit === undefined || amount === undefined) {
      return res.status(400).json({ error: 'Missing required trade parameters (symbol, side, limit, amount)' });
    }

    // Retrieve leader to compute sequential trade counter (Trade #1, Trade #2...)
    const leader = await User.findById(req.user.userId);
    const tradeIndex = (leader?.tradeCount || 0) + 1;
    await User.findByIdAndUpdate(req.user.userId, { tradeCount: tradeIndex });

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

    const hash = payloadHash || hashTradePayload(tradeData);
    const executionTxHash = `0xexec_${crypto.randomBytes(24).toString('hex')}`;
    const executionPrice = Number(limit);

    // Save Trade record to MongoDB
    const trade = await Trade.create({
      userId: currentUserId,
      isCopyTrade: Boolean(isCopyTrade),
      tradeIndex: Number(tradeIndex || 1),
      symbol: tradeData.symbol,
      side: tradeData.side,
      orderType: tradeData.orderType,
      limit: tradeData.limit,
      amount: tradeData.amount,
      stopLoss: tradeData.stopLoss,
      target: tradeData.target,
      burnerAccountAddress: tradeData.burnerAccountAddress,
      payloadHash: hash,
      promiseId: promiseId || `prm_direct_${Date.now()}`,
      status: 'EXECUTED',
      executionPrice,
      executionTxHash,
    });

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
      payloadHash: payloadHash || hashTradePayload({ tradeIndex: effectiveTradeIndex, symbol, side, orderType, limit, amount, stopLoss, target, burnerAccountAddress }),
      leaderUsername: leader.username || null,
      leaderNullifier: leader.nullifierHash,
    };

    // 1. Fetch all active followers for this leader from MongoDB Follow collection
    const now = new Date();
    const activeFollows = await Follow.find({
      leaderId,
      status: 'active',
      expiresAt: { $gt: now },
    }).populate('followerId', 'username walletAddress nullifierHash');

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

      // Encrypt the trade signal using the follower's public key
      const encryptedTradeSignal = encryptTradeSignal(tradeData, follower.walletAddress);

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
        tradePayload: tradeData,
        arkivEntityKey: arkivResult.entityKey,
        arkivTxHash: arkivResult.txHash,
        ttlSeconds,
        expiresAt,
        status: 'ACTIVE',
      });

      // Decrypt trade data specifically for the follower UI
      const decryptedForFollower = {
        signalId,
        tradeIndex: effectiveTradeIndex,
        leaderPublicKey: leader.walletAddress,
        leaderUsername: leader.username || 'Verified Leader',
        symbol: tradeData.symbol,
        side: tradeData.side,
        orderType: tradeData.orderType,
        limit: tradeData.limit,
        amount: tradeData.amount,
        stopLoss: tradeData.stopLoss,
        target: tradeData.target,
        burnerAccountAddress: tradeData.burnerAccountAddress,
        arkivEntityKey: arkivResult.entityKey,
        ttlSeconds,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
      };

      // 3. Send over WebSocket directly to follower in real-time
      const sentCount = sendSignalToFollower(follower._id.toString(), decryptedForFollower);
      console.log(`[Trade Signal] Dispatched signal ${signalId} to follower ${follower.username || follower._id} (WebSockets active: ${sentCount})`);

      createdSignals.push({
        signalId,
        followerId: follower._id,
        arkivEntityKey: arkivResult.entityKey,
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
        limit: s.tradePayload?.limit,
        amount: s.tradePayload?.amount,
        stopLoss: s.tradePayload?.stopLoss,
        target: s.tradePayload?.target,
        burnerAccountAddress: s.tradePayload?.burnerAccountAddress,
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
    const trades = await Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      trades,
    });
  } catch (error) {
    console.error('[Trade History] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

export default router;

