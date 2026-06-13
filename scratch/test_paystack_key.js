import axios from 'axios';

async function testSecretKey() {
  const secretKey = 'sk_test_059ea3ef174e61ce10d225430ae3a6dfe5840528';
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: 'ayomikunamoo89@gmail.com',
      amount: 100000,
      reference: 'TEST-' + Date.now(),
    }, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Key is VALID! Success:', response.data.data);
  } catch (error) {
    console.error('Key is INVALID! Error:', error.response?.data || error.message);
  }
}

testSecretKey();
