const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  whatsappNumber: { type: String, required: true, unique: true, trim: true }, // E.164 format e.g. 91XXXXXXXXXX
  subscribedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'unsubscribed'], default: 'active' }
});

module.exports = mongoose.model('Subscriber', subscriberSchema);