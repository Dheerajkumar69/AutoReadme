// ============================================
// AutoReadme - Shared Types
// ============================================

/**
 * Represents a single line change in a diff
 */
export interface DiffLine {
    lineNumber: number;
    content: string;
    type: 'added' | 'removed' | 'unchanged';
}

/**
 * Represents a chunk of changed code with context
 */
export interface DiffChunk {
    startLine: number;
    endLine: number;
    changes: DiffLine[];
    contextBefore: string[];
    contextAfter: string[];
}

/**
 * Payload sent to backend for comment generation
 */
export interface CommentRequest {
    filePath: string;
    language: string;
    diffChunks: DiffChunk[];
    fullFileContent: string;
    commentStyle: CommentStyle;
}

/**
 * Comment style options
 */
export type CommentStyle = 'short' | 'explanatory' | 'pr-review';

/**
 * A generated comment suggestion
 */
export interface CommentSuggestion {
    id: string;
    lineNumber: number;
    comment: string;
    style: CommentStyle;
    confidence: number; // 0-1, how confident the model is
    reasoning?: string; // Why this comment was generated
}

/**
 * Response from comment generation endpoint
 */
export interface CommentResponse {
    success: boolean;
    suggestions: CommentSuggestion[];
    shouldUpdateDocs: boolean;
    docUpdateReason?: string;
}

/**
 * Request to update documentation
 */
export interface DocUpdateRequest {
    filePath: string;
    diffChunks: DiffChunk[];
    existingDocs: string;
    docFilePath: string;
}

/**
 * Documentation update suggestion
 */
export interface DocUpdateSuggestion {
    section: string;
    originalContent: string;
    suggestedContent: string;
    reason: string;
}

/**
 * Response from doc update endpoint
 */
export interface DocUpdateResponse {
    success: boolean;
    suggestions: DocUpdateSuggestion[];
}

/**
 * User preferences stored in Firebase
 */
export interface UserPreferences {
    userId: string;
    defaultCommentStyle: CommentStyle;
    autoPrompt: boolean;
    minChangeLines: number;
    excludedPatterns: string[]; // File patterns to ignore
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Generation history record
 */
export interface GenerationHistory {
    id: string;
    userId: string;
    filePath: string;
    timestamp: Date;
    accepted: boolean;
    commentStyle: CommentStyle;
}

/**
 * Change classification result
 */
export interface ChangeClassification {
    type: 'logic' | 'refactor' | 'fix' | 'feature' | 'trivial';
    isMeaningful: boolean;
    isPublicApi: boolean;
    confidence: number;
    reasoning: string;
}

/**
 * API Error response
 */
export interface ApiError {
    error: string;
    code: string;
    details?: unknown;
}
