import { Router, Request, Response } from 'express';
import { activatePro, isPro } from '../services/usageTracker';

export const paymentRoutes = Router();

/**
 * POST /api/payment/verify
 * Verify payment and activate Pro status
 * In production: Integrate with Razorpay webhook
 */
paymentRoutes.post('/verify', async (req: Request, res: Response) => {
    try {
        const { deviceId, paymentId, orderId } = req.body;

        if (!deviceId) {
            res.status(400).json({
                error: 'Device ID required',
                code: 'MISSING_DEVICE_ID'
            });
            return;
        }

        // TODO: In production, verify payment with Razorpay
        // const razorpay = new Razorpay({ key_id, key_secret });
        // const payment = await razorpay.payments.fetch(paymentId);
        // if (payment.status !== 'captured') throw new Error('Payment not captured');

        // For now, activate Pro (in production, only after payment verification)
        if (paymentId && orderId) {
            activatePro(deviceId);

            res.json({
                success: true,
                message: 'Pro activated! Enjoy 1000 comments/day.',
                isPro: true
            });
        } else {
            res.status(400).json({
                error: 'Payment verification failed',
                code: 'PAYMENT_FAILED'
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            error: 'Payment processing error',
            code: 'PAYMENT_ERROR'
        });
    }
});

/**
 * GET /api/payment/status
 * Check Pro status for a device
 */
paymentRoutes.get('/status', (req: Request, res: Response) => {
    const deviceId = req.headers['x-device-id'] as string || 'anonymous';

    res.json({
        isPro: isPro(deviceId),
        pricing: {
            monthly: '₹10',
            features: ['1000 comments/day', 'Priority support', 'All comment styles']
        }
    });
});

/**
 * POST /api/payment/create-order
 * Create a Razorpay order (placeholder)
 */
paymentRoutes.post('/create-order', async (req: Request, res: Response) => {
    try {
        // TODO: In production, create Razorpay order
        // const razorpay = new Razorpay({ key_id, key_secret });
        // const order = await razorpay.orders.create({
        //     amount: 1000, // ₹10 in paise
        //     currency: 'INR',
        //     receipt: `order_${Date.now()}`
        // });

        // Placeholder response
        res.json({
            orderId: `order_${Date.now()}`,
            amount: 1000,
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
            description: 'AutoDocs Pro - 1 Month'
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            error: 'Failed to create order',
            code: 'ORDER_ERROR'
        });
    }
});
