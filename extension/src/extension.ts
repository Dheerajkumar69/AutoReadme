import * as vscode from 'vscode';
import { AuthService } from './authService';
import { WorkspaceManager } from './workspaceManager';
import { DiffDetector } from './diffDetector';
import { ApiClient } from './apiClient';
import { CommentInserter } from './commentInserter';

let authService: AuthService;
let workspaceManager: WorkspaceManager;
let diffDetector: DiffDetector;
let apiClient: ApiClient;
let commentInserter: CommentInserter;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('AutoReadme is activating...');

    // Initialize services
    const config = vscode.workspace.getConfiguration('autoreadme');
    apiClient = new ApiClient(config.get('apiEndpoint') as string || 'http://localhost:3001');
    authService = new AuthService(context);
    workspaceManager = new WorkspaceManager(context, apiClient);
    diffDetector = new DiffDetector();
    commentInserter = new CommentInserter();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // ============================================
    // COMMAND: Login
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autoreadme.login', async () => {
            if (authService.isLoggedIn()) {
                vscode.window.showInformationMessage('Already logged in!');
                return;
            }
            await authService.login();
        })
    );

    // ============================================
    // COMMAND: Dev Login (for testing)
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autoreadme.devLogin', async () => {
            await authService.setDevToken();
            updateStatusBar();
            // Prompt for documentation after login
            await checkAndPromptForDocumentation();
        })
    );

    // ============================================
    // COMMAND: Logout
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autoreadme.logout', async () => {
            await authService.logout();
            updateStatusBar();
        })
    );

    // ============================================
    // COMMAND: Enable Documentation (manual trigger)
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autoreadme.enableDocumentation', async () => {
            if (!authService.isLoggedIn()) {
                const login = await vscode.window.showWarningMessage(
                    'Please login first to use AutoReadme',
                    'Login'
                );
                if (login === 'Login') {
                    await authService.setDevToken(); // Use dev login for now
                }
                return;
            }
            await workspaceManager.enableDocumentation();
        })
    );

    // ============================================
    // AUTH STATE CHANGE HANDLER
    // ============================================
    authService.onAuthStateChanged(async (loggedIn) => {
        updateStatusBar();
        if (loggedIn) {
            // Set API client auth token
            const token = authService.getToken();
            if (token) {
                apiClient.setAuthToken(token);
            }
            // Prompt for documentation
            await checkAndPromptForDocumentation();
        }
    });

    // ============================================
    // WORKSPACE FOLDER CHANGE HANDLER
    // ============================================
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            if (authService.isLoggedIn()) {
                await checkAndPromptForDocumentation();
            }
        })
    );

    // ============================================
    // FILE SAVE HANDLER - Auto-comment on save
    // ============================================
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            // Only process if workspace is opted in
            if (!workspaceManager.isWorkspaceOptedIn()) {
                return;
            }

            // Only process supported languages
            if (!isSupportedLanguage(document.languageId)) {
                return;
            }

            // Get diff
            const diff = diffDetector.getDiff(document);
            if (!diff || !diff.isMeaningful) {
                return;
            }

            // Generate and insert comments automatically
            await generateAndInsertComments(document, diff);
        })
    );

    // ============================================
    // FILE OPEN HANDLER - Track content
    // ============================================
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (isSupportedLanguage(document.languageId)) {
                diffDetector.trackDocument(document);
            }
        })
    );

    // Track already open documents
    vscode.workspace.textDocuments.forEach((document) => {
        if (isSupportedLanguage(document.languageId)) {
            diffDetector.trackDocument(document);
        }
    });

    // ============================================
    // STARTUP: Check login and prompt
    // ============================================
    if (authService.isLoggedIn()) {
        apiClient.setAuthToken(authService.getToken()!);
        checkAndPromptForDocumentation();
    }

    console.log('AutoReadme is now active!');
}

/**
 * Check if logged in and prompt for documentation if needed
 */
async function checkAndPromptForDocumentation(): Promise<void> {
    if (!authService.isLoggedIn()) {
        return;
    }

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        if (!workspaceManager.isWorkspaceOptedIn()) {
            // Wait a moment before prompting
            setTimeout(async () => {
                await workspaceManager.promptForDocumentation();
            }, 1500);
        }
    }
}

/**
 * Generate comments and insert them automatically (no preview UI)
 */
async function generateAndInsertComments(
    document: vscode.TextDocument,
    diff: { isMeaningful: boolean; chunks: any[] }
): Promise<void> {
    const editor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === document.uri.toString()
    );

    if (!editor) return;

    try {
        const response = await apiClient.generateComments({
            filePath: document.fileName,
            language: document.languageId,
            diffChunks: diff.chunks,
            fullFileContent: document.getText(),
            commentStyle: 'short' // Default to short comments for auto-insert
        });

        if (response.success && response.suggestions.length > 0) {
            // Insert comments silently (no popup)
            for (const suggestion of response.suggestions) {
                await commentInserter.insert(editor, suggestion);
            }

            // Update tracking after insertion
            diffDetector.trackDocument(document);

            // Show subtle notification
            vscode.window.setStatusBarMessage(`💡 Added ${response.suggestions.length} comment(s)`, 3000);
        }
    } catch (error) {
        // Silent fail - don't interrupt user
        console.error('Auto-comment error:', error);
    }
}

/**
 * Update status bar based on login state
 */
function updateStatusBar(): void {
    if (authService.isLoggedIn()) {
        const user = authService.getUserInfo();
        statusBarItem.text = `$(check) AutoReadme`;
        statusBarItem.tooltip = `Logged in${user?.email ? ` as ${user.email}` : ''}. Click to manage.`;
        statusBarItem.command = 'autoreadme.logout';
    } else {
        statusBarItem.text = `$(sign-in) AutoReadme: Login`;
        statusBarItem.tooltip = 'Click to login to AutoReadme';
        statusBarItem.command = 'autoreadme.devLogin'; // Use dev login for now
    }
    statusBarItem.show();
}

/**
 * Check if language is supported
 */
function isSupportedLanguage(languageId: string): boolean {
    const supported = [
        'typescript', 'typescriptreact',
        'javascript', 'javascriptreact',
        'python',
        'java',
        'csharp',
        'go',
        'rust',
        'cpp',
        'c'
    ];
    return supported.includes(languageId);
}

export function deactivate() {
    console.log('AutoReadme deactivated');
}
