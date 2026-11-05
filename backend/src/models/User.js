import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nullifierHash: {
    type: String,
    unique: true,
    required: true,
  },
  username: {
    type: String,
    optional: true,
  },
  displayName: {
    type: String,
    optional: true,
  },
  bio: {
    type: String,
    optional: true,
  },
  avatarUrl: {
    type: String,
    optional: true,
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
