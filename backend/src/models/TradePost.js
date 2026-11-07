import mongoose from 'mongoose';

/**
 * TradePost Schema
 * Social feed post authored by a leader.
 * Can include trade commentary, market sentiment, tags, and an optional link to an executed Trade or pre-trade Promise.
 */
const tradePostSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxLength: 1200,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    sentiment: {
      type: String,
      enum: ['BULLISH', 'BEARISH', 'NEUTRAL'],
      default: 'NEUTRAL',
    },
    // Optional reference to a specific Trade record
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
      default: null,
    },
    // Optional reference to an Arkiv promise ID
    promiseId: {
      type: String,
      default: null,
      trim: true,
    },
    // Snapshot of trade details if attached
    tradeSnapshot: {
      symbol: String,
      side: String,
      entryPrice: Number,
      exitPrice: Number,
      realizedPnl: Number,
      isClosed: Boolean,
      status: String,
    },
    likesCount: {
      type: Number,
      default: 0,
      index: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

tradePostSchema.index({ createdAt: -1 });
tradePostSchema.index({ authorId: 1, createdAt: -1 });
tradePostSchema.index({ tags: 1 });

const TradePost = mongoose.model('TradePost', tradePostSchema);
export default TradePost;
