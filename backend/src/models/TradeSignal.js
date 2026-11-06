import mongoose from 'mongoose';

const tradeSignalSchema = new mongoose.Schema(
  {
    signalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    leaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leaderPublicKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followerPublicKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    encryptedTradeSignal: {
      type: String,
      required: true,
    },
    encryptedPayloadHex: {
      type: String,
    },
    requiresMetaMaskDecrypt: {
      type: Boolean,
      default: false,
    },
    tradePayload: {
      symbol: String,
      side: String,
      orderType: String,
      limit: Number,
      amount: Number,
      stopLoss: Number,
      target: Number,
      burnerAccountAddress: String,
      payloadHash: String,
      promiseId: String,
      tradeIndex: Number,
    },
    arkivEntityKey: {
      type: String,
      index: true,
    },
    arkivTxHash: {
      type: String,
    },
    ttlSeconds: {
      type: Number,
      default: 600, // 10 minutes in seconds
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXECUTED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    executedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// TTL index to automatically prune expired signals if desired
tradeSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const TradeSignal = mongoose.model('TradeSignal', tradeSignalSchema);
export default TradeSignal;

