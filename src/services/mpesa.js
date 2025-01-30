const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;

// Generate Access Token
const getAccessToken = async () => {
  const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  return response.data.access_token;
};

// Initiate STK Push
const initiateSTKPush = async (phone, amount, accountReference) => {
  const accessToken = await getAccessToken();

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .substring(0, 14);

  const password = Buffer.from(
    `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: 'http://localhost/api/order/payment/callback',
    AccountReference: accountReference,
    TransactionDesc: 'Payment for Order',
  };

  const response = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
};

module.exports = { initiateSTKPush };
