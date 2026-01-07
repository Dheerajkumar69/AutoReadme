import * as vscode from 'vscode';
import * as path from 'path';
import { ApiClient } from './apiClient';

const WORKSPACE_OPTED_IN_KEY = 'autoreadme.workspaceOptedIn';
const WORKSPACE_SETTINGS_KEY = 'autoreadme.workspaceSettings';

interface WorkspaceSettings {
    documentationEnabled: boolean;
    readmePath: string;
    createdAt: string;
}

/**
 * Manages workspace-level documentation settings and README generation
 */
export class WorkspaceManager {
    private context: vscode.ExtensionContext;
    private apiClient: ApiClient;
    private _onWorkspaceActivated = new vscode.EventEmitter<boolean>();
    public readonly onWorkspaceActivated = this._onWorkspaceActivated.event;

    constructor(context: vscode.ExtensionContext, apiClient: ApiClient) {
        this.context = context;
        this.apiClient = apiClient;
    }

    /**
     * Get the current workspace folder
     */
    private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.workspaceFolders?.[0];
    }

    /**
     * Get unique key for current workspace
     */
    private getWorkspaceKey(): string | undefined {
        const folder = this.getWorkspaceFolder();
        return folder?.uri.toString();
    }

    /**
     * Check if current workspace has opted in for documentation
     */
    isWorkspaceOptedIn(): boolean {
        const key = this.getWorkspaceKey();
        if (!key) return false;

        const optedIn = this.context.globalState.get<Record<string, boolean>>(WORKSPACE_OPTED_IN_KEY) || {};
        return optedIn[key] === true;
    }

    /**
     * Get workspace settings
     */
    getSettings(): WorkspaceSettings | undefined {
        const key = this.getWorkspaceKey();
        if (!key) return undefined;

        const settings = this.context.globalState.get<Record<string, WorkspaceSettings>>(WORKSPACE_SETTINGS_KEY) || {};
        return settings[key];
    }

    /**
     * Prompt user to enable documentation for this workspace (one-time)
     */
    async promptForDocumentation(): Promise<boolean> {
        const key = this.getWorkspaceKey();
        if (!key) return false;

        // Check if already prompted
        if (this.isWorkspaceOptedIn()) {
            return true;
        }

        const folder = this.getWorkspaceFolder();
        const folderName = folder?.name || 'this project';

        const response = await vscode.window.showInformationMessage(
            `📝 Would you like AutoReadme to document "${folderName}"?\n\nThis will create a README.md and add helpful comments to your code.`,
            { modal: false },
            'Yes, Document It',
            'No Thanks'
        );

        if (response === 'Yes, Document It') {
            await this.enableDocumentation();
            return true;
        } else {
            // Store that user declined (so we don't ask again)
            await this.setOptedIn(false);
            return false;
        }
    }

    /**
     * Enable documentation for current workspace
     */
    async enableDocumentation(): Promise<void> {
        const key = this.getWorkspaceKey();
        if (!key) return;

        await this.setOptedIn(true);

        // Create README.md
        await this.generateInitialReadme();

        // Store settings
        const settings = this.context.globalState.get<Record<string, WorkspaceSettings>>(WORKSPACE_SETTINGS_KEY) || {};
        settings[key] = {
            documentationEnabled: true,
            readmePath: 'README.md',
            createdAt: new Date().toISOString()
        };
        await this.context.globalState.update(WORKSPACE_SETTINGS_KEY, settings);

        this._onWorkspaceActivated.fire(true);
        vscode.window.showInformationMessage('✅ AutoReadme is now active! Your code will be documented automatically.');
    }

    /**
     * Set opted-in status for current workspace
     */
    private async setOptedIn(value: boolean): Promise<void> {
        const key = this.getWorkspaceKey();
        if (!key) return;

        const optedIn = this.context.globalState.get<Record<string, boolean>>(WORKSPACE_OPTED_IN_KEY) || {};
        optedIn[key] = value;
        await this.context.globalState.update(WORKSPACE_OPTED_IN_KEY, optedIn);
    }

    /**
     * Generate initial README.md for the workspace
     */
    async generateInitialReadme(): Promise<void> {
        const folder = this.getWorkspaceFolder();
        if (!folder) return;

        const readmePath = vscode.Uri.joinPath(folder.uri, 'README.md');

        // Check if README already exists
        try {
            await vscode.workspace.fs.stat(readmePath);
            // README exists, don't overwrite
            vscode.window.showInformationMessage('README.md already exists. AutoReadme will update it as you code.');
            return;
        } catch {
            // README doesn't exist, create it
        }

        // Analyze workspace structure
        const structure = await this.analyzeWorkspaceStructure(folder.uri);

        // Generate README content
        const readmeContent = this.generateReadmeTemplate(folder.name, structure);

        // Write README
        await vscode.workspace.fs.writeFile(
            readmePath,
            Buffer.from(readmeContent, 'utf-8')
        );

        // Open the README
        const doc = await vscode.workspace.openTextDocument(readmePath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    /**
     * Analyze workspace structure
     */
    private async analyzeWorkspaceStructure(folderUri: vscode.Uri): Promise<string[]> {
        const structure: string[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);

            for (const [name, type] of entries) {
                if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
                    continue;
                }

                if (type === vscode.FileType.Directory) {
                    structure.push(`📁 ${name}/`);
                } else if (type === vscode.FileType.File) {
                    structure.push(`📄 ${name}`);
                }
            }
        } catch (error) {
            console.error('Error analyzing workspace:', error);
        }

        return structure.slice(0, 15); // Limit to first 15 items
    }

    /**
     * Generate README template
     */
    private generateReadmeTemplate(projectName: string, structure: string[]): string {
        return `# ${projectName}

> 📝 This README is maintained by [AutoReadme](https://github.com/autoreadme)

## Overview

<!-- AutoReadme will fill this section as you develop -->

*Start coding and this section will be updated automatically with a description of your project.*

## Project Structure

\`\`\`
${structure.join('\n')}
\`\`\`

## Getting Started

<!-- AutoReadme will add setup instructions based on your code -->

## Features

<!-- Features will be documented as you implement them -->

## API / Functions

<!-- Public functions and APIs will be documented here -->

---

*Last updated: ${new Date().toLocaleDateString()}*
`;
    }

    /**
     * Update README with new content
     */
    async updateReadme(section: string, content: string): Promise<void> {
        const folder = this.getWorkspaceFolder();
        if (!folder) return;

        const readmePath = vscode.Uri.joinPath(folder.uri, 'README.md');

        try {
            const existingContent = await vscode.workspace.fs.readFile(readmePath);
            let readme = Buffer.from(existingContent).toString('utf-8');

            // Simple section update logic
            const sectionHeader = `## ${section}`;
            const sectionIndex = readme.indexOf(sectionHeader);

            if (sectionIndex !== -1) {
                // Find next section
                const nextSectionMatch = readme.substring(sectionIndex + sectionHeader.length).match(/\n## /);
                const endIndex = nextSectionMatch
                    ? sectionIndex + sectionHeader.length + (nextSectionMatch.index || 0)
                    : readme.length;

                // Replace section content
                readme = readme.substring(0, sectionIndex + sectionHeader.length + 1) +
                    '\n' + content + '\n\n' +
                    readme.substring(endIndex);

                await vscode.workspace.fs.writeFile(readmePath, Buffer.from(readme, 'utf-8'));
            }
        } catch (error) {
            console.error('Error updating README:', error);
        }
    }

    dispose(): void {
        this._onWorkspaceActivated.dispose();
    }
}
