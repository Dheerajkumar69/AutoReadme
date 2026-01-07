import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { commentRoutes } from './routes/comments';
import { docRoutes } from './routes/docs';
import { authMiddleware } from './middleware/auth';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all origins for VS Code extension
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { error: 'Too many requests', code: 'RATE_LIMITED' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Health check (no auth required)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'AutoReadme API',
        version: '0.1.0',
        status: 'running'
    });
});

// Protected routes
app.use('/api/comments', authMiddleware, commentRoutes);
app.use('/api/docs', authMiddleware, docRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
        console.log(`🚀 AutoReadme backend running on port ${PORT}`);
    });
}

// Export for Vercel
export default app;
