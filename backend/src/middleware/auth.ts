import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include device ID
declare global {
    namespace Express {
        interface Request {
            deviceId?: string;
        }
    }
}

/**
 * Middleware to extract device ID from request
 * No authentication required - just device identification
 */
export function deviceMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    // Get device ID from header or authorization
    const deviceId =
        req.headers['x-device-id'] as string ||
        req.headers['authorization']?.replace('Bearer ', '') ||
        'anonymous';

    req.deviceId = deviceId;
    next();
}

/**
 * Optional auth middleware for Pro users (future use)
 */
export function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    // Just pass through - device ID is sufficient
    next();
}
