import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Service for interacting with Google Gemini LLM
 */
class LLMService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        }
    }

    /**
     * Check if the LLM service is configured
     */
    isConfigured(): boolean {
        return this.model !== null;
    }

    /**
     * Generate text completion
     */
    async generate(prompt: string): Promise<string> {
        if (!this.model) {
            throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error('Failed to generate response from Gemini');
        }
    }

    /**
     * Generate JSON response
     */
    async generateJSON<T>(prompt: string, fallback: T): Promise<T> {
        try {
            const response = await this.generate(prompt);

            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = response;
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            return JSON.parse(jsonStr.trim());
        } catch (error) {
            console.error('JSON parsing error:', error);
            return fallback;
        }
    }
}

export const llmService = new LLMService();
