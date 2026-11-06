import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    isCopyTrade: {
      type: Boolean,
      default: false,
    },
    originalTradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
    },
    tradeIndex: {
      type: Number,
      default: 1,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    side: {
      type: String,
      enum: ['BUY', 'SELL', 'LONG', 'SHORT'],
      required: true,
    },
    orderType: {
      type: String,
      enum: ['LIMIT', 'MARKET'],
      default: 'LIMIT',
    },
    limit: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    stopLoss: {
      type: Number,
      default: 0,
    },
    target: {
      type: Number,
      default: 0,
    },
    burnerAccountAddress: {
      type: String,
      lowercase: true,
      trim: true,
    },
    payloadHash: {
      type: String,
      required: true,
      index: true,
    },
    promiseId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['PROMISED', 'EXECUTED', 'CANCELLED', 'FAILED'],
      default: 'PROMISED',
      index: true,
    },
    executionPrice: {
      type: Number,
    },
    executionTxHash: {
      type: String,
    },
  },
  { timestamps: true }
);

const Trade = mongoose.model('Trade', tradeSchema);
export default Trade;

