const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber' },
  whatsappNumber: { type: String, required: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true }, // inbound = from user, outbound = from you
  text: { type: String, required: true },
  waMessageId: { type: String }, // WhatsApp's message id, useful for status tracking
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);