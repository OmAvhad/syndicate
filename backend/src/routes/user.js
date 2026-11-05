import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user._id,
      nullifierHash: user.nullifierHash,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      verificationLevel: user.verificationLevel,
      loginCount: user.loginCount,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/user/profile
router.put('/profile', async (req, res) => {
  const { username, displayName, bio, avatarUrl } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          ...(username !== undefined && { username }),
          ...(displayName !== undefined && { displayName }),
          ...(bio !== undefined && { bio }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user._id,
      nullifierHash: user.nullifierHash,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      verificationLevel: user.verificationLevel,
      loginCount: user.loginCount,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    return res.status(500).json({ error: 'Failed to update profile' });
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
