import express from 'express';
import crypto from 'crypto';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Trade from '../models/Trade.js';
import TradeSignal from '../models/TradeSignal.js';
import { hashTradePayload, encryptTradeSignal, decryptTradeSignal, encryptForMetaMask } from '../services/tradeCrypto.js';
import { storeTradeSignalInArkiv } from '../services/arkiv.js';
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

    const tradeData = {
      symbol,
      side,
      orderType,
      limit: Number(limit),
      amount: Number(amount),
      stopLoss: Number(stopLoss),
      target: Number(target),
      burnerAccountAddress,
    };

    // Calculate/verify server-side HMAC hash using secret stored in .env
    const calculatedHash = hashTradePayload(tradeData);

    const promiseId = `prm_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    console.log(`[Trade Promise] Leader ${req.user.userId} committed trade promise ${promiseId} for ${symbol} ${side}`);
    console.log(`[Trade Promise] Hash: ${calculatedHash}`);

    // Return mocked successful commitment response
    return res.json({
      success: true,
      promiseId,
      status: 'COMMITTED',
      symbol: tradeData.symbol,
      side: tradeData.side,
      limit: tradeData.limit,
      amount: tradeData.amount,
      payloadHash: calculatedHash,
      timestamp: new Date().toISOString(),
      message: 'Trade promise cryptographically sealed and committed',
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
      isCopyTrade = false,
      originalSignalId = null,
    } = req.body;

    const currentUserId = req.user.userId;

    if (!symbol || !side || limit === undefined || amount === undefined) {
      return res.status(400).json({ error: 'Missing required execution parameters' });
    }

    const tradeData = {
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
    } = req.body;

    const leader = await User.findById(leaderId);
    if (!leader || !leader.walletAddress) {
      return res.status(400).json({ error: 'Leader must have a connected wallet address to broadcast signals' });
    }

    const tradeData = {
      symbol,
      side,
      orderType,
      limit: Number(limit),
      amount: Number(amount),
      stopLoss: Number(stopLoss),
      target: Number(target),
      burnerAccountAddress,
      payloadHash: payloadHash || hashTradePayload({ symbol, side, orderType, limit, amount, stopLoss, target, burnerAccountAddress }),
      leaderUsername: leader.username || null,
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
        leaderPublicKey: s.leaderPublicKey,
        leaderUsername: s.leaderId?.username || 'Verified Leader',
        symbol: s.tradePayload?.symbol,
        side: s.tradePayload?.side,
        orderType: s.tradePayload?.orderType,
        requiresMetaMaskDecrypt: Boolean(s.requiresMetaMaskDecrypt),
        encryptedPayloadHex: s.encryptedPayloadHex || null,
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

