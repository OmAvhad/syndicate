import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  promiseId: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tradeIndex: Number,
  leaderPublicKey: String,
  payloadHash: String,
  payload: mongoose.Schema.Types.Mixed,
  arkivEntityKey: String,
  arkivOnChain: Boolean,
}, { timestamps: true });
export default mongoose.model('TradePromise', schema);
