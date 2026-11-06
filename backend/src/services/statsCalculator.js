import mongoose from 'mongoose';
import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import LeaderStatsSnapshot from '../models/LeaderStatsSnapshot.js';

/**
 * Recalculates and caches a leader's cumulative performance metrics.
 * Runs on trade exit settlement, promise claiming, and subscription updates.
 */
export async function recalculateLeaderStats(leaderId) {
  if (!leaderId || !mongoose.Types.ObjectId.isValid(leaderId)) return null;

  try {
    // 1. Fetch closed, receipt-verified trades for this leader
    const trades = await Trade.find({
      userId: leaderId,
      status: 'CLOSED',
      receiptsVerified: true,
    })
      .sort({ closedAt: 1 })
      .lean();

    // 2. Fetch active paid subscribers (30-day epoch on Base Sepolia / Arkiv)
    const activeSubscribersCount = await Follow.countDocuments({
      leaderId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    if (trades.length === 0) {
      // If no closed trades, just update subscribers count and reset stats
      await User.findByIdAndUpdate(leaderId, {
        $set: {
          subscribersCount: activeSubscribersCount,
          'stats.totalTrades': 0,
          'stats.winRate': 0,
          'stats.totalPnlUsdc': 0,
          'stats.totalVolumeUsdc': 0,
        },
      });
      return null;
    }

    let totalPnlUnits = 0n;
    let totalEntryUnits = 0n;
    let grossGainsUnits = 0n;
    let grossLossesUnits = 0n;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalHoldSeconds = 0;
    let verifiedClaimsCount = 0;

    for (const trade of trades) {
      const pnl = BigInt(trade.realizedPnlUnits || '0');
      const entry = BigInt(trade.entryUsdcUnits || '0');
      totalPnlUnits += pnl;
      totalEntryUnits += entry;

      if (pnl > 0n) {
        winningTrades++;
        grossGainsUnits += pnl;
      } else if (pnl < 0n) {
        losingTrades++;
        grossLossesUnits += -pnl;
      }

      if (trade.claimEntityKey) {
        verifiedClaimsCount++;
      }

      const start = trade.entryBlockTimestamp ? new Date(trade.entryBlockTimestamp) : (trade.createdAt ? new Date(trade.createdAt) : null);
      const end = trade.closedAt ? new Date(trade.closedAt) : null;
      if (start && end) {
        const duration = (end.getTime() - start.getTime()) / 1000;
        if (duration > 0) totalHoldSeconds += duration;
      }
    }

    // Convert atomic 6-decimal units to float numbers
    const totalTrades = trades.length;
    const winRate = Number(((winningTrades / totalTrades) * 100).toFixed(1));
    const totalPnlUsdc = Number((Number(totalPnlUnits) / 1e6).toFixed(2));
    const totalVolumeUsdc = Number((Number(totalEntryUnits) / 1e6).toFixed(2));
    const profitFactor = grossLossesUnits > 0n
      ? Number((Number(grossGainsUnits) / Number(grossLossesUnits)).toFixed(2))
      : (grossGainsUnits > 0n ? 99.9 : 1.0);
    const avgHoldMinutes = Math.round(totalHoldSeconds / (totalTrades * 60));
    const totalRoiPercent = totalVolumeUsdc > 0
      ? Number(((totalPnlUsdc / totalVolumeUsdc) * 100).toFixed(1))
      : 0;

    const statsPayload = {
      totalPnlUsdc,
      totalRoiPercent,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      profitFactor,
      avgHoldMinutes,
      totalVolumeUsdc,
      verifiedClaimsCount,
      lastTradeAt: trades[trades.length - 1].closedAt || new Date(),
    };

    // 3. Atomically update the User document
    const updatedUser = await User.findByIdAndUpdate(
      leaderId,
      {
        $set: {
          subscribersCount: activeSubscribersCount,
          stats: statsPayload,
        },
      },
      { new: true }
    );

    // 4. Record daily snapshot for historical equity curves
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await LeaderStatsSnapshot.findOneAndUpdate(
      { leaderId, date: today },
      {
        $set: {
          cumulativePnlUsdc: totalPnlUsdc,
          cumulativeTrades: totalTrades,
          winRate,
          activeSubscribers: activeSubscribersCount,
        },
      },
      { upsert: true, new: true }
    );

    return statsPayload;
  } catch (error) {
    console.error(`[Stats Calculator] Error updating stats for leader ${leaderId}:`, error.message);
    return null;
  }
}

/**
 * Returns historical equity curve data points for charting.
 */
export async function getLeaderEquityCurve(leaderId, limit = 30) {
  try {
    return await LeaderStatsSnapshot.find({ leaderId })
      .sort({ date: 1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error(`[Stats Calculator] Error fetching equity curve for leader ${leaderId}:`, err.message);
    return [];
  }
}
