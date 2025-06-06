// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ['client', 'lawyer'],  // Either client or lawyer
    required: true
  },

  profileImage: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
