import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  leaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  leaderNullifier: {
    type: String,
    required: true,
  },
  leaderPublicKey: {
    type: String,
    required: true,
    lowercase: true,
  },
  followerNullifier: {
    type: String,
    required: true,
  },
  followerPublicKey: {
    type: String,
    required: true,
    lowercase: true,
  },
  transactionId: {
    type: String,
    required: true,
  },
  transactionDate: {
    type: Date,
    default: Date.now,
  },
  feeAmount: {
    type: Number,
    required: true,
  },
  arkivEntityKey: {
    type: String,
    default: null,
  },
  arkivTxHash: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'unfollowed', 'expired'],
    default: 'active',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a user can only have one active follow per leader
followSchema.index({ leaderId: 1, followerId: 1 }, { unique: true });

const Follow = mongoose.model('Follow', followSchema);

export default Follow;

