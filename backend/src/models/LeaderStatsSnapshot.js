import mongoose from 'mongoose';

/**
 * LeaderStatsSnapshot Schema
 * Historical time-series points capturing daily/event-based snapshots of a leader's cumulative metrics.
 * Used to render interactive PnL equity curves on leader profiles and modals.
 */
const leaderStatsSnapshotSchema = new mongoose.Schema(
  {
    leaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    cumulativePnlUsdc: {
      type: Number,
      required: true,
    },
    dailyPnlUsdc: {
      type: Number,
      default: 0,
    },
    cumulativeTrades: {
      type: Number,
      required: true,
    },
    winRate: {
      type: Number,
      required: true,
    },
    activeSubscribers: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

leaderStatsSnapshotSchema.index({ leaderId: 1, date: -1 });

const LeaderStatsSnapshot = mongoose.model('LeaderStatsSnapshot', leaderStatsSnapshotSchema);
export default LeaderStatsSnapshot;
