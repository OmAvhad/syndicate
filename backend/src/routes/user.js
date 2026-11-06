import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Helper to format user response consistently without displayName
const formatUserResponse = (user) => ({
  id: user._id,
  nullifierHash: user.nullifierHash,
  username: user.username || null,
  walletAddress: user.walletAddress || null,
  walletConnectedAt: user.walletConnectedAt || null,
  subscriptionFee: user.subscriptionFee ?? 0.001,
  followersCount: user.followersCount ?? 0,
  followingCount: user.followingCount ?? 0,
  bio: user.bio || null,
  avatarUrl: user.avatarUrl || null,
  verificationLevel: user.verificationLevel,
  loginCount: user.loginCount,
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
});

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(formatUserResponse(user));
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/user/profile
router.put('/profile', async (req, res) => {
  const { username, bio, avatarUrl, subscriptionFee } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          ...(username !== undefined && { username: username.trim() }),
          ...(bio !== undefined && { bio: bio.trim() }),
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(subscriptionFee !== undefined && !isNaN(Number(subscriptionFee)) && {
            subscriptionFee: Math.max(0, Number(subscriptionFee)),
          }),
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(formatUserResponse(user));
  } catch (error) {
    console.error('Update profile error:', error.message);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/user/subscription-fee - Update leader subscription fee
router.put('/subscription-fee', async (req, res) => {
  const { fee } = req.body;
  const numFee = Number(fee);

  if (isNaN(numFee) || numFee < 0) {
    return res.status(400).json({ error: 'Valid subscription fee in ETH is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { subscriptionFee: numFee } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      message: 'Subscription fee updated',
      subscriptionFee: user.subscriptionFee,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Update subscription fee error:', error.message);
    return res.status(500).json({ error: 'Failed to update subscription fee' });
  }
});

// POST /api/user/wallet - Connect and store MetaMask wallet address (public key)
router.post('/wallet', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  const trimmed = walletAddress.trim().toLowerCase();
  const ethAddressRegex = /^0x[a-f0-9]{40}$/;

  if (!ethAddressRegex.test(trimmed)) {
    return res.status(400).json({ error: 'Invalid Ethereum public address format' });
  }

  try {
    const now = new Date();
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          walletAddress: trimmed,
          walletConnectedAt: now,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Wallet] Stored public key ${trimmed} for user ${user._id}`);
    return res.json({
      success: true,
      message: 'Wallet address successfully linked',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Store wallet error:', error.message);
    return res.status(500).json({ error: 'Failed to store wallet address' });
  }
});

// DELETE /api/user/wallet - Disconnect / unlink wallet
router.delete('/wallet', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          walletAddress: null,
          walletConnectedAt: null,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Wallet] Disconnected wallet for user ${user._id}`);
    return res.json({
      success: true,
      message: 'Wallet address disconnected',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Disconnect wallet error:', error.message);
    return res.status(500).json({ error: 'Failed to disconnect wallet' });
  }
});

// GET /api/user/stats
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      loginCount: user.loginCount,
      followersCount: user.followersCount ?? 0,
      followingCount: user.followingCount ?? 0,
      subscriptionFee: user.subscriptionFee ?? 0.001,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      verificationLevel: user.verificationLevel,
    });
  } catch (error) {
    console.error('Get stats error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
