import * as vscode from 'vscode';
import { CommentSuggestion } from './types';

/**
 * Preview panel for showing generated comments
 */
export class PreviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    /**
     * Show the preview panel with suggestions
     */
    show(
        suggestions: CommentSuggestion[],
        onAccept: (accepted: CommentSuggestion[]) => void
    ): void {
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'autoreadmePreview',
                'AutoReadme - Preview',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.webview.html = this.getHtml(suggestions);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'accept':
                        onAccept(message.suggestions);
                        this.panel?.dispose();
                        break;
                    case 'reject':
                        this.panel?.dispose();
                        break;
                    case 'acceptSingle':
                        const suggestion = suggestions.find(s => s.id === message.id);
                        if (suggestion) {
                            onAccept([suggestion]);
                        }
                        break;
                }
            }
        );
    }

    private getHtml(suggestions: CommentSuggestion[]): string {
        const suggestionsJson = JSON.stringify(suggestions);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoReadme Preview</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 16px;
            line-height: 1.5;
        }
        h2 {
            margin-bottom: 16px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .suggestion {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .line-number {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .confidence {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .comment-preview {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            white-space: pre-wrap;
            margin-bottom: 12px;
        }
        .actions {
            display: flex;
            gap: 8px;
        }
        button {
            padding: 6px 14px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: opacity 0.2s;
        }
        button:hover {
            opacity: 0.85;
        }
        .btn-accept {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-reject {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .global-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-widget-border);
        }
        .empty {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h2>💡 Comment Suggestions</h2>
    
    <div id="suggestions"></div>
    
    <div class="global-actions">
        <button class="btn-accept" onclick="acceptAll()">✓ Accept All</button>
        <button class="btn-reject" onclick="rejectAll()">✗ Reject All</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const suggestions = ${suggestionsJson};
        
        function renderSuggestions() {
            const container = document.getElementById('suggestions');
            
            if (suggestions.length === 0) {
                container.innerHTML = '<div class="empty">No suggestions available</div>';
                return;
            }
            
            container.innerHTML = suggestions.map(s => \`
                <div class="suggestion" data-id="\${s.id}">
                    <div class="suggestion-header">
                        <span class="line-number">Line \${s.lineNumber}</span>
                        <span class="confidence">\${Math.round(s.confidence * 100)}% confident</span>
                    </div>
                    <div class="comment-preview">\${escapeHtml(s.comment)}</div>
                    <div class="actions">
                        <button class="btn-accept" onclick="acceptSingle('\${s.id}')">Accept</button>
                        <button class="btn-reject" onclick="removeSuggestion('\${s.id}')">Skip</button>
                    </div>
                </div>
            \`).join('');
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function acceptSingle(id) {
            vscode.postMessage({ command: 'acceptSingle', id });
        }
        
        function removeSuggestion(id) {
            const el = document.querySelector(\`[data-id="\${id}"]\`);
            if (el) el.remove();
        }
        
        function acceptAll() {
            vscode.postMessage({ command: 'accept', suggestions });
        }
        
        function rejectAll() {
            vscode.postMessage({ command: 'reject' });
        }
        
        renderSuggestions();
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.panel?.dispose();
    }
}
