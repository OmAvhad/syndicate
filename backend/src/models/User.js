import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nullifierHash: {
    type: String,
    unique: true,
    required: true,
  },
  username: {
    type: String,
    default: null,
  },
  walletAddress: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
  },
  encryptionPublicKey: {
    type: String,
    default: null,
    trim: true,
  },
  walletConnectedAt: {
    type: Date,
    default: null,
  },
  subscriptionFee: {
    type: Number,
    default: 0.001, // Subscription fee in ETH
  },
  followersCount: {
    type: Number,
    default: 0,
  },
  followingCount: {
    type: Number,
    default: 0,
  },
  tradeCount: {
    type: Number,
    default: 0,
  },
  bio: {
    type: String,
    default: null,
  },
  avatarUrl: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  verificationLevel: {
    type: String,
    default: 'orb',
  },
  loginCount: {
    type: Number,
    default: 0,
  },
  riskLevel: {
    type: String,
    enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'DEGEN'],
    default: 'MODERATE',
    index: true,
  },
  tradingStyle: {
    type: String,
    enum: ['SWING', 'DAY_TRADER', 'SCALPER', 'POSITION'],
    default: 'SWING',
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  subscribersCount: {
    type: Number,
    default: 0,
    index: true,
  },
  subscribedCount: {
    type: Number,
    default: 0,
  },
  stats: {
    totalPnlUsdc: { type: Number, default: 0, index: true },
    totalRoiPercent: { type: Number, default: 0 },
    winRate: { type: Number, default: 0, index: true },
    totalTrades: { type: Number, default: 0, index: true },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    profitFactor: { type: Number, default: 0 },
    avgHoldMinutes: { type: Number, default: 0 },
    totalVolumeUsdc: { type: Number, default: 0 },
    verifiedClaimsCount: { type: Number, default: 0, index: true },
    lastTradeAt: { type: Date, default: null },
  },
});

userSchema.index({ 'stats.totalPnlUsdc': -1 });
userSchema.index({ 'stats.winRate': -1 });
userSchema.index({ riskLevel: 1, tradingStyle: 1 });

const User = mongoose.model('User', userSchema);

export default User;
