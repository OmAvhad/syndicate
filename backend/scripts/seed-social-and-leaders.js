import '../src/env.js';
import mongoose from 'mongoose';
import connectDB from '../src/db.js';
import User from '../src/models/User.js';
import TradePost from '../src/models/TradePost.js';
import SocialFollow from '../src/models/SocialFollow.js';
import LeaderStatsSnapshot from '../src/models/LeaderStatsSnapshot.js';

async function seed() {
  await connectDB();
  console.log('🌱 Seeding leaders, social profiles, and trade feed...');

  // 1. Update alpha_leader if exists
  const alphaLeader = await User.findOne({ username: 'alpha_leader' });
  if (alphaLeader) {
    alphaLeader.bio = 'Institutional swing trader specializing in ETH/USDC bracket setups and DeFi liquidity breakouts.';
    alphaLeader.riskLevel = 'MODERATE';
    alphaLeader.tradingStyle = 'SWING';
    alphaLeader.tags = ['defi', 'swing', 'eth', 'bracket'];
    alphaLeader.subscribersCount = Math.max(alphaLeader.subscribersCount || 0, 5);
    alphaLeader.followersCount = Math.max(alphaLeader.followersCount || 0, 24);
    alphaLeader.stats = {
      totalPnlUsdc: 18.42,
      totalRoiPercent: 12.3,
      winRate: 75.0,
      totalTrades: 8,
      winningTrades: 6,
      losingTrades: 2,
      profitFactor: 3.1,
      avgHoldMinutes: 120,
      totalVolumeUsdc: 150.0,
      verifiedClaimsCount: 4,
      lastTradeAt: new Date(),
    };
    await alphaLeader.save();
    console.log('✅ Updated alpha_leader profile & stats');
  }

  // 2. Upsert Priya ETH Swings (from syndicate-design.html)
  const priya = await User.findOneAndUpdate(
    { nullifierHash: '0x1f3c77ab99214e6628ef1c0a9b345719a82cd4b9e1740285a73ef890a5e783b2' },
    {
      $set: {
        username: 'Priya_ETH_Swings',
        walletAddress: '0x9c14b0ffe97c3074c71314d3a330b5f847bf2294',
        bio: 'Verified Human trader. Multi-day bracket swing trader focusing on ETH/BTC macro rotations. Low drawdown, strict risk management.',
        subscriptionFee: 0.001,
        riskLevel: 'CONSERVATIVE',
        tradingStyle: 'SWING',
        tags: ['eth', 'swing', 'macro', 'low-risk'],
        subscribersCount: 14,
        followersCount: 89,
        stats: {
          totalPnlUsdc: 142.50,
          totalRoiPercent: 18.6,
          winRate: 83.3,
          totalTrades: 18,
          winningTrades: 15,
          losingTrades: 3,
          profitFactor: 4.8,
          avgHoldMinutes: 360,
          totalVolumeUsdc: 760.0,
          verifiedClaimsCount: 12,
          lastTradeAt: new Date(Date.now() - 3600000 * 4),
        },
      },
    },
    { upsert: true, new: true }
  );
  console.log('✅ Upserted Priya_ETH_Swings');

  // 3. Upsert DegenApex (high-risk high-return scalper)
  const degenApex = await User.findOneAndUpdate(
    { nullifierHash: '0x09bc8831f2479e00192a54b39c017d88e401fa9b26584e01923abef045a1c099' },
    {
      $set: {
        username: 'DegenApex',
        walletAddress: '0x88b5ae7e766afb0c8acaf43b2a973083ab128e59',
        bio: 'Aggressive momentum breakout scalper. High volume, tight stops, volatility hunter.',
        subscriptionFee: 0.002,
        riskLevel: 'DEGEN',
        tradingStyle: 'SCALPER',
        tags: ['scalp', 'breakout', 'volatility', 'high-beta'],
        subscribersCount: 22,
        followersCount: 143,
        stats: {
          totalPnlUsdc: 384.20,
          totalRoiPercent: 34.2,
          winRate: 64.7,
          totalTrades: 34,
          winningTrades: 22,
          losingTrades: 12,
          profitFactor: 2.4,
          avgHoldMinutes: 25,
          totalVolumeUsdc: 1120.0,
          verifiedClaimsCount: 18,
          lastTradeAt: new Date(Date.now() - 3600000 * 2),
        },
      },
    },
    { upsert: true, new: true }
  );
  console.log('✅ Upserted DegenApex');

  // 4. Upsert MacroVault (conservative position trader)
  const macroVault = await User.findOneAndUpdate(
    { nullifierHash: '0x44fa78c2e1189ac0018b3294c771da4091fe8c1a92e4028f83726ab591c0e3a1' },
    {
      $set: {
        username: 'MacroVault',
        walletAddress: '0x12c49b0ffae89cc4990de50d4df9ab442f076cf0',
        bio: 'Long-term thesis positioning across Ethereum ecosystem and L2 infrastructure. Zero leverage.',
        subscriptionFee: 0.0015,
        riskLevel: 'CONSERVATIVE',
        tradingStyle: 'POSITION',
        tags: ['macro', 'l2s', 'defi', 'position'],
        subscribersCount: 31,
        followersCount: 210,
        stats: {
          totalPnlUsdc: 95.80,
          totalRoiPercent: 14.1,
          winRate: 88.9,
          totalTrades: 9,
          winningTrades: 8,
          losingTrades: 1,
          profitFactor: 5.2,
          avgHoldMinutes: 1440,
          totalVolumeUsdc: 680.0,
          verifiedClaimsCount: 7,
          lastTradeAt: new Date(Date.now() - 3600000 * 12),
        },
      },
    },
    { upsert: true, new: true }
  );
  console.log('✅ Upserted MacroVault');

  // 5. Seed historical snapshots for Priya for equity curve chart
  const dates = [6, 5, 4, 3, 2, 1, 0];
  const pnlSteps = [20.0, 45.0, 72.5, 68.0, 95.0, 118.0, 142.50];
  for (let i = 0; i < dates.length; i++) {
    const d = new Date();
    d.setDate(d.getDate() - dates[i]);
    d.setHours(0, 0, 0, 0);

    await LeaderStatsSnapshot.findOneAndUpdate(
      { leaderId: priya._id, date: d },
      {
        $set: {
          cumulativePnlUsdc: pnlSteps[i],
          cumulativeTrades: 3 + i * 2,
          winRate: 83.3,
          activeSubscribers: 14,
        },
      },
      { upsert: true }
    );
  }
  console.log('✅ Seeded equity curve snapshots for Priya');

  // 6. Seed Social Trade Posts
  const postCount = await TradePost.countDocuments();
  if (postCount < 3) {
    await TradePost.create([
      {
        authorId: priya._id,
        content: 'ETH looking exceptionally strong reclaiming the $3,000 level. Setting our bracket order TP at $3,350 (+11.3%) with a defensive stop at $2,800. Remember to keep copy size proportional to your shielded pool balance! 🚀',
        sentiment: 'BULLISH',
        tags: ['eth', 'swing', 'bracket'],
        tradeSnapshot: {
          symbol: 'ETH/USDC',
          side: 'BUY',
          entryPrice: 3000,
          exitPrice: 3350,
          realizedPnl: 0.34,
          isClosed: true,
          status: 'CLOSED',
        },
        likesCount: 18,
        createdAt: new Date(Date.now() - 3600000 * 3),
      },
      {
        authorId: degenApex._id,
        content: 'Quick scalp alert: breakout volume detected on L2 tokens. Volatility index spiking. If you are copying my feed, keep slippage tolerance at 0.5% and stay nimble.',
        sentiment: 'BULLISH',
        tags: ['scalp', 'breakout', 'volatility'],
        likesCount: 12,
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
      {
        authorId: macroVault._id,
        content: 'Macro thesis review: Gas fees on Ethereum Sepolia and Base remain ultra-low. Privacy pools like Kohaku continue seeing sustained deposit growth. Our 30-day epoch positions remain fully open and protected.',
        sentiment: 'NEUTRAL',
        tags: ['macro', 'privacy', 'defi'],
        likesCount: 9,
        createdAt: new Date(Date.now() - 3600000 * 15),
      },
    ]);
    console.log('✅ Seeded initial social trade posts');
  }

  console.log('🎉 Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
