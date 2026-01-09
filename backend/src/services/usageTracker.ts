/**
 * Simple in-memory usage tracker for device-based limits
 * In production, use Redis or a database
 */

interface UsageRecord {
    count: number;
    date: string;
    isPro: boolean;
}

const FREE_LIMIT = 100;
const PRO_LIMIT = 1000;

// In-memory storage (resets on server restart - use Redis in production)
const usageStore: Map<string, UsageRecord> = new Map();

/**
 * Get today's date string
 */
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Check if device can make a request
 */
export function checkUsage(deviceId: string): { allowed: boolean; remaining: number; limit: number; used: number } {
    const today = getToday();
    let record = usageStore.get(deviceId);

    // Reset if new day or no record
    if (!record || record.date !== today) {
        record = { count: 0, date: today, isPro: record?.isPro || false };
        usageStore.set(deviceId, record);
    }

    const limit = record.isPro ? PRO_LIMIT : FREE_LIMIT;
    const remaining = Math.max(0, limit - record.count);

    return {
        allowed: record.count < limit,
        remaining,
        limit,
        used: record.count
    };
}

/**
 * Increment usage for a device
 */
export function incrementUsage(deviceId: string): void {
    const record = usageStore.get(deviceId);
    if (record) {
        record.count += 1;
        usageStore.set(deviceId, record);
    }
}

/**
 * Activate Pro status for a device
 */
export function activatePro(deviceId: string): void {
    const today = getToday();
    const record = usageStore.get(deviceId) || { count: 0, date: today, isPro: false };
    record.isPro = true;
    usageStore.set(deviceId, record);
}

/**
 * Check if device is Pro
 */
export function isPro(deviceId: string): boolean {
    return usageStore.get(deviceId)?.isPro || false;
}
