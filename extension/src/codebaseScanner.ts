import * as vscode from 'vscode';
import * as path from 'path';

interface CodeFile {
    uri: vscode.Uri;
    relativePath: string;
    language: string;
    hasComments: boolean;
    functions: FunctionInfo[];
    classes: ClassInfo[];
}

interface FunctionInfo {
    name: string;
    lineNumber: number;
    hasDocComment: boolean;
    signature: string;
}

interface ClassInfo {
    name: string;
    lineNumber: number;
    hasDocComment: boolean;
    methods: FunctionInfo[];
}

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.cs'];

/**
 * Scans the entire codebase to find files needing documentation
 */
export class CodebaseScanner {
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Scan the entire workspace for code files
     */
    async scanWorkspace(): Promise<CodeFile[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.outputChannel.appendLine('[Scanner] No workspace folder open');
            return [];
        }

        const codeFiles: CodeFile[] = [];

        for (const folder of workspaceFolders) {
            this.outputChannel.appendLine(`[Scanner] Scanning: ${folder.uri.fsPath}`);
            const files = await this.findCodeFiles(folder.uri);

            for (const fileUri of files) {
                const codeFile = await this.analyzeFile(fileUri, folder.uri);
                if (codeFile) {
                    codeFiles.push(codeFile);
                }
            }
        }

        this.outputChannel.appendLine(`[Scanner] Found ${codeFiles.length} code files`);
        return codeFiles;
    }

    /**
     * Find all code files in a folder
     */
    private async findCodeFiles(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
        const pattern = new vscode.RelativePattern(folderUri, '**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,cs}');
        const excludePattern = '**/node_modules/**,**/dist/**,**/.git/**,**/build/**,**/__pycache__/**';

        const files = await vscode.workspace.findFiles(pattern, excludePattern, 500);
        return files;
    }

    /**
     * Analyze a single file for documentation status
     */
    private async analyzeFile(fileUri: vscode.Uri, workspaceUri: vscode.Uri): Promise<CodeFile | null> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            const lines = content.split('\n');
            const relativePath = path.relative(workspaceUri.fsPath, fileUri.fsPath);

            const functions = this.findFunctions(lines, document.languageId);
            const classes = this.findClasses(lines, document.languageId);

            const totalItems = functions.length + classes.length;
            const documentedItems = functions.filter(f => f.hasDocComment).length +
                classes.filter(c => c.hasDocComment).length;

            return {
                uri: fileUri,
                relativePath,
                language: document.languageId,
                hasComments: totalItems > 0 && documentedItems === totalItems,
                functions,
                classes
            };
        } catch (error) {
            this.outputChannel.appendLine(`[Scanner] Error analyzing ${fileUri.fsPath}: ${error}`);
            return null;
        }
    }

    /**
     * Find functions in code
     */
    private findFunctions(lines: string[], languageId: string): FunctionInfo[] {
        const functions: FunctionInfo[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                continue;
            }

            let match: RegExpMatchArray | null = null;
            let name = '';
            let signature = '';

            // TypeScript/JavaScript function patterns
            if (['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(languageId)) {
                // function name() or async function name()
                match = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
                if (match) {
                    name = match[1];
                    signature = trimmed;
                }

                // const name = () => or const name = function()
                if (!match) {
                    match = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|_)\s*=>/);
                    if (match) {
                        name = match[1];
                        signature = trimmed;
                    }
                }

                // Class method: name() { or async name() {
                if (!match) {
                    match = trimmed.match(/^(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/);
                    if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
                        name = match[1];
                        signature = trimmed;
                    }
                }
            }

            // Python function patterns
            if (languageId === 'python') {
                match = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
                if (match) {
                    name = match[1];
                    signature = trimmed;
                }
            }

            // Java/C#/Go patterns
            if (['java', 'csharp', 'go'].includes(languageId)) {
                match = trimmed.match(/^(?:public|private|protected|static|async|func)?\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?:\w+)?\s*{?/);
                if (match && match[1] && !['if', 'for', 'while', 'switch', 'class'].includes(match[1])) {
                    name = match[1];
                    signature = trimmed;
                }
            }

            if (name) {
                // Check if there's a doc comment above
                const hasDocComment = this.hasDocCommentAbove(lines, i, languageId);
                functions.push({
                    name,
                    lineNumber: i + 1,
                    hasDocComment,
                    signature: signature.substring(0, 100)
                });
            }
        }

        return functions;
    }

    /**
     * Find classes in code
     */
    private findClasses(lines: string[], languageId: string): ClassInfo[] {
        const classes: ClassInfo[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            let match: RegExpMatchArray | null = null;
            let name = '';

            // TypeScript/JavaScript/Java/C# class patterns
            match = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
            if (match) {
                name = match[1];
            }

            // Python class
            if (languageId === 'python' && !match) {
                match = trimmed.match(/^class\s+(\w+)/);
                if (match) {
                    name = match[1];
                }
            }

            if (name) {
                const hasDocComment = this.hasDocCommentAbove(lines, i, languageId);
                classes.push({
                    name,
                    lineNumber: i + 1,
                    hasDocComment,
                    methods: []
                });
            }
        }

        return classes;
    }

    /**
     * Check if there's a documentation comment above a line
     */
    private hasDocCommentAbove(lines: string[], lineIndex: number, languageId: string): boolean {
        if (lineIndex === 0) return false;

        // Look up to 5 lines above for doc comments
        for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 5); i--) {
            const line = lines[i].trim();

            if (line === '') continue;

            // JSDoc/TSDoc/JavaDoc style
            if (line.startsWith('*/') || line.startsWith('*') || line.startsWith('/**')) {
                return true;
            }

            // Python docstring
            if (languageId === 'python' && (line.startsWith('"""') || line.startsWith("'''"))) {
                return true;
            }

            // Single line comment (// or #)
            if (line.startsWith('//') || line.startsWith('#')) {
                // Only count if it looks like documentation
                if (line.length > 10) {
                    return true;
                }
                continue;
            }

            // If we hit actual code, no doc comment found
            break;
        }

        return false;
    }

    /**
     * Get files that need documentation
     */
    getFilesNeedingDocs(files: CodeFile[]): CodeFile[] {
        return files.filter(f => {
            const undocumentedFunctions = f.functions.filter(fn => !fn.hasDocComment);
            const undocumentedClasses = f.classes.filter(c => !c.hasDocComment);
            return undocumentedFunctions.length > 0 || undocumentedClasses.length > 0;
        });
    }

    /**
     * Get summary for README
     */
    generateReadmeSummary(files: CodeFile[]): string {
        const summary: string[] = [];
        summary.push('## Project Structure\n');

        // Group by directory
        const byDir = new Map<string, CodeFile[]>();
        for (const file of files) {
            const dir = path.dirname(file.relativePath) || '.';
            if (!byDir.has(dir)) byDir.set(dir, []);
            byDir.get(dir)!.push(file);
        }

        for (const [dir, dirFiles] of byDir) {
            summary.push(`### ${dir}/\n`);
            for (const file of dirFiles) {
                const funcs = file.functions.map(f => f.name).join(', ');
                const classes = file.classes.map(c => c.name).join(', ');
                let desc = '';
                if (classes) desc += `Classes: ${classes}. `;
                if (funcs) desc += `Functions: ${funcs}`;
                summary.push(`- **${path.basename(file.relativePath)}**: ${desc || 'No exports detected'}`);
            }
            summary.push('');
        }

        return summary.join('\n');
    }
}
