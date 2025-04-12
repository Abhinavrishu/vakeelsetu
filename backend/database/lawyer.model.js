// models/Lawyer.js
const mongoose = require('mongoose');

const lawyerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // This links to the User model
    required: true,
  },
  specialization: {
    type: String,
    required: true, 
  },
  
  experience: {
    type: Number,
    required: true,  // Years of experience
  },
 
  profileImage: {
    type: String,
    default: '',  // URL or base64 encoded image
  }
}, { timestamps: true });

module.exports = mongoose.model('Lawyer', lawyerSchema);
