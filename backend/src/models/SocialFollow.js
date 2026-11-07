import mongoose from 'mongoose';

/**
 * SocialFollow Schema
 * Represents a lightweight, 1-click free social connection.
 * Unlocks the leader's social posts, updates, and trade commentary in the follower's feed.
 */
const socialFollowSchema = new mongoose.Schema(
  {
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
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate social follows
socialFollowSchema.index({ leaderId: 1, followerId: 1 }, { unique: true });

const SocialFollow = mongoose.model('SocialFollow', socialFollowSchema);
export default SocialFollow;
