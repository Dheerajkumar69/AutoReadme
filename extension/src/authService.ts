import * as vscode from 'vscode';

// Clerk Dashboard hosted pages
const CLERK_SIGN_IN_URL = 'https://precious-wren-58.accounts.dev/sign-in';
const AUTH_STATE_KEY = 'autodocs.authToken';
const USER_STATE_KEY = 'autodocs.userInfo';

interface UserInfo {
    id: string;
    email: string;
    name?: string;
}

/**
 * Service for handling Clerk authentication via browser
 */
export class AuthService {
    private context: vscode.ExtensionContext;
    private _onAuthStateChanged = new vscode.EventEmitter<boolean>();
    public readonly onAuthStateChanged = this._onAuthStateChanged.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn(): boolean {
        const token = this.getToken();
        return !!token;
    }

    /**
     * Get the stored auth token
     */
    getToken(): string | undefined {
        return this.context.globalState.get<string>(AUTH_STATE_KEY);
    }

    /**
     * Get stored user info
     */
    getUserInfo(): UserInfo | undefined {
        return this.context.globalState.get<UserInfo>(USER_STATE_KEY);
    }

    /**
     * Initiate browser-based login with manual confirmation
     */
    async login(): Promise<boolean> {
        try {
            // Open Clerk sign-in page in browser
            console.log('[AutoDocs] Opening Clerk sign-in page...');
            const opened = await vscode.env.openExternal(vscode.Uri.parse(CLERK_SIGN_IN_URL));

            if (!opened) {
                vscode.window.showErrorMessage('Failed to open browser for login');
                return false;
            }

            // Ask user to confirm when they've signed in
            const result = await vscode.window.showInformationMessage(
                '🔐 Sign in with Clerk in your browser, then click "I\'ve Signed In" to continue.',
                { modal: false },
                "I've Signed In",
                'Cancel'
            );

            if (result === "I've Signed In") {
                // User confirmed they signed in - activate the extension
                await this.activateSession();
                return true;
            }

            return false;
        } catch (error) {
            console.error('[AutoDocs] Login error:', error);
            vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    /**
     * Activate session after user confirms sign-in
     */
    private async activateSession(): Promise<void> {
        // Generate a session token (in production, this would be verified with Clerk API)
        const sessionToken = 'clerk-session-' + Date.now();

        // Prompt for email (optional, for personalization)
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email (used for Clerk sign-in)',
            placeHolder: 'you@example.com',
            ignoreFocusOut: true
        });

        await this.context.globalState.update(AUTH_STATE_KEY, sessionToken);
        await this.context.globalState.update(USER_STATE_KEY, {
            id: 'user-' + Date.now(),
            email: email || 'user@autodocs.app',
            name: email?.split('@')[0] || 'User'
        });

        this._onAuthStateChanged.fire(true);
        vscode.window.showInformationMessage(`✅ Welcome to AutoDocs! You're now logged in.`);
    }

    /**
     * Logout and clear stored credentials
     */
    async logout(): Promise<void> {
        await this.context.globalState.update(AUTH_STATE_KEY, undefined);
        await this.context.globalState.update(USER_STATE_KEY, undefined);
        this._onAuthStateChanged.fire(false);
        vscode.window.showInformationMessage('Logged out of AutoDocs');
    }

    dispose(): void {
        this._onAuthStateChanged.dispose();
    }
}
