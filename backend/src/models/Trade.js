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
      enum: ['LIMIT', 'MARKET', 'BRACKET', 'TWAP'],
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
      enum: ['PROMISED', 'EXECUTED', 'CLOSED', 'CANCELLED', 'FAILED'],
      default: 'PROMISED',
      index: true,
    },
    executionPrice: {
      type: Number,
    },
    executionTxHash: {
      type: String,
    },
    entryDeliveryTxHash: String,
    entryUsdcUnits: String,
    wethUnits: String,
    entryGasWei: String,
    entryBlockTimestamp: Date,
    receiptsVerified: { type: Boolean, default: false },
    originalSignalId: { type: String, index: true },
    promisePayload: mongoose.Schema.Types.Mixed,
    promiseLeaderAddress: String,
    promiseEntityKey: String,
    exitType: { type: String, enum: ['tp', 'sl'] },
    exitPrice: Number,
    exitReturnTxHash: String,
    exitPayoutTxHash: String,
    exitUsdcUnits: String,
    realizedPnlUnits: String,
    exitGasWei: String,
    closedAt: Date,
    claimEntityKey: String,
    claimTxHash: String,
  },
  { timestamps: true }
);
tradeSchema.index({ userId: 1, executionTxHash: 1 }, { unique: true, partialFilterExpression: { receiptsVerified: true } });
tradeSchema.index({ userId: 1, entryDeliveryTxHash: 1 }, { unique: true, partialFilterExpression: { receiptsVerified: true } });
tradeSchema.index({ userId: 1, exitPayoutTxHash: 1 }, { unique: true, partialFilterExpression: { receiptsVerified: true, status: 'CLOSED' } });

const Trade = mongoose.model('Trade', tradeSchema);
export default Trade;

