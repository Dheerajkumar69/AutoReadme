import * as vscode from 'vscode';
import * as path from 'path';
import { UsageService } from './usageService';
import { ApiClient } from './apiClient';
import { CodebaseScanner } from './codebaseScanner';

let usageService: UsageService;
let apiClient: ApiClient;
let codebaseScanner: CodebaseScanner;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('AutoDocs');
    outputChannel.appendLine('[AutoDocs] ✨ Activating...');

    // Initialize services
    const config = vscode.workspace.getConfiguration('autoreadme');
    const apiEndpoint = config.get('apiEndpoint') as string || 'https://autoreadme-api.vercel.app';

    usageService = new UsageService(context);
    apiClient = new ApiClient(apiEndpoint);
    codebaseScanner = new CodebaseScanner(outputChannel);

    // Set device ID for API calls
    const deviceId = usageService.getDeviceId();
    apiClient.setAuthToken(deviceId);
    outputChannel.appendLine(`[AutoDocs] Device ID: ${deviceId.substring(0, 20)}...`);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // ============================================
    // COMMAND: Scan and Document Codebase
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autodocs.scanCodebase', async () => {
            await scanAndDocumentCodebase();
        })
    );

    // ============================================
    // COMMAND: Document Current File
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autodocs.documentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No file open');
                return;
            }
            await documentSingleFile(editor.document);
        })
    );

    // ============================================
    // COMMAND: Generate README
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autodocs.generateReadme', async () => {
            await generateReadme();
        })
    );

    // ============================================
    // COMMAND: Show Usage Stats
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autodocs.showUsage', () => {
            const stats = usageService.getUsageStats();
            vscode.window.showInformationMessage(
                `📊 AutoDocs: ${stats.used}/${stats.limit} used today | ${stats.total} total`
            );
        })
    );

    // ============================================
    // COMMAND: Show Logs
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('autodocs.showLogs', () => {
            outputChannel.show();
        })
    );

    outputChannel.appendLine('[AutoDocs] ✅ Ready! Use "AutoDocs: Scan & Document Codebase" to start.');

    // Show welcome message
    vscode.window.showInformationMessage(
        '✨ AutoDocs Ready! Use Command Palette (Ctrl+Shift+P) → "AutoDocs: Scan & Document Codebase" to document your project.',
        'Scan Now'
    ).then(choice => {
        if (choice === 'Scan Now') {
            vscode.commands.executeCommand('autodocs.scanCodebase');
        }
    });
}

/**
 * Scan entire codebase and add documentation
 * Flow: 1) Scan → 2) Create/Check README → 3) Add comments → 4) Update README
 */
async function scanAndDocumentCodebase(): Promise<void> {
    outputChannel.appendLine('\n[AutoDocs] === STARTING DOCUMENTATION ===');

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AutoDocs',
        cancellable: true
    }, async (progress, token) => {
        try {
            // ============================================
            // STEP 1: Scan codebase
            // ============================================
            progress.report({ message: '🔍 Scanning codebase...', increment: 10 });
            outputChannel.appendLine('[AutoDocs] Step 1: Scanning codebase...');

            const allFiles = await codebaseScanner.scanWorkspace();
            outputChannel.appendLine(`[AutoDocs] Found ${allFiles.length} code files`);

            if (allFiles.length === 0) {
                vscode.window.showInformationMessage('No code files found in workspace.');
                return;
            }

            if (token.isCancellationRequested) return;

            // ============================================
            // STEP 2: Check/Create README
            // ============================================
            progress.report({ message: '📖 Checking README...', increment: 10 });
            outputChannel.appendLine('[AutoDocs] Step 2: Checking README...');

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const readmePath = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
            let readmeExists = false;
            let existingReadme = '';

            try {
                const existingBytes = await vscode.workspace.fs.readFile(readmePath);
                existingReadme = Buffer.from(existingBytes).toString('utf8');
                readmeExists = true;
                outputChannel.appendLine('[AutoDocs] README exists, will update');
            } catch {
                // Create initial README
                const projectName = workspaceFolder.name;
                const initialReadme = `# ${projectName}\n\n> Auto-documented by AutoDocs ✨\n\n`;
                await vscode.workspace.fs.writeFile(readmePath, Buffer.from(initialReadme, 'utf8'));
                existingReadme = initialReadme;
                outputChannel.appendLine('[AutoDocs] Created new README.md');
                vscode.window.showInformationMessage('📖 Created README.md');
            }

            if (token.isCancellationRequested) return;

            // ============================================
            // STEP 3: Find and add comments to undocumented code
            // ============================================
            progress.report({ message: '🔎 Finding undocumented code...', increment: 10 });
            outputChannel.appendLine('[AutoDocs] Step 3: Finding undocumented code...');

            const filesNeedingDocs = codebaseScanner.getFilesNeedingDocs(allFiles);
            const totalUndocumented = filesNeedingDocs.reduce((sum, f) => {
                return sum + f.functions.filter(fn => !fn.hasDocComment).length +
                    f.classes.filter(c => !c.hasDocComment).length;
            }, 0);

            outputChannel.appendLine(`[AutoDocs] ${totalUndocumented} items need documentation`);

            if (totalUndocumented > 0) {
                const choice = await vscode.window.showInformationMessage(
                    `Found ${totalUndocumented} undocumented items in ${filesNeedingDocs.length} files. Add comments?`,
                    'Add Comments',
                    'Skip Comments'
                );

                if (choice === 'Add Comments') {
                    let documented = 0;
                    for (let i = 0; i < filesNeedingDocs.length; i++) {
                        if (token.isCancellationRequested) break;

                        const file = filesNeedingDocs[i];
                        progress.report({
                            message: `💬 Documenting ${path.basename(file.relativePath)}...`,
                            increment: (40 / filesNeedingDocs.length)
                        });

                        const count = await documentFileItems(file);
                        documented += count;
                        outputChannel.appendLine(`[AutoDocs] Added ${count} comments to ${file.relativePath}`);
                    }

                    outputChannel.appendLine(`[AutoDocs] Total: ${documented} comments added`);
                    await usageService.incrementUsage();
                }
            } else {
                outputChannel.appendLine('[AutoDocs] All code is already documented!');
            }

            if (token.isCancellationRequested) return;

            // ============================================
            // STEP 4: Update README with project structure
            // ============================================
            progress.report({ message: '📝 Updating README...', increment: 20 });
            outputChannel.appendLine('[AutoDocs] Step 4: Updating README...');

            // Re-scan to get updated info (after comments added)
            const updatedFiles = await codebaseScanner.scanWorkspace();
            const summary = codebaseScanner.generateReadmeSummary(updatedFiles);

            let newReadmeContent = '';
            if (existingReadme.includes('## Project Structure')) {
                // Replace existing section
                const before = existingReadme.split('## Project Structure')[0];
                newReadmeContent = before.trimEnd() + '\n\n' + summary;
            } else {
                // Append to existing
                newReadmeContent = existingReadme.trimEnd() + '\n\n' + summary;
            }

            await vscode.workspace.fs.writeFile(readmePath, Buffer.from(newReadmeContent, 'utf8'));
            outputChannel.appendLine(`[AutoDocs] README updated (${newReadmeContent.length} chars)`);

            // ============================================
            // DONE!
            // ============================================
            progress.report({ message: '✅ Done!', increment: 10 });
            updateStatusBar();

            vscode.window.showInformationMessage(
                `✅ AutoDocs complete! ${totalUndocumented > 0 ? 'Comments added & ' : ''}README updated.`,
                'Open README'
            ).then(choice => {
                if (choice === 'Open README') {
                    vscode.workspace.openTextDocument(readmePath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });

            outputChannel.appendLine('[AutoDocs] === DONE ===\n');

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`[AutoDocs] ❌ ERROR: ${errorMsg}`);
            vscode.window.showErrorMessage(`AutoDocs error: ${errorMsg}`);
        }
    });
}

/**
 * Document a single file
 */
async function documentSingleFile(document: vscode.TextDocument): Promise<void> {
    outputChannel.appendLine(`\n[AutoDocs] Documenting: ${document.fileName}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
        vscode.window.showWarningMessage('Please open the file you want to document');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AutoDocs: Documenting file...',
        cancellable: false
    }, async (progress) => {
        const content = document.getText();
        const lines = content.split('\n');

        // Find undocumented functions
        const scanner = new CodebaseScanner(outputChannel);
        // Use the scanner's logic to find functions
        const functions = findFunctionsInDocument(lines, document.languageId);
        const undocumented = functions.filter(f => !f.hasDocComment);

        if (undocumented.length === 0) {
            vscode.window.showInformationMessage('🎉 All functions in this file are documented!');
            return;
        }

        progress.report({ message: `Adding ${undocumented.length} comments...` });

        // Generate and insert comments
        let insertedCount = 0;
        for (const func of undocumented.reverse()) { // Reverse to insert from bottom up
            const comment = await generateCommentForFunction(func, document.languageId);
            if (comment) {
                await insertCommentAtLine(editor, func.lineNumber - 1, comment);
                insertedCount++;
            }
        }

        usageService.incrementUsage();
        updateStatusBar();
        vscode.window.showInformationMessage(`✅ Added ${insertedCount} comments!`);
    });
}

/**
 * Document items in a file
 */
async function documentFileItems(file: { uri: vscode.Uri; functions: any[]; classes: any[]; language: string }): Promise<number> {
    const document = await vscode.workspace.openTextDocument(file.uri);
    const editor = await vscode.window.showTextDocument(document, { preview: true, preserveFocus: true });

    const undocFuncs = file.functions.filter((f: any) => !f.hasDocComment);
    const undocClasses = file.classes.filter((c: any) => !c.hasDocComment);

    let count = 0;

    // Insert comments from bottom to top to preserve line numbers
    const allItems = [...undocFuncs, ...undocClasses].sort((a, b) => b.lineNumber - a.lineNumber);

    for (const item of allItems) {
        const comment = await generateCommentForFunction(item, file.language);
        if (comment) {
            await insertCommentAtLine(editor, item.lineNumber - 1, comment);
            count++;
        }
    }

    await document.save();
    return count;
}

/**
 * Generate a comment for a function/class
 */
async function generateCommentForFunction(func: { name: string; signature: string }, languageId: string): Promise<string | null> {
    try {
        // Call API to generate comment
        const response = await apiClient.generateComments({
            filePath: '',
            language: languageId,
            diffChunks: [{
                startLine: 1,
                endLine: 1,
                changes: [{ lineNumber: 1, content: func.signature, type: 'added' as const }],
                contextBefore: [],
                contextAfter: []
            }],
            fullFileContent: func.signature,
            commentStyle: 'explanatory'
        });

        if (response.success && response.suggestions && response.suggestions.length > 0) {
            return response.suggestions[0].comment;
        }

        // Fallback: Generate a simple comment locally
        return generateLocalComment(func.name, languageId);
    } catch (error) {
        outputChannel.appendLine(`[AutoDocs] API error, using local comment: ${error}`);
        return generateLocalComment(func.name, languageId);
    }
}

/**
 * Generate a simple local comment (fallback)
 */
function generateLocalComment(name: string, languageId: string): string {
    const words = name.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim().toLowerCase();
    const description = `Handles ${words}`;

    if (languageId === 'python') {
        return `"""${description}."""`;
    }

    return `/**\n * ${description}\n */`;
}

/**
 * Insert a comment at a specific line
 */
async function insertCommentAtLine(editor: vscode.TextEditor, lineNumber: number, comment: string): Promise<void> {
    const line = editor.document.lineAt(Math.max(0, lineNumber));
    const indent = line.text.match(/^(\s*)/)?.[1] || '';

    // Add proper indentation to comment
    const indentedComment = comment.split('\n').map(l => indent + l).join('\n') + '\n';

    await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(lineNumber, 0), indentedComment);
    });
}

/**
 * Find functions in a document
 */
function findFunctionsInDocument(lines: string[], languageId: string): Array<{ name: string; lineNumber: number; hasDocComment: boolean; signature: string }> {
    const functions: Array<{ name: string; lineNumber: number; hasDocComment: boolean; signature: string }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
        }

        let match: RegExpMatchArray | null = null;
        let name = '';

        // TypeScript/JavaScript patterns
        if (['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(languageId)) {
            match = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
            if (!match) {
                match = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
            }
            if (!match) {
                match = trimmed.match(/^(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/);
                if (match && ['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(match[1])) {
                    match = null;
                }
            }
        }

        // Python patterns
        if (languageId === 'python') {
            match = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
        }

        if (match) {
            name = match[1];
            const hasDocComment = hasDocCommentAbove(lines, i, languageId);
            functions.push({
                name,
                lineNumber: i + 1,
                hasDocComment,
                signature: trimmed.substring(0, 100)
            });
        }
    }

    return functions;
}

/**
 * Check for doc comment above a line
 */
function hasDocCommentAbove(lines: string[], lineIndex: number, languageId: string): boolean {
    if (lineIndex === 0) return false;

    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 5); i--) {
        const line = lines[i].trim();
        if (line === '') continue;
        if (line.startsWith('*/') || line.startsWith('*') || line.startsWith('/**')) return true;
        if (languageId === 'python' && (line.startsWith('"""') || line.startsWith("'''"))) return true;
        if (line.startsWith('//') && line.length > 10) return true;
        break;
    }
    return false;
}

/**
 * Generate README for the project
 */
async function generateReadme(): Promise<void> {
    outputChannel.appendLine('\n[AutoDocs] === GENERATING README ===');

    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            outputChannel.appendLine('[AutoDocs] ❌ No workspace folder open');
            vscode.window.showWarningMessage('No folder open. Open a project folder first.');
            return;
        }

        outputChannel.appendLine(`[AutoDocs] Workspace: ${workspaceFolder.uri.fsPath}`);

        // Scan all files
        outputChannel.appendLine('[AutoDocs] Scanning files...');
        const allFiles = await codebaseScanner.scanWorkspace();
        outputChannel.appendLine(`[AutoDocs] Found ${allFiles.length} code files`);

        if (allFiles.length === 0) {
            vscode.window.showInformationMessage('No code files found in workspace.');
            return;
        }

        // Generate summary
        const summary = codebaseScanner.generateReadmeSummary(allFiles);
        outputChannel.appendLine(`[AutoDocs] Generated summary (${summary.length} chars)`);

        const readmePath = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
        outputChannel.appendLine(`[AutoDocs] README path: ${readmePath.fsPath}`);

        let existingContent = '';
        try {
            const existingBytes = await vscode.workspace.fs.readFile(readmePath);
            existingContent = Buffer.from(existingBytes).toString('utf8');
            outputChannel.appendLine(`[AutoDocs] Existing README: ${existingContent.length} chars`);
        } catch {
            outputChannel.appendLine('[AutoDocs] README does not exist, will create new');
        }

        // Create or update README
        const projectName = workspaceFolder.name;
        let newContent = '';

        if (existingContent) {
            if (existingContent.includes('## Project Structure')) {
                const before = existingContent.split('## Project Structure')[0];
                newContent = before + summary;
                outputChannel.appendLine('[AutoDocs] Updating existing README section');
            } else {
                newContent = existingContent + '\n\n' + summary;
                outputChannel.appendLine('[AutoDocs] Appending to existing README');
            }
        } else {
            newContent = `# ${projectName}\n\n> Auto-documented by AutoDocs ✨\n\n${summary}`;
            outputChannel.appendLine('[AutoDocs] Creating new README');
        }

        // Write file
        await vscode.workspace.fs.writeFile(readmePath, Buffer.from(newContent, 'utf8'));
        outputChannel.appendLine(`[AutoDocs] ✅ README written (${newContent.length} chars)`);

        // Show success
        vscode.window.showInformationMessage('📖 README.md updated!', 'Open README').then(choice => {
            if (choice === 'Open README') {
                vscode.workspace.openTextDocument(readmePath).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        });

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`[AutoDocs] ❌ README ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(`Failed to generate README: ${errorMsg}`);
    }
}

/**
 * Update status bar
 */
function updateStatusBar(): void {
    const stats = usageService.getUsageStats();
    statusBarItem.text = `💡 AutoDocs: ${stats.remaining}`;
    statusBarItem.tooltip = `${stats.used}/${stats.limit} today | Click to scan`;
    statusBarItem.command = 'autodocs.scanCodebase';
    statusBarItem.show();
}

export function deactivate() {
    outputChannel.appendLine('[AutoDocs] 👋 Deactivated');
}
