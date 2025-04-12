// models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // This links to the User model
    required: true,
  },
  
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
