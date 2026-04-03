const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    passwordHash: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

userSchema.methods.comparePassword = function comparePassword(plainTextPassword) {
  return bcrypt.compare(plainTextPassword, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, 10);
};

module.exports = mongoose.model('User', userSchema);
