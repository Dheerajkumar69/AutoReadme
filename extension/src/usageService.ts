import * as vscode from 'vscode';
import * as crypto from 'crypto';

const DEVICE_ID_KEY = 'autodocs.deviceId';
const USAGE_COUNT_KEY = 'autodocs.usageCount';
const USAGE_DATE_KEY = 'autodocs.usageDate';
const IS_PRO_KEY = 'autodocs.isPro';
const TOTAL_COMMENTS_KEY = 'autodocs.totalComments';
const FIRST_USE_KEY = 'autodocs.firstUse';
const STREAK_KEY = 'autodocs.streak';
const LAST_ACTIVE_KEY = 'autodocs.lastActive';

const FREE_DAILY_LIMIT = 100;
const PRO_DAILY_LIMIT = 1000;

// Milestone thresholds for celebrations
const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000];

// Delightful messages
const SUCCESS_MESSAGES = [
    '✨ Comment added! Your code is now more readable.',
    '💡 Nice! Documentation makes everything better.',
    '🎯 Perfect! Future-you will thank you.',
    '📝 Great work! Code clarity +1.',
    '⚡ Boom! Another line documented.',
];

const STREAK_MESSAGES = [
    '🔥 Day {n} streak! Keep it going!',
    '🌟 {n} days in a row! You\'re unstoppable!',
    '💪 {n} day streak! Documentation master!',
];

/**
 * Service for tracking usage with delightful celebrations
 */
export class UsageService {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.ensureDeviceId();
        this.checkFirstRun();
        this.updateStreak();
    }

    /**
     * Check if this is first run and show welcome
     */
    private async checkFirstRun(): Promise<void> {
        const isFirstUse = !this.context.globalState.get(FIRST_USE_KEY);
        if (isFirstUse) {
            await this.context.globalState.update(FIRST_USE_KEY, Date.now());
            this.showWelcome();
        }
    }

    /**
     * Show welcome message on first use
     */
    private showWelcome(): void {
        vscode.window.showInformationMessage(
            '👋 Welcome to AutoDocs! Save any code file to see magic happen. ✨',
            'Got it!'
        );
    }

    /**
     * Update daily streak
     */
    private updateStreak(): void {
        const today = this.getToday();
        const lastActive = this.context.globalState.get<string>(LAST_ACTIVE_KEY);
        const currentStreak = this.context.globalState.get<number>(STREAK_KEY) || 0;

        if (lastActive === today) {
            return; // Already active today
        }

        const yesterday = this.getYesterday();
        if (lastActive === yesterday) {
            // Continue streak
            this.context.globalState.update(STREAK_KEY, currentStreak + 1);
        } else if (lastActive !== today) {
            // Reset streak
            this.context.globalState.update(STREAK_KEY, 1);
        }

        this.context.globalState.update(LAST_ACTIVE_KEY, today);
    }

    /**
     * Get or create a unique device ID
     */
    getDeviceId(): string {
        let deviceId = this.context.globalState.get<string>(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = this.generateDeviceId();
            this.context.globalState.update(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    }

    private ensureDeviceId(): void {
        this.getDeviceId();
    }

    private generateDeviceId(): string {
        return 'device_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Check if user can make a comment request
     */
    canMakeRequest(): { allowed: boolean; remaining: number; limit: number; isPro: boolean } {
        const today = this.getToday();
        const storedDate = this.context.globalState.get<string>(USAGE_DATE_KEY);
        const isPro = this.context.globalState.get<boolean>(IS_PRO_KEY) || false;
        const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

        // Reset count if new day
        if (storedDate !== today) {
            this.context.globalState.update(USAGE_DATE_KEY, today);
            this.context.globalState.update(USAGE_COUNT_KEY, 0);
        }

        const count = this.context.globalState.get<number>(USAGE_COUNT_KEY) || 0;
        const remaining = Math.max(0, limit - count);

        return {
            allowed: count < limit,
            remaining,
            limit,
            isPro
        };
    }

    /**
     * Increment usage count and show celebrations
     */
    async incrementUsage(): Promise<void> {
        // Update daily count
        const count = this.context.globalState.get<number>(USAGE_COUNT_KEY) || 0;
        this.context.globalState.update(USAGE_COUNT_KEY, count + 1);

        // Update total count
        const total = this.context.globalState.get<number>(TOTAL_COMMENTS_KEY) || 0;
        const newTotal = total + 1;
        this.context.globalState.update(TOTAL_COMMENTS_KEY, newTotal);

        // Check for milestones
        await this.checkMilestone(newTotal);

        // Show success message (occasionally)
        if (Math.random() < 0.3) { // 30% chance
            this.showRandomSuccess();
        }
    }

    /**
     * Check if user hit a milestone and celebrate
     */
    private async checkMilestone(total: number): Promise<void> {
        if (MILESTONES.includes(total)) {
            await this.celebrateMilestone(total);
        }
    }

    /**
     * Celebrate milestone with appropriate message
     */
    private async celebrateMilestone(count: number): Promise<void> {
        let message = '';
        let emoji = '🎉';

        switch (count) {
            case 1:
                message = '🎉 Your first AutoDocs comment! Welcome to cleaner code!';
                break;
            case 10:
                message = '🔥 10 comments! You\'re getting the hang of it!';
                break;
            case 25:
                message = '⭐ 25 comments! Your codebase is loving you!';
                break;
            case 50:
                message = '🚀 50 comments! You\'re a documentation hero!';
                break;
            case 100:
                message = '💯 100 comments! Legendary status achieved!';
                emoji = '🏆';
                break;
            case 250:
                message = '🌟 250 comments! Your future self is grateful!';
                break;
            case 500:
                message = '👑 500 comments! Documentation royalty!';
                break;
            case 1000:
                message = '🎊 1000 comments! You are a true AutoDocs champion!';
                emoji = '🏅';
                break;
            default:
                message = `${emoji} ${count} comments generated!`;
        }

        vscode.window.showInformationMessage(message);
    }

    /**
     * Show random success message
     */
    private showRandomSuccess(): void {
        const message = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
        vscode.window.setStatusBarMessage(message, 3000);
    }

    /**
     * Get current usage stats
     */
    getUsageStats(): { used: number; limit: number; remaining: number; isPro: boolean; total: number; streak: number } {
        const isPro = this.context.globalState.get<boolean>(IS_PRO_KEY) || false;
        const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
        const used = this.context.globalState.get<number>(USAGE_COUNT_KEY) || 0;
        const total = this.context.globalState.get<number>(TOTAL_COMMENTS_KEY) || 0;
        const streak = this.context.globalState.get<number>(STREAK_KEY) || 0;

        return {
            used,
            limit,
            remaining: Math.max(0, limit - used),
            isPro,
            total,
            streak
        };
    }

    /**
     * Show upgrade prompt when limit is hit
     */
    async showUpgradePrompt(): Promise<void> {
        const stats = this.getUsageStats();
        const result = await vscode.window.showWarningMessage(
            `🚀 You've used all ${stats.limit} comments today! You've generated ${stats.total} total comments. Upgrade to Pro for ₹10/month!`,
            'Upgrade Now',
            'Maybe Tomorrow'
        );

        if (result === 'Upgrade Now') {
            vscode.env.openExternal(vscode.Uri.parse('https://autodocs.app/upgrade'));
        }
    }

    /**
     * Activate Pro status
     */
    activatePro(): void {
        this.context.globalState.update(IS_PRO_KEY, true);
        vscode.window.showInformationMessage('🎉 AutoDocs Pro activated! You now have 1000 comments/day. Thank you for your support! 💜');
    }

    private getToday(): string {
        return new Date().toISOString().split('T')[0];
    }

    private getYesterday(): string {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }
}
