import * as vscode from 'vscode';
import { DiffChunk } from './types';

/**
 * Provides inline decorations for changed code lines
 */
export class DecorationProvider {
    private readonly lightbulbDecoration: vscode.TextEditorDecorationType;
    private activeDecorations: Map<string, vscode.Range[]> = new Map();

    constructor() {
        this.lightbulbDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.getLightbulbIconPath(),
            gutterIconSize: 'contain',
            after: {
                contentText: ' 💡 Explain?',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            }
        });
    }

    private getLightbulbIconPath(): string {
        // Use a simple emoji as fallback
        return '';
    }

    /**
     * Show prompts on changed lines
     */
    showPrompt(document: vscode.TextDocument, chunks: DiffChunk[]): void {
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === document.uri.toString()
        );

        if (!editor) return;

        const ranges: vscode.Range[] = [];

        for (const chunk of chunks) {
            // Decorate the first line of each chunk
            const line = Math.max(0, chunk.startLine - 1);
            const range = new vscode.Range(line, 0, line, 0);
            ranges.push(range);
        }

        editor.setDecorations(this.lightbulbDecoration, ranges);
        this.activeDecorations.set(document.uri.toString(), ranges);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hidePrompts(document.uri.toString());
        }, 10000);
    }

    /**
     * Hide prompts for a document
     */
    hidePrompts(uri: string): void {
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === uri
        );

        if (editor) {
            editor.setDecorations(this.lightbulbDecoration, []);
        }

        this.activeDecorations.delete(uri);
    }

    /**
     * Dispose of decorations
     */
    dispose(): void {
        this.lightbulbDecoration.dispose();
        this.activeDecorations.clear();
    }
}
