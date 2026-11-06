import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Trade from '../models/Trade.js';
import TradePost from '../models/TradePost.js';
import SocialFollow from '../models/SocialFollow.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/posts
 * Fetch the social trade posts feed.
 * filter: 'following' (posts from followed leaders) or 'global' (all posts)
 */
router.get('/', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { filter = 'global', tag, limit = 30, page = 0 } = req.query;
    const maxLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 30));
    const skip = Math.max(0, parseInt(page, 10) || 0) * maxLimit;

    const query = {};

    if (filter === 'following') {
      const myFollows = await SocialFollow.find({ followerId: currentUserId }).select('leaderId').lean();
      const leaderIds = myFollows.map((f) => f.leaderId);
      leaderIds.push(currentUserId); // Include own posts
      query.authorId = { $in: leaderIds };
    }

    if (tag && typeof tag === 'string') {
      query.tags = tag.toLowerCase().trim();
    }

    const posts = await TradePost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(maxLimit)
      .populate('authorId', 'username nullifierHash walletAddress riskLevel tradingStyle tags stats subscribersCount')
      .populate('tradeId', 'symbol side limit amount executionPrice status exitPrice realizedPnlUnits claimEntityKey')
      .lean();

    const formatted = posts.map((post) => {
      const isLiked = post.likes ? post.likes.some((id) => id.toString() === currentUserId.toString()) : false;
      return {
        id: post._id,
        content: post.content,
        tags: post.tags || [],
        sentiment: post.sentiment || 'NEUTRAL',
        promiseId: post.promiseId || null,
        tradeSnapshot: post.tradeSnapshot || null,
        trade: post.tradeId || null,
        likesCount: post.likesCount || 0,
        isLiked,
        createdAt: post.createdAt,
        author: post.authorId ? {
          id: post.authorId._id,
          username: post.authorId.username || `Leader ${post.authorId.nullifierHash?.slice(0, 8)}`,
          nullifierHash: post.authorId.nullifierHash,
          walletAddress: post.authorId.walletAddress,
          riskLevel: post.authorId.riskLevel || 'MODERATE',
          tradingStyle: post.authorId.tradingStyle || 'SWING',
          tags: post.authorId.tags || [],
          subscribersCount: post.authorId.subscribersCount || 0,
          stats: post.authorId.stats || {},
        } : null,
      };
    });

    return res.json({
      success: true,
      posts: formatted,
      total: formatted.length,
      page: parseInt(page, 10) || 0,
    });
  } catch (error) {
    console.error('Fetch posts error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch social posts feed' });
  }
});

/**
 * POST /api/posts
 * Publish a new social trade post (commentary, market insight, or trade link)
 */
router.post('/', async (req, res) => {
  try {
    const authorId = req.user.userId;
    const { content, tags = [], sentiment = 'NEUTRAL', tradeId, promiseId } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    if (content.length > 1200) {
      return res.status(400).json({ error: 'Post content exceeds 1,200 characters limit' });
    }

    let tradeSnapshot = null;

    // If attaching an existing trade
    if (tradeId) {
      const trade = await Trade.findOne({ _id: tradeId, userId: authorId }).lean();
      if (trade) {
        const pnl = trade.realizedPnlUnits ? Number(BigInt(trade.realizedPnlUnits)) / 1e6 : null;
        tradeSnapshot = {
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.limit || trade.executionPrice,
          exitPrice: trade.exitPrice || null,
          realizedPnl: pnl,
          isClosed: trade.status === 'CLOSED',
          status: trade.status,
        };
      }
    }

    const cleanTags = Array.isArray(tags)
      ? tags.map((t) => t.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim()).filter(Boolean)
      : [];

    const newPost = await TradePost.create({
      authorId,
      content: content.trim(),
      tags: cleanTags,
      sentiment: ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(sentiment?.toUpperCase()) ? sentiment.toUpperCase() : 'NEUTRAL',
      tradeId: tradeId || null,
      promiseId: promiseId || null,
      tradeSnapshot,
    });

    const populated = await TradePost.findById(newPost._id)
      .populate('authorId', 'username nullifierHash walletAddress riskLevel tradingStyle tags stats subscribersCount')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Trade post published successfully',
      post: populated,
    });
  } catch (error) {
    console.error('Create post error:', error.message);
    return res.status(500).json({ error: 'Failed to publish trade post' });
  }
});

/**
 * POST /api/posts/:id/like
 * Toggle like for current authenticated user
 */
router.post('/:id/like', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const post = await TradePost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likedIndex = post.likes.findIndex((id) => id.toString() === currentUserId.toString());
    let isLiked = false;

    if (likedIndex > -1) {
      // Unlike
      post.likes.splice(likedIndex, 1);
      post.likesCount = Math.max(0, post.likesCount - 1);
      isLiked = false;
    } else {
      // Like
      post.likes.push(currentUserId);
      post.likesCount += 1;
      isLiked = true;
    }

    await post.save();

    return res.json({
      success: true,
      isLiked,
      likesCount: post.likesCount,
    });
  } catch (error) {
    console.error('Like post error:', error.message);
    return res.status(500).json({ error: 'Failed to update like status' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete post by author
 */
router.delete('/:id', async (req, res) => {
  try {
    const post = await TradePost.findOneAndDelete({
      _id: req.params.id,
      authorId: req.user.userId,
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    return res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
