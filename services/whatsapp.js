const axios = require('axios');

const BASE_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = {
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
};

// Used for the very first message (must be an approved template)
async function sendWelcomeTemplate(toNumber, name) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1', // match your real approved template
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: '123456' },     // whatever this param represents for you
            { type: 'text', text: 'Aug 18, 2026' } // same here
          ]
        }
      ]
    }
  };
  return axios.post(BASE_URL, payload, { headers });
}

// Used for custom/broadcast messages to people within the 24hr session window,
// or use another approved template if outside that window
async function sendCustomText(toNumber, message) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'text',
    text: { body: message }
  };
  return axios.post(BASE_URL, payload, { headers });
}




// services/whatsapp.js — add this function
async function sendTemplateMessage(toNumber, templateName, languageCode, bodyParams = []) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length
        ? [{ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text })) }]
        : []
    }
  };
  return axios.post(BASE_URL, payload, { headers });
}

module.exports = { sendWelcomeTemplate, sendCustomText, sendTemplateMessage };
// module.exports = { sendWelcomeTemplate, sendCustomText };c