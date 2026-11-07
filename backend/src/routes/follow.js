import express from 'express';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import SocialFollow from '../models/SocialFollow.js';
import { storeFollowerRelationshipInArkiv } from '../services/arkiv.js';
import { recalculateLeaderStats, getLeaderEquityCurve } from '../services/statsCalculator.js';

const router = express.Router();

// GET /api/explore - List users available with filters (riskLevel, tag, tradingStyle, sort, search)
router.get('/explore', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user?.userId;
    const { riskLevel, tag, tradingStyle, sort = 'followers', search } = req.query;

    const query = currentUserId ? { _id: { $ne: currentUserId } } : {};

    if (riskLevel && ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'DEGEN'].includes(riskLevel.toUpperCase())) {
      query.riskLevel = riskLevel.toUpperCase();
    }

    if (tradingStyle && ['SWING', 'DAY_TRADER', 'SCALPER', 'POSITION'].includes(tradingStyle.toUpperCase())) {
      query.tradingStyle = tradingStyle.toUpperCase();
    }

    if (tag && typeof tag === 'string') {
      query.tags = tag.toLowerCase().trim();
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { username: searchRegex },
        { bio: searchRegex },
        { tags: searchRegex },
        { walletAddress: searchRegex },
      ];
    }

    let sortOptions = { followersCount: -1, createdAt: -1 };
    if (sort === 'pnl') sortOptions = { 'stats.totalPnlUsdc': -1, followersCount: -1 };
    else if (sort === 'winRate') sortOptions = { 'stats.winRate': -1, 'stats.totalTrades': -1 };
    else if (sort === 'subscribers') sortOptions = { subscribersCount: -1, followersCount: -1 };
    else if (sort === 'trades') sortOptions = { 'stats.totalTrades': -1 };
    else if (sort === 'fee_asc') sortOptions = { subscriptionFee: 1 };
    else if (sort === 'fee_desc') sortOptions = { subscriptionFee: -1 };

    // Fetch matching users
    const users = await User.find(query)
      .select('nullifierHash username walletAddress bio subscriptionFee followersCount followingCount subscribersCount subscribedCount riskLevel tradingStyle tags stats createdAt')
      .sort(sortOptions)
      .lean();

    // Check paid subscriptions (30-day epoch on Base Sepolia / Arkiv)
    const activeSubscriptionMap = new Map();
    let socialFollowSet = new Set();
    if (currentUserId) {
      const [activeSubscriptions, socialFollows] = await Promise.all([
        Follow.find({
          followerId: currentUserId,
          status: 'active',
          expiresAt: { $gt: new Date() },
        })
          .select('leaderId expiresAt transactionId arkivEntityKey')
          .lean(),
        SocialFollow.find({
          followerId: currentUserId,
        })
          .select('leaderId')
          .lean(),
      ]);

      activeSubscriptions.forEach((f) => {
        activeSubscriptionMap.set(f.leaderId.toString(), f);
      });
      socialFollowSet = new Set(socialFollows.map((sf) => sf.leaderId.toString()));
    }

    const exploreUsers = users.map((u) => {
      const subInfo = activeSubscriptionMap.get(u._id.toString());
      const isFollowing = socialFollowSet.has(u._id.toString());
      return {
        id: u._id,
        nullifierHash: u.nullifierHash,
        username: u.username || null,
        walletAddress: u.walletAddress || null,
        bio: u.bio || null,
        subscriptionFee: u.subscriptionFee ?? 0.001,
        followersCount: u.followersCount ?? 0,
        followingCount: u.followingCount ?? 0,
        subscribersCount: u.subscribersCount ?? 0,
        subscribedCount: u.subscribedCount ?? 0,
        riskLevel: u.riskLevel || 'MODERATE',
        tradingStyle: u.tradingStyle || 'SWING',
        tags: u.tags || [],
        stats: u.stats || {
          totalPnlUsdc: 0,
          winRate: 0,
          totalTrades: 0,
          winningTrades: 0,
          profitFactor: 0,
          avgHoldMinutes: 0,
        },
        createdAt: u.createdAt,
        isSubscribed: !!subInfo,
        isFollowing,
        activeUntil: subInfo ? subInfo.expiresAt : null,
        arkivEntityKey: subInfo ? subInfo.arkivEntityKey : null,
      };
    });

    return res.json({
      success: true,
      users: exploreUsers,
      total: exploreUsers.length,
    });
  } catch (error) {
    console.error('Explore users error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch explore users' });
  }
});

// GET /api/leaderboard - Ranked list of top traders with verification evidence
router.get('/leaderboard', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sort = 'pnl', limit = 50, riskLevel } = req.query;
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const query = {};
    if (riskLevel && ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'DEGEN'].includes(riskLevel.toUpperCase())) {
      query.riskLevel = riskLevel.toUpperCase();
    }

    let sortOptions = { 'stats.totalPnlUsdc': -1, 'stats.winRate': -1 };
    if (sort === 'winRate') sortOptions = { 'stats.winRate': -1, 'stats.totalTrades': -1 };
    else if (sort === 'subscribers') sortOptions = { subscribersCount: -1, 'stats.totalPnlUsdc': -1 };
    else if (sort === 'trades') sortOptions = { 'stats.totalTrades': -1, 'stats.totalPnlUsdc': -1 };
    else if (sort === 'claims') sortOptions = { 'stats.verifiedClaimsCount': -1, 'stats.totalPnlUsdc': -1 };

    const leaders = await User.find(query)
      .select('nullifierHash username walletAddress bio subscriptionFee followersCount subscribersCount riskLevel tradingStyle tags stats createdAt')
      .sort(sortOptions)
      .limit(maxLimit)
      .lean();

    const currentUserId = req.user?.userId;

    // Check current user's relationships if authenticated
    let subSet = new Set();
    let socialSet = new Set();
    if (currentUserId) {
      const [mySubs, mySocials] = await Promise.all([
        Follow.find({ followerId: currentUserId, status: 'active', expiresAt: { $gt: new Date() } }).select('leaderId').lean(),
        SocialFollow.find({ followerId: currentUserId }).select('leaderId').lean(),
      ]);
      subSet = new Set(mySubs.map((s) => s.leaderId.toString()));
      socialSet = new Set(mySocials.map((s) => s.leaderId.toString()));
    }

    const ranked = leaders.map((leader, index) => {
      // Tier calculation based on rank & PnL
      let tier = 'BRONZE';
      if (index === 0 || (leader.stats?.totalPnlUsdc > 50 && leader.stats?.winRate >= 70)) tier = 'DIAMOND';
      else if (index < 3 || (leader.stats?.totalPnlUsdc > 20 && leader.stats?.winRate >= 60)) tier = 'GOLD';
      else if (index < 10 || leader.stats?.totalPnlUsdc > 0) tier = 'SILVER';

      return {
        rank: index + 1,
        tier,
        id: leader._id,
        nullifierHash: leader.nullifierHash,
        username: leader.username || `Leader ${leader.nullifierHash.slice(0, 8)}`,
        walletAddress: leader.walletAddress,
        bio: leader.bio,
        subscriptionFee: leader.subscriptionFee ?? 0.001,
        riskLevel: leader.riskLevel || 'MODERATE',
        tradingStyle: leader.tradingStyle || 'SWING',
        tags: leader.tags || [],
        subscribersCount: leader.subscribersCount ?? 0,
        followersCount: leader.followersCount ?? 0,
        stats: leader.stats || {
          totalPnlUsdc: 0,
          winRate: 0,
          totalTrades: 0,
          winningTrades: 0,
          profitFactor: 0,
          verifiedClaimsCount: 0,
        },
        isSubscribed: subSet.has(leader._id.toString()),
        isFollowing: socialSet.has(leader._id.toString()),
        isSelf: currentUserId ? leader._id.toString() === currentUserId.toString() : false,
      };
    });

    return res.json({
      success: true,
      leaderboard: ranked,
      total: ranked.length,
    });
  } catch (error) {
    console.error('Leaderboard error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboard/:leaderId/chart - Returns historical equity curve snapshots
router.get('/leaderboard/:leaderId/chart', optionalAuthMiddleware, async (req, res) => {
  try {
    const curve = await getLeaderEquityCurve(req.params.leaderId, 30);
    return res.json({ success: true, data: curve });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// POST /api/social/follow/:leaderId - 1-Click Free Social Follow
router.post('/social/follow/:leaderId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const { leaderId } = req.params;

    if (followerId.toString() === leaderId.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const leader = await User.findById(leaderId);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const existing = await SocialFollow.findOne({ leaderId, followerId });
    if (existing) {
      return res.json({ success: true, message: 'Already following', isFollowing: true });
    }

    await SocialFollow.create({ leaderId, followerId });

    // Atomically increment social follower and following counts
    await User.findByIdAndUpdate(leaderId, { $inc: { followersCount: 1 } });
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });

    const updatedLeader = await User.findById(leaderId).select('followersCount');

    return res.json({
      success: true,
      message: `Now following ${leader.username || 'leader'}`,
      isFollowing: true,
      followersCount: updatedLeader.followersCount,
    });
  } catch (err) {
    console.error('Social follow error:', err.message);
    return res.status(500).json({ error: 'Failed to follow user' });
  }
});

// DELETE /api/social/unfollow/:leaderId - 1-Click Free Social Unfollow
router.delete('/social/unfollow/:leaderId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const { leaderId } = req.params;

    const removed = await SocialFollow.findOneAndDelete({ leaderId, followerId });
    if (removed) {
      await User.findByIdAndUpdate(leaderId, { $inc: { followersCount: -1 } });
      await User.updateOne({ _id: leaderId, followersCount: { $lt: 0 } }, { $set: { followersCount: 0 } });

      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      await User.updateOne({ _id: followerId, followingCount: { $lt: 0 } }, { $set: { followingCount: 0 } });
    }

    const updatedLeader = await User.findById(leaderId).select('followersCount');

    return res.json({
      success: true,
      message: 'Unfollowed successfully',
      isFollowing: false,
      followersCount: updatedLeader ? updatedLeader.followersCount : 0,
    });
  } catch (err) {
    console.error('Social unfollow error:', err.message);
    return res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// POST /api/follow - Follow a leader, store in Arkiv with 30-day TTL, update MongoDB counts
router.post('/follow', authMiddleware, async (req, res) => {
  const { leaderId, transactionId } = req.body;
  const followerId = req.user.userId;

  if (!leaderId) {
    return res.status(400).json({ error: 'leaderId is required' });
  }

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({ error: 'transactionId (payment hash) is required' });
  }

  if (leaderId.toString() === followerId.toString()) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  try {
    // 1. Fetch Follower and Leader from MongoDB
    const follower = await User.findById(followerId);
    const leader = await User.findById(leaderId);

    if (!follower) {
      return res.status(404).json({ error: 'Follower user not found' });
    }

    if (!leader) {
      return res.status(404).json({ error: 'Leader user not found' });
    }

    // Follower must have connected wallet
    if (!follower.walletAddress) {
      return res.status(400).json({
        error: 'Please connect your MetaMask wallet before following a leader',
      });
    }

    // Leader must have connected wallet to receive fees
    if (!leader.walletAddress) {
      return res.status(400).json({
        error: 'Leader has not linked a wallet address to receive subscription fees',
      });
    }

    const feeAmount = leader.subscriptionFee ?? 0.001;
    const transactionDate = new Date();
    // 30 days expiration
    const expiresAt = new Date(transactionDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 2. Store Follower Relationship in Arkiv
    const arkivResult = await storeFollowerRelationshipInArkiv({
      leaderNullifier: leader.nullifierHash,
      leaderPublicKey: leader.walletAddress,
      followerNullifier: follower.nullifierHash,
      followerPublicKey: follower.walletAddress,
      transactionId: transactionId.trim(),
      transactionDate: transactionDate.toISOString(),
    });

    // 3. Upsert Follow relationship in MongoDB
    const followRecord = await Follow.findOneAndUpdate(
      { leaderId: leader._id, followerId: follower._id },
      {
        $set: {
          leaderNullifier: leader.nullifierHash,
          leaderPublicKey: leader.walletAddress,
          followerNullifier: follower.nullifierHash,
          followerPublicKey: follower.walletAddress,
          transactionId: transactionId.trim(),
          transactionDate,
          feeAmount,
          arkivEntityKey: arkivResult.entityKey,
          arkivTxHash: arkivResult.txHash,
          status: 'active',
          expiresAt,
        },
        $setOnInsert: {
          createdAt: transactionDate,
        },
      },
      { upsert: true, new: true }
    );

    // 4. Update counts in MongoDB (leader's subscribersCount + 1, follower's subscribedCount + 1)
    await User.findByIdAndUpdate(leader._id, { $inc: { subscribersCount: 1, followersCount: 1 } });
    await User.findByIdAndUpdate(follower._id, { $inc: { subscribedCount: 1, followingCount: 1 } });

    // Recalculate stats for leader to update subscriber count
    recalculateLeaderStats(leader._id).catch(() => {});

    // Fetch updated follower document to return fresh counts
    const updatedFollower = await User.findById(followerId);

    console.log(`[Subscription] User ${follower.username || follower._id} subscribed to Leader ${leader.username || leader._id}`);
    console.log(`[Subscription] Arkiv Entity Key: ${arkivResult.entityKey}`);

    return res.json({
      success: true,
      message: 'Successfully subscribed and stored in Arkiv with 30-day TTL',
      subscription: followRecord,
      follow: followRecord,
      arkiv: arkivResult,
      subscribersCount: (leader.subscribersCount || 0) + 1,
      followersCount: (leader.followersCount || 0) + 1,
      subscribedCount: (updatedFollower.subscribedCount || 0),
      followingCount: updatedFollower.followingCount,
    });
  } catch (error) {
    console.error('Follow error:', error.message);
    return res.status(500).json({ error: 'Failed to process follow relationship: ' + error.message });
  }
});

// POST /api/unfollow - Unfollow a leader and decrement MongoDB counts
router.post('/unfollow', authMiddleware, async (req, res) => {
  const { leaderId } = req.body;
  const followerId = req.user.userId;

  if (!leaderId) {
    return res.status(400).json({ error: 'leaderId is required' });
  }

  try {
    const existingFollow = await Follow.findOne({
      leaderId,
      followerId,
      status: 'active',
    });

    if (!existingFollow) {
      return res.status(400).json({ error: 'Not currently following this user' });
    }

    // Update status to unfollowed
    existingFollow.status = 'unfollowed';
    await existingFollow.save();

    // Decrement counts in MongoDB (minimum 0)
    await User.findByIdAndUpdate(leaderId, {
      $inc: { followersCount: -1 },
    });
    // Ensure not negative
    await User.updateOne({ _id: leaderId, followersCount: { $lt: 0 } }, { $set: { followersCount: 0 } });

    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 },
    });
    await User.updateOne({ _id: followerId, followingCount: { $lt: 0 } }, { $set: { followingCount: 0 } });

    const updatedFollower = await User.findById(followerId);

    console.log(`[Unfollow] User ${followerId} unfollowed ${leaderId}`);

    return res.json({
      success: true,
      message: 'Successfully unfollowed',
      followingCount: updatedFollower.followingCount,
    });
  } catch (error) {
    console.error('Unfollow error:', error.message);
    return res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// GET /api/following - Get leaders currently followed by authenticated user
router.get('/following', authMiddleware, async (req, res) => {
  try {
    const follows = await Follow.find({
      followerId: req.user.userId,
      status: 'active',
    })
      .populate('leaderId', 'username nullifierHash walletAddress subscriptionFee followersCount bio')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      following: follows,
    });
  } catch (error) {
    console.error('Get following error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// GET /api/followers - Get followers currently following authenticated user (leader)
router.get('/followers', authMiddleware, async (req, res) => {
  try {
    const followers = await Follow.find({
      leaderId: req.user.userId,
      status: 'active',
    })
      .populate('followerId', 'username nullifierHash walletAddress subscriptionFee followersCount followingCount bio')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      followers,
    });
  } catch (error) {
    console.error('Get followers error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

export default router;

