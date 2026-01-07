import * as vscode from 'vscode';

const CLERK_FRONTEND_API = 'https://precious-wren-58.clerk.accounts.dev';
const AUTH_STATE_KEY = 'autoreadme.authToken';
const USER_STATE_KEY = 'autoreadme.userInfo';

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
     * Initiate browser-based login
     */
    async login(): Promise<boolean> {
        try {
            // Create a local server to receive the callback
            const callbackUri = await vscode.env.asExternalUri(
                vscode.Uri.parse(`${vscode.env.uriScheme}://autoreadme.autoreadme/auth-callback`)
            );

            // Build Clerk OAuth URL
            const authUrl = `${CLERK_FRONTEND_API}/sign-in?redirect_url=${encodeURIComponent(callbackUri.toString())}`;

            // Open browser for authentication
            const opened = await vscode.env.openExternal(vscode.Uri.parse(authUrl));

            if (!opened) {
                vscode.window.showErrorMessage('Failed to open browser for login');
                return false;
            }

            // Show message to user
            vscode.window.showInformationMessage(
                'Complete sign-in in your browser. The extension will activate once logged in.',
                'Cancel'
            ).then(selection => {
                if (selection === 'Cancel') {
                    // User cancelled
                }
            });

            return true;
        } catch (error) {
            console.error('Login error:', error);
            vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    /**
     * Handle OAuth callback with token
     */
    async handleCallback(token: string, userInfo?: UserInfo): Promise<void> {
        await this.context.globalState.update(AUTH_STATE_KEY, token);

        if (userInfo) {
            await this.context.globalState.update(USER_STATE_KEY, userInfo);
        }

        this._onAuthStateChanged.fire(true);
        vscode.window.showInformationMessage(`Welcome to AutoReadme${userInfo?.name ? `, ${userInfo.name}` : ''}!`);
    }

    /**
     * For development: Set a dev token
     */
    async setDevToken(): Promise<void> {
        await this.context.globalState.update(AUTH_STATE_KEY, 'dev-token');
        await this.context.globalState.update(USER_STATE_KEY, {
            id: 'dev-user',
            email: 'dev@autoreadme.local',
            name: 'Developer'
        });
        this._onAuthStateChanged.fire(true);
        vscode.window.showInformationMessage('Dev mode activated!');
    }

    /**
     * Logout and clear stored credentials
     */
    async logout(): Promise<void> {
        await this.context.globalState.update(AUTH_STATE_KEY, undefined);
        await this.context.globalState.update(USER_STATE_KEY, undefined);
        this._onAuthStateChanged.fire(false);
        vscode.window.showInformationMessage('Logged out of AutoReadme');
    }

    dispose(): void {
        this._onAuthStateChanged.dispose();
    }
}
