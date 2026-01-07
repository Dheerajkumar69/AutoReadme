import * as vscode from 'vscode';
import { DiffChunk, DiffLine } from './types';

interface TrackedDocument {
    uri: string;
    content: string;
    version: number;
}

interface DiffResult {
    isMeaningful: boolean;
    chunks: DiffChunk[];
}

/**
 * Tracks document changes and computes meaningful diffs
 */
export class DiffDetector {
    private trackedDocuments: Map<string, TrackedDocument> = new Map();
    private readonly minChangeLines: number = 1;

    /**
     * Start tracking a document's content
     */
    trackDocument(document: vscode.TextDocument): void {
        this.trackedDocuments.set(document.uri.toString(), {
            uri: document.uri.toString(),
            content: document.getText(),
            version: document.version
        });
    }

    /**
     * Get the diff between tracked content and current content
     */
    getDiff(document: vscode.TextDocument): DiffResult | null {
        const tracked = this.trackedDocuments.get(document.uri.toString());

        if (!tracked) {
            // First time seeing this document, start tracking
            this.trackDocument(document);
            return null;
        }

        const oldContent = tracked.content;
        const newContent = document.getText();

        if (oldContent === newContent) {
            return null;
        }

        const chunks = this.computeChunks(oldContent, newContent);
        const isMeaningful = this.isMeaningfulChange(chunks);

        // Update tracked content
        this.trackDocument(document);

        return { isMeaningful, chunks };
    }

    /**
     * Compute diff chunks between old and new content
     */
    private computeChunks(oldContent: string, newContent: string): DiffChunk[] {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const chunks: DiffChunk[] = [];

        // Simple line-by-line diff algorithm
        let currentChunk: DiffChunk | null = null;
        let i = 0, j = 0;

        while (i < oldLines.length || j < newLines.length) {
            const oldLine = oldLines[i];
            const newLine = newLines[j];

            if (oldLine === newLine) {
                // Lines match - finalize current chunk if exists
                if (currentChunk) {
                    currentChunk.contextAfter = newLines.slice(j, Math.min(j + 3, newLines.length));
                    chunks.push(currentChunk);
                    currentChunk = null;
                }
                i++;
                j++;
            } else {
                // Lines differ - start or extend chunk
                if (!currentChunk) {
                    currentChunk = {
                        startLine: j + 1,
                        endLine: j + 1,
                        changes: [],
                        contextBefore: newLines.slice(Math.max(0, j - 3), j),
                        contextAfter: []
                    };
                }

                // Determine if line was added, removed, or changed
                if (i < oldLines.length && j < newLines.length) {
                    // Modified line
                    currentChunk.changes.push({
                        lineNumber: j + 1,
                        content: newLine,
                        type: 'added'
                    });
                    currentChunk.changes.push({
                        lineNumber: i + 1,
                        content: oldLine,
                        type: 'removed'
                    });
                    i++;
                    j++;
                } else if (j < newLines.length) {
                    // Added line
                    currentChunk.changes.push({
                        lineNumber: j + 1,
                        content: newLine,
                        type: 'added'
                    });
                    j++;
                } else {
                    // Removed line
                    currentChunk.changes.push({
                        lineNumber: i + 1,
                        content: oldLine,
                        type: 'removed'
                    });
                    i++;
                }

                currentChunk.endLine = Math.max(i, j);
            }
        }

        // Finalize last chunk
        if (currentChunk) {
            currentChunk.contextAfter = [];
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Determine if the changes are meaningful (worth commenting)
     */
    private isMeaningfulChange(chunks: DiffChunk[]): boolean {
        if (chunks.length === 0) return false;

        const totalChanges = chunks.reduce((sum, chunk) => sum + chunk.changes.length, 0);

        // Too few changes
        if (totalChanges < this.minChangeLines) return false;

        // Check for trivial changes
        for (const chunk of chunks) {
            for (const change of chunk.changes) {
                // Skip whitespace-only changes
                if (change.content.trim() === '') continue;

                // Skip import-only changes
                if (change.content.trim().startsWith('import ')) continue;

                // Skip comment-only changes
                if (change.content.trim().startsWith('//') ||
                    change.content.trim().startsWith('/*') ||
                    change.content.trim().startsWith('*')) continue;

                // Found a meaningful change
                return true;
            }
        }

        return false;
    }

    /**
     * Clear tracking for a document
     */
    untrackDocument(uri: string): void {
        this.trackedDocuments.delete(uri);
    }

    /**
     * Clear all tracking
     */
    clearAll(): void {
        this.trackedDocuments.clear();
    }
}
