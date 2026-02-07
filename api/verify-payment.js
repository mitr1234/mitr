import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tierId, userId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error('Razorpay secret not configured');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    // Verify signature using HMAC SHA256
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch!', { expected: expectedSignature, received: razorpay_signature });
      return res.status(400).json({ error: 'Payment verification failed - invalid signature' });
    }

    // Payment verified successfully
    console.log('Payment verified ✓', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      tier: tierId,
      userId: userId
    });

    return res.status(200).json({
      success: true,
      paymentId: razorpay_payment_id,
      message: 'Payment verified successfully'
    });

  } catch (error) {
    console.error('Verify payment error:', error.message);
    return res.status(500).json({ error: 'Verification failed', details: error.message });
  }
}
