const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const { sendWelcomeTemplate } = require('../services/whatsapp');

router.post('/subscribe', async (req, res) => {
  try {
    const { name, whatsappNumber } = req.body;
    if (!name || !whatsappNumber) {
      return res.status(400).json({ error: 'Name and WhatsApp number are required' });
    }

    // normalize: strip spaces/dashes, ensure country code present
    const cleanNumber = whatsappNumber.replace(/[^\d]/g, '');

    const existing = await Subscriber.findOne({ whatsappNumber: cleanNumber });
    if (existing) {
      return res.status(409).json({ error: 'Already subscribed' });
    }

    const subscriber = await Subscriber.create({ name, whatsappNumber: cleanNumber });

    await sendWelcomeTemplate(cleanNumber, name);

    res.status(201).json({ message: 'Subscribed successfully', subscriber });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

module.exports = router;