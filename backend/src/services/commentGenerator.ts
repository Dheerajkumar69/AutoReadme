import { DiffChunk, CommentSuggestion, CommentStyle, ChangeClassification } from '../types';
import { llmService } from './llmService';
import { randomUUID } from 'crypto';

/**
 * Service for generating code comments
 */
class CommentGenerator {
    private readonly stylePrompts = {
        short: 'Generate a brief, one-line comment (max 10 words)',
        explanatory: 'Generate a clear comment explaining the intent and purpose (2-3 sentences max)',
        'pr-review': 'Generate a PR-review style comment explaining what changed and why'
    };

    /**
     * Generate comment suggestions for code changes
     */
    async generate(
        chunks: DiffChunk[],
        fullContent: string,
        language: string,
        style: CommentStyle,
        analysis: ChangeClassification
    ): Promise<CommentSuggestion[]> {
        if (!analysis.isMeaningful) {
            return [];
        }

        const suggestions: CommentSuggestion[] = [];

        for (const chunk of chunks) {
            const suggestion = await this.generateForChunk(chunk, fullContent, language, style, analysis);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    /**
     * Generate a comment for a specific chunk
     */
    private async generateForChunk(
        chunk: DiffChunk,
        fullContent: string,
        language: string,
        style: CommentStyle,
        analysis: ChangeClassification
    ): Promise<CommentSuggestion | null> {
        const changedCode = chunk.changes
            .filter(c => c.type === 'added')
            .map(c => c.content)
            .join('\n');

        if (!changedCode.trim()) {
            return null;
        }

        const contextCode = [
            ...chunk.contextBefore,
            '// ---- CHANGES BELOW ----',
            changedCode,
            '// ---- CHANGES ABOVE ----',
            ...chunk.contextAfter
        ].join('\n');

        const prompt = `You are an expert code commenter. ${this.stylePrompts[style]}.

CHANGE TYPE: ${analysis.type}
LANGUAGE: ${language}
REASONING: ${analysis.reasoning}

CONTEXT AND CHANGES:
\`\`\`${language}
${contextCode}
\`\`\`

RULES - CRITICAL:
1. Explain WHY this code exists, not WHAT it does
2. If the code is self-explanatory, respond with {"skip": true}
3. Never explain obvious syntax (loops, if statements, etc.)
4. Focus on business logic, intent, and non-obvious decisions
5. Be concise but helpful

Respond with JSON:
{
    "skip": false,
    "comment": "Your comment text here",
    "confidence": 0.8
}

OR if the code is self-explanatory:
{
    "skip": true,
    "reason": "why it doesn't need a comment"
}`;

        interface CommentResult {
            skip?: boolean;
            comment?: string;
            confidence?: number;
            reason?: string;
        }

        const result = await llmService.generateJSON<CommentResult>(prompt, { skip: true });

        if (result.skip || !result.comment) {
            return null;
        }

        // Validate that the comment isn't generic
        if (this.isGenericComment(result.comment)) {
            return null;
        }

        return {
            id: randomUUID(),
            lineNumber: chunk.startLine,
            comment: result.comment,
            style,
            confidence: result.confidence || 0.7,
            reasoning: analysis.reasoning
        };
    }

    /**
     * Check if a comment is too generic to be useful
     */
    private isGenericComment(comment: string): boolean {
        const genericPatterns = [
            /^(this|the) (function|method|code) (does|will|is)/i,
            /^handles? /i,
            /^performs? /i,
            /^executes? /i,
            /^returns? (a|the|true|false)/i,
            /^checks? (if|whether)/i,
            /^loops? (through|over)/i,
            /^iterates? (over|through)/i,
            /^creates? (a|an|the)/i,
            /^initializes?/i,
            /^sets? (the|a)/i,
            /^gets? (the|a)/i
        ];

        const lower = comment.toLowerCase();

        for (const pattern of genericPatterns) {
            if (pattern.test(lower)) {
                return true;
            }
        }

        // Too short to be meaningful
        if (comment.split(' ').length < 4) {
            return true;
        }

        return false;
    }
}

export const commentGenerator = new CommentGenerator();
