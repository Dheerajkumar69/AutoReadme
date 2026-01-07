import { CommentRequest, CommentResponse, DocUpdateRequest, DocUpdateResponse, ApiError } from './types';

/**
 * Client for communicating with the AutoReadme backend
 */
export class ApiClient {
    private readonly baseUrl: string;
    private authToken: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Set the authentication token
     */
    setAuthToken(token: string): void {
        this.authToken = token;
    }

    /**
     * Generate comments for code changes
     */
    async generateComments(request: CommentRequest): Promise<CommentResponse> {
        const response = await this.post<CommentResponse>('/api/comments/generate', request);
        return response;
    }

    /**
     * Get documentation update suggestions
     */
    async getDocUpdates(request: DocUpdateRequest): Promise<DocUpdateResponse> {
        const response = await this.post<DocUpdateResponse>('/api/docs/analyze', request);
        return response;
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.get('/api/health');
            return true;
        } catch {
            return false;
        }
    }

    private async post<T>(endpoint: string, body: unknown): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: 'Unknown error',
                code: 'UNKNOWN'
            })) as ApiError;
            throw new Error(errorData.error || `Request failed: ${response.status}`);
        }

        return response.json() as Promise<T>;
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
}
