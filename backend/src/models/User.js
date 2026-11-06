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
});

const User = mongoose.model('User', userSchema);

export default User;
