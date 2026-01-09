import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { commentRoutes } from './routes/comments';
import { docRoutes } from './routes/docs';
import { paymentRoutes } from './routes/payment';
import { deviceMiddleware } from './middleware/auth';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, slow down!', code: 'RATE_LIMITED' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Device ID middleware
app.use(deviceMiddleware);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'AutoDocs API',
        version: '0.3.0',
        status: 'running',
        pricing: {
            free: '100 comments/day',
            pro: '1000 comments/day for ₹10/month'
        }
    });
});

// Public routes
app.use('/api/comments', commentRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/payment', paymentRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 AutoDocs backend running on port ${PORT}`);
    });
}

// Export for Vercel
export default app;
