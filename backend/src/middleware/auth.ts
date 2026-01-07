import { Request, Response, NextFunction } from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';

// Re-export Clerk middleware for use in routes
export { clerkMiddleware };

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
        }
    }
}

/**
 * Middleware to verify Clerk authentication
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Missing authentication token',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const token = authHeader.substring(7);

        // In development, allow a special bypass token
        if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
            req.userId = 'dev-user';
            req.userEmail = 'dev@autoreadme.local';
            next();
            return;
        }

        // For production, use Clerk's getAuth
        // Token verification happens via Clerk middleware
        const auth = getAuth(req);

        if (!auth?.userId) {
            res.status(401).json({
                error: 'Invalid authentication token',
                code: 'AUTH_INVALID'
            });
            return;
        }

        req.userId = auth.userId;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            error: 'Authentication error',
            code: 'AUTH_ERROR'
        });
    }
}
