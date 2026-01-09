import { CommentRequest, CommentResponse, DocUpdateRequest, DocUpdateResponse, ApiError } from './types';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const TIMEOUT_MS = 30000; // 30 seconds

/**
 * Client for communicating with the AutoDocs backend
 * Features: retry logic, timeout, offline detection
 */
export class ApiClient {
    private readonly baseUrl: string;
    private authToken: string | null = null;
    private isOnline: boolean = true;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    setAuthToken(token: string): void {
        this.authToken = token;
    }

    /**
     * Check if we're online
     */
    checkOnline(): boolean {
        return this.isOnline;
    }

    /**
     * Generate comments with retry logic
     */
    async generateComments(request: CommentRequest): Promise<CommentResponse> {
        return this.postWithRetry<CommentResponse>('/api/comments/generate', request);
    }

    /**
     * Get documentation update suggestions
     */
    async getDocUpdates(request: DocUpdateRequest): Promise<DocUpdateResponse> {
        return this.postWithRetry<DocUpdateResponse>('/api/docs/analyze', request);
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.get('/api/health');
            this.isOnline = true;
            return true;
        } catch {
            this.isOnline = false;
            return false;
        }
    }

    /**
     * POST with retry and exponential backoff
     */
    private async postWithRetry<T>(endpoint: string, body: unknown): Promise<T> {
        let lastError: Error = new Error('Unknown error');

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.post<T>(endpoint, body);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on client errors (4xx)
                if (lastError.message.includes('400') ||
                    lastError.message.includes('401') ||
                    lastError.message.includes('429')) {
                    throw lastError;
                }

                // Wait before retrying (exponential backoff)
                if (attempt < MAX_RETRIES) {
                    const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    private async post<T>(endpoint: string, body: unknown): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Device-Id': this.authToken || 'anonymous'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: 'Unknown error',
                    code: 'UNKNOWN'
                })) as ApiError;

                // Provide user-friendly error messages
                const errorMessage = this.getUserFriendlyError(response.status, errorData);
                throw new Error(errorMessage);
            }

            this.isOnline = true;
            return response.json() as Promise<T>;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }

            // Check for network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                this.isOnline = false;
                throw new Error('Network error. Check your internet connection.');
            }

            throw error;
        }
    }

    private async get<T>(endpoint: string): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {};

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Convert error codes to user-friendly messages
     */
    private getUserFriendlyError(status: number, error: ApiError): string {
        switch (status) {
            case 429:
                return 'Daily limit reached. Upgrade to Pro for more!';
            case 400:
                return 'Invalid request. Please try with different code.';
            case 401:
                return 'Authentication error. Please restart VS Code.';
            case 500:
                return 'Server error. We\'re fixing it! Try again soon.';
            case 503:
                return 'Service temporarily unavailable. Try again in a moment.';
            default:
                return error.error || `Unexpected error (${status})`;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
