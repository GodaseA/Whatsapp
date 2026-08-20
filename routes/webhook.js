const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sendCustomText, sendTemplateMessage } = require('../services/whatsapp');

// 1. Verification — Meta calls this once when you register the webhook URL
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// 2. Receiving actual messages — no DB, just forward and reply
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack Meta immediately, process in background

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const incomingMessage = value?.messages?.[0];

    if (!incomingMessage) return;

    const fromNumber = incomingMessage.from; // e.g. "917498873816"
    const text = incomingMessage.text?.body || '[non-text message]';

    console.log(`Inbound from ${fromNumber}: ${text}`);

    // 1. forward to your /chat API
    // 
    const replyText = await getReplyFromChatAPI(fromNumber, text);

    // 2. send reply back on WhatsApp — no DB save
    // await sendCustomText(fromNumber, replyText);
    await sendCustomText(fromNumber, text);

    console.log(`Replied to ${fromNumber}: ${replyText}`);
  } catch (err) {
    console.error('Webhook processing error:', err.response?.data || err.message);
  }
});

async function getReplyFromChatAPI(userId, message) {
  try {
    const response = await axios.post(
      process.env.EXTERNAL_API_URL,
      { user_id: userId, message },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    return response.data.reply || 'Sorry, I could not process that.';
  } catch (err) {
    console.error('Chat API error:', err.response?.data || err.message);
    return 'Sorry, something went wrong on our end. Please try again shortly.';
  }
}

// Send order confirmation template — no DB, direct input
router.post('/send-order-confirmation', async (req, res) => {
  const { name, mobileNo, message } = req.body || {};

  if (!name || !mobileNo || !message) {
    return res.status(400).json({
      error: 'name, mobileNo, and message are all required'
    });
  }

  const cleanNumber = mobileNo.replace(/[^\d]/g, '');
  const deliveryDate = '.';

  try {
    const response = await sendTemplateMessage(
      cleanNumber,
      'jaspers_market_order_confirmation_v1',
      'en_US',
      [name, message, deliveryDate]
    );

    res.json({ success: true, whatsappResponse: response.data });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to send message',
      details: err.response?.data?.error?.message || err.message
    });
  }
});

router.get('/debug-env', (req, res) => {
  res.json({
    hasToken: !!process.env.WEBHOOK_VERIFY_TOKEN,
    tokenLength: process.env.WEBHOOK_VERIFY_TOKEN?.length || 0
  });
});

module.exports = router;