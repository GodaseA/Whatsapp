// const express = require('express');
// const router = express.Router();
// const Message = require('../models/Message');
// const Subscriber = require('../models/Subscriber');

// // 1. Verification — Meta calls this once when you register the webhook URL
// router.get('/webhook', (req, res) => {
//   const mode = req.query['hub.mode'];
//   const token = req.query['hub.verify_token'];
//   const challenge = req.query['hub.challenge'];

//   console.log('Received token:', token);
//   console.log('Expected token:', process.env.WEBHOOK_VERIFY_TOKEN);

//   if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
//     console.log('Webhook verified');
//     return res.status(200).send(challenge);
//   }
//   res.sendStatus(403);
// });

// // 2. Receiving actual messages/events
// router.post('/webhook', async (req, res) => {

//   // console.log('--- WEBHOOK HIT ---');
//   // console.log(JSON.stringify(req.body, null, 2));  
  
//   try {
//     const entry = req.body.entry?.[0];
//     const change = entry?.changes?.[0];
//     const value = change?.value;

//     const incomingMessage = value?.messages?.[0];

//     if (incomingMessage) {
//       const fromNumber = incomingMessage.from; // e.g. "917498873816"
//       const text = incomingMessage.text?.body || '[non-text message]';
//       const waMessageId = incomingMessage.id;

//       const subscriber = await Subscriber.findOne({ whatsappNumber: fromNumber });

//       await Message.create({
//         subscriber: subscriber?._id,
//         whatsappNumber: fromNumber,
//         direction: 'inbound',
//         text,
//         waMessageId
//       });

//       console.log(`Message from ${fromNumber}: ${text}`);
//     }

//     // always respond 200 quickly, or Meta will retry/disable your webhook
//     res.sendStatus(200);
//   } catch (err) {
//     console.error(err);
//     res.sendStatus(200); // still 200 — don't let Meta retry-storm you
//   }
// });

// module.exports = router;














const express = require('express');
const router = express.Router();
const axios = require('axios');
const Message = require('../models/Message');
const Subscriber = require('../models/Subscriber');
const { sendCustomText, sendTemplateMessage  } = require('../services/whatsapp');

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

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
    const waMessageId = incomingMessage.id;

    const subscriber = await Subscriber.findOne({ whatsappNumber: fromNumber });

    // 1. save inbound message
    await Message.create({
      subscriber: subscriber?._id,
      whatsappNumber: fromNumber,
      direction: 'inbound',
      text,
      waMessageId
    });
    console.log(`Inbound from ${fromNumber}: ${text}`);

    // 2. forward to your /chat API
    const replyText = await getReplyFromChatAPI(fromNumber, text);

    // 3. send reply back on WhatsApp
    await sendCustomText(fromNumber, replyText);

    // 4. save outbound reply
    await Message.create({
      subscriber: subscriber?._id,
      whatsappNumber: fromNumber,
      direction: 'outbound',
      text: replyText
    });
    console.log(`Replied to ${fromNumber}: ${replyText}`);
  } catch (err) {
    console.error('Webhook processing error:', err.response?.data || err.message);
  }
});

async function getReplyFromChatAPI(userId, message) {
  try {
    const response = await axios.post(
      process.env.EXTERNAL_API_URL,
      { userId: userId, message },
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



router.post('/send-order-confirmation', async (req, res) => {
  const { name, mobileNo, message} = req.body || {};

  if (!name || !mobileNo || !message ) {
    return res.status(400).json({
      error: 'name, mobileNo, orderNumber, and deliveryDate are all required'
    });
  }

  const cleanNumber = mobileNo.replace(/[^\d]/g, '');
 const deliveryDate = ".";
  try {
    const response = await sendTemplateMessage(
      cleanNumber,
      'jaspers_market_order_confirmation_v1',
      'en_US',
      [name, message, deliveryDate] // fills {{1}}, {{2}}, {{3}} in order
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

module.exports = router;