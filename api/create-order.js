export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, tierId, userId, userEmail } = req.body;

    if (!amount || !tierId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate amount matches tier (prevent tampering)
    const validTiers = {
      companion: 19900,   // ₹199
      intimate: 49900,    // ₹499
      annual: 299900      // ₹2,999
    };

    if (validTiers[tierId] !== amount) {
      return res.status(400).json({ error: 'Invalid amount for tier' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay keys not configured');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    // Create Razorpay order via REST API
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        receipt: `mitr_${tierId}_${userId.substring(0, 8)}_${Date.now()}`,
        notes: {
          tier_id: tierId,
          user_id: userId,
          user_email: userEmail || ''
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Razorpay order error:', errorData);
      throw new Error(errorData.error?.description || 'Failed to create order');
    }

    const order = await response.json();

    console.log('Order created:', order.id, 'Amount:', amount, 'Tier:', tierId);

    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error('Create order error:', error.message);
    return res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
}
