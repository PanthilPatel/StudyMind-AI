/**
 * Razorpay Payment Integration
 * 
 * Handles the client-side Razorpay checkout flow for upgrading to Pro plan.
 * 
 * Note: In a production environment, you should create orders on a backend server.
 * This implementation uses a simplified client-side flow for demonstration.
 * 
 * Setup:
 * 1. Create a Razorpay account at https://razorpay.com
 * 2. Get your Key ID from the Dashboard
 * 3. Add it to .env as VITE_RAZORPAY_KEY_ID
 */

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

/**
 * Launch Razorpay checkout for Pro plan upgrade
 * 
 * @param {Object} options
 * @param {string} options.userEmail - User's email for prefill
 * @param {string} options.userName - User's name for prefill
 * @param {Function} options.onSuccess - Callback on successful payment
 * @param {Function} options.onError - Callback on payment failure
 */
export function initiatePayment({ userEmail, userName, onSuccess, onError }) {
  if (!RAZORPAY_KEY_ID) {
    onError?.(new Error('Razorpay key not configured. Add VITE_RAZORPAY_KEY_ID to .env'));
    return;
  }

  if (typeof window.Razorpay === 'undefined') {
    onError?.(new Error('Razorpay SDK not loaded. Please refresh and try again.'));
    return;
  }

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: 100, // ₹1 in paise
    currency: 'INR',
    name: 'StudyMind AI (Your Name)', // <--- This displays the payment receiver name
    description: 'Pro Plan — Monthly Subscription',
    image: '', // Add logo URL if available
    handler: function (response) {
      // Payment successful
      // In production, verify signature on backend before upgrading
      onSuccess?.({
        paymentId: response.razorpay_payment_id,
        orderId: response.razorpay_order_id,
        signature: response.razorpay_signature,
      });
    },
    prefill: {
      name: userName || '',
      email: userEmail || '',
    },
    notes: {
      plan: 'pro_monthly',
      product: 'studymind_ai',
    },
    theme: {
      color: '#6366F1',
    },
    modal: {
      ondismiss: function () {
        // User closed the payment modal
      },
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      onError?.(new Error(response.error.description || 'Payment failed'));
    });
    rzp.open();
  } catch (error) {
    onError?.(error);
  }
}
