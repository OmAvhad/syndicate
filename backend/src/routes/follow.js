import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import { storeFollowerRelationshipInArkiv } from '../services/arkiv.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/explore - List users available to follow
router.get('/explore', async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    // Fetch all users except the currently logged-in user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('nullifierHash username walletAddress bio subscriptionFee followersCount followingCount createdAt')
      .sort({ followersCount: -1, createdAt: -1 })
      .lean();

    // Check which users the current user is currently actively following
    const activeFollows = await Follow.find({
      followerId: currentUserId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    })
      .select('leaderId expiresAt transactionId arkivEntityKey')
      .lean();

    const activeFollowMap = new Map();
    activeFollows.forEach((f) => {
      activeFollowMap.set(f.leaderId.toString(), f);
    });

    const exploreUsers = users.map((u) => {
      const followInfo = activeFollowMap.get(u._id.toString());
      return {
        id: u._id,
        nullifierHash: u.nullifierHash,
        username: u.username || null,
        walletAddress: u.walletAddress || null,
        bio: u.bio || null,
        subscriptionFee: u.subscriptionFee ?? 0.001,
        followersCount: u.followersCount ?? 0,
        followingCount: u.followingCount ?? 0,
        createdAt: u.createdAt,
        isFollowing: !!followInfo,
        activeUntil: followInfo ? followInfo.expiresAt : null,
        arkivEntityKey: followInfo ? followInfo.arkivEntityKey : null,
      };
    });

    return res.json({
      success: true,
      users: exploreUsers,
    });
  } catch (error) {
    console.error('Explore users error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch explore users' });
  }
});

// POST /api/follow - Follow a leader, store in Arkiv with 30-day TTL, update MongoDB counts
router.post('/follow', async (req, res) => {
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

    // 4. Update counts in MongoDB (leader's followersCount + 1, follower's followingCount + 1)
    await User.findByIdAndUpdate(leader._id, { $inc: { followersCount: 1 } });
    await User.findByIdAndUpdate(follower._id, { $inc: { followingCount: 1 } });

    // Fetch updated follower document to return fresh counts
    const updatedFollower = await User.findById(followerId);

    console.log(`[Follow] User ${follower.username || follower._id} followed Leader ${leader.username || leader._id}`);
    console.log(`[Follow] Arkiv Entity Key: ${arkivResult.entityKey}`);

    return res.json({
      success: true,
      message: 'Successfully subscribed and stored in Arkiv with 30-day TTL',
      follow: followRecord,
      arkiv: arkivResult,
      followersCount: leader.followersCount + 1,
      followingCount: updatedFollower.followingCount,
    });
  } catch (error) {
    console.error('Follow error:', error.message);
    return res.status(500).json({ error: 'Failed to process follow relationship: ' + error.message });
  }
});

// POST /api/unfollow - Unfollow a leader and decrement MongoDB counts
router.post('/unfollow', async (req, res) => {
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
router.get('/following', async (req, res) => {
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
router.get('/followers', async (req, res) => {
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

