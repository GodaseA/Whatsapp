// const express = require('express');
// const router = express.Router();
// const Subscriber = require('../models/Subscriber');
// const { sendCustomText } = require('../services/whatsapp');

// // send to one subscriber
// router.post('/send-message', async (req, res) => {
//   const { whatsappNumber, message } = req.body;
//   try {
//     await sendCustomText(whatsappNumber, message);
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err.response?.data || err.message);
//     res.status(500).json({ error: 'Failed to send message' });
//   }
// });

// // broadcast to all active subscribers
// router.post('/broadcast', async (req, res) => {
//   const { message } = req.body;
//   try {
//     const subscribers = await Subscriber.find({ status: 'active' });
//     const results = await Promise.allSettled(
//       subscribers.map(s => sendCustomText(s.whatsappNumber, message))
//     );
//     const failed = results.filter(r => r.status === 'rejected').length;
//     res.json({ sent: subscribers.length - failed, failed });
//   } catch (err) {
//     res.status(500).json({ error: 'Broadcast failed' });
//   }
// });

// module.exports = router;





const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const Message = require('../models/Message'); // ← add this line
const { sendCustomText, sendTemplateMessage } = require('../services/whatsapp');
// routes/messages.js — add this route
// const {  } = require('../services/whatsapp');
// send to one or more specific subscribers (by their _id)


// Direct send: no subscriber lookup, just raw input
router.post('/send-update', async (req, res) => {
  const { name, mobileNo, message } = req.body;

  if (!name || !mobileNo || !message) {
    return res.status(400).json({ error: 'name, mobileNo, and message are all required' });
  }

  const cleanNumber = mobileNo.replace(/[^\d]/g, ''); // strip +, spaces, dashes

  try {
    const response = await sendTemplateMessage(
      cleanNumber,
      'jaspers_market_order_confirmation_v1',
      'en_US',
      [name, message] // fills {{1}} and {{2}} in your template body
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


router.post('/send-message', async (req, res) => {
  const { subscriberIds, message } = req.body;

  if (!Array.isArray(subscriberIds) || subscriberIds.length === 0 || !message) {
    return res.status(400).json({ error: 'subscriberIds (array) and message are required' });
  }

  try {
    const subscribers = await Subscriber.find({ _id: { $in: subscriberIds } });

    const results = await Promise.allSettled(
      subscribers.map(async (s) => {
        const response = await sendCustomText(s.whatsappNumber, message);
        await Message.create({
          subscriber: s._id,
          whatsappNumber: s.whatsappNumber,
          direction: 'outbound',
          text: message
        });
        return response;
      })
    );

    const report = subscribers.map((s, i) => ({
      name: s.name,
      whatsappNumber: s.whatsappNumber,
      status: results[i].status === 'fulfilled' ? 'sent' : 'failed',
      error: results[i].status === 'rejected'
        ? results[i].reason?.response?.data?.error?.message || 'unknown error'
        : null
    }));

    const sentCount = report.filter(r => r.status === 'sent').length;
    res.json({ sentCount, failedCount: report.length - sentCount, report }); // only ONE res.json call
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send messages' });
  }
});

// broadcast to ALL active subscribers
router.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const subscribers = await Subscriber.find({ status: 'active' });
    const results = await Promise.allSettled(
      subscribers.map(s => sendCustomText(s.whatsappNumber, message))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    res.json({ sent: subscribers.length - failed, failed });
  } catch (err) {
    res.status(500).json({ error: 'Broadcast failed' });
  }
});



// broadcast an approved template to selected subscribers (or all, if subscriberIds omitted)
router.post('/broadcast-template', async (req, res) => {
  const { subscriberIds, templateName, languageCode = 'en_US', useNameParam = true } = req.body;

  if (!templateName) return res.status(400).json({ error: 'templateName is required' });

  try {
    const query = subscriberIds?.length
      ? { _id: { $in: subscriberIds } }
      : { status: 'active' };

    const subscribers = await Subscriber.find(query);

    // throttle: send in small batches with a short delay to avoid rate-limit spikes
    const results = [];
    const batchSize = 20;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(s =>
          sendTemplateMessage(
            s.whatsappNumber,
            templateName,
            languageCode,
            useNameParam ? [s.name] : []
          )
        )
      );
      results.push(...batchResults.map((r, idx) => ({
        name: batch[idx].name,
        whatsappNumber: batch[idx].whatsappNumber,
        status: r.status === 'fulfilled' ? 'sent' : 'failed',
        error: r.status === 'rejected' ? r.reason?.response?.data?.error?.message : null
      })));
      if (i + batchSize < subscribers.length) await new Promise(r => setTimeout(r, 1000)); // 1s pause between batches
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    res.json({ sentCount, failedCount: results.length - sentCount, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});


// routes/messages.js — add this
router.get('/conversation/:subscriberId', async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.subscriberId);
    if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });

    const messages = await Message.find({ whatsappNumber: subscriber.whatsappNumber })
      .sort({ timestamp: 1 });

    res.json({ subscriber, messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

module.exports = router;