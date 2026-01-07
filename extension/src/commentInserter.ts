import * as vscode from 'vscode';
import { CommentSuggestion } from './types';

/**
 * Service for inserting comments into documents
 */
export class CommentInserter {

    /**
     * Insert a comment at the appropriate location
     */
    async insert(editor: vscode.TextEditor, suggestion: CommentSuggestion): Promise<boolean> {
        const document = editor.document;
        const language = document.languageId;

        // Format comment for the language
        const formattedComment = this.formatComment(suggestion.comment, language);

        // Get insert position (line before the target line)
        const targetLine = Math.max(0, suggestion.lineNumber - 1);
        const line = document.lineAt(targetLine);
        const indentation = line.text.match(/^\s*/)?.[0] || '';

        // Build the insert text with proper indentation
        const insertText = formattedComment
            .split('\n')
            .map(l => indentation + l)
            .join('\n') + '\n';

        const insertPosition = new vscode.Position(targetLine, 0);

        // Apply edit
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, insertPosition, insertText);

        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            // Save the document
            await document.save();
        }

        return success;
    }

    /**
     * Format comment text based on language
     */
    private formatComment(comment: string, language: string): string {
        const lines = comment.split('\n');

        switch (language) {
            case 'typescript':
            case 'typescriptreact':
            case 'javascript':
            case 'javascriptreact':
                if (lines.length === 1) {
                    return `// ${comment}`;
                }
                return `/**\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;

            case 'python':
                if (lines.length === 1) {
                    return `# ${comment}`;
                }
                return `"""\n${comment}\n"""`;

            case 'css':
            case 'scss':
            case 'less':
                return `/* ${comment} */`;

            case 'html':
            case 'xml':
                return `<!-- ${comment} -->`;

            default:
                return `// ${comment}`;
        }
    }

    /**
     * Check if inserting at a position would create duplicate comments
     */
    async wouldCreateDuplicate(
        document: vscode.TextDocument,
        lineNumber: number,
        comment: string
    ): Promise<boolean> {
        const targetLine = Math.max(0, lineNumber - 1);

        // Check previous 3 lines for similar comments
        for (let i = Math.max(0, targetLine - 3); i < targetLine; i++) {
            const line = document.lineAt(i).text.trim();

            // Simple similarity check
            if (line.includes(comment.substring(0, 20))) {
                return true;
            }
        }

        return false;
    }
}
