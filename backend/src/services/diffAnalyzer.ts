import { DiffChunk, ChangeClassification } from '../types';
import { llmService } from './llmService';

/**
 * Service for analyzing code diffs
 */
class DiffAnalyzer {
    /**
     * Analyze diff chunks to determine if they're meaningful
     */
    async analyze(chunks: DiffChunk[], fullContent: string): Promise<ChangeClassification> {
        // Quick heuristic checks first
        const quickResult = this.quickAnalysis(chunks);
        if (!quickResult.shouldUseLLM) {
            return quickResult.classification;
        }

        // Use LLM for deeper analysis
        return this.llmAnalysis(chunks, fullContent);
    }

    /**
     * Quick heuristic-based analysis
     */
    private quickAnalysis(chunks: DiffChunk[]): { shouldUseLLM: boolean; classification: ChangeClassification } {
        const totalChanges = chunks.reduce((sum, c) => sum + c.changes.length, 0);

        // Too few changes
        if (totalChanges < 2) {
            return {
                shouldUseLLM: false,
                classification: {
                    type: 'trivial',
                    isMeaningful: false,
                    isPublicApi: false,
                    confidence: 0.9,
                    reasoning: 'Too few changes to be meaningful'
                }
            };
        }

        // Check for trivial patterns
        let trivialCount = 0;
        let meaningfulCount = 0;

        for (const chunk of chunks) {
            for (const change of chunk.changes) {
                const content = change.content.trim();

                // Empty lines
                if (content === '') {
                    trivialCount++;
                    continue;
                }

                // Import statements
                if (content.startsWith('import ') || content.startsWith('from ')) {
                    trivialCount++;
                    continue;
                }

                // Comments (we shouldn't comment on comments)
                if (content.startsWith('//') || content.startsWith('/*') || content.startsWith('*') || content.startsWith('#')) {
                    trivialCount++;
                    continue;
                }

                // Console logs (usually debug code)
                if (content.includes('console.log') || content.includes('print(')) {
                    trivialCount++;
                    continue;
                }

                meaningfulCount++;
            }
        }

        if (meaningfulCount === 0) {
            return {
                shouldUseLLM: false,
                classification: {
                    type: 'trivial',
                    isMeaningful: false,
                    isPublicApi: false,
                    confidence: 0.85,
                    reasoning: 'All changes are trivial (imports, comments, whitespace)'
                }
            };
        }

        // Use LLM for non-trivial changes
        return {
            shouldUseLLM: true,
            classification: {
                type: 'logic',
                isMeaningful: true,
                isPublicApi: false,
                confidence: 0.5,
                reasoning: 'Needs deeper analysis'
            }
        };
    }

    /**
     * LLM-based analysis for complex changes
     */
    private async llmAnalysis(chunks: DiffChunk[], fullContent: string): Promise<ChangeClassification> {
        const changedCode = chunks.map(c =>
            c.changes.map(ch => `${ch.type === 'added' ? '+' : '-'} ${ch.content}`).join('\n')
        ).join('\n\n');

        const prompt = `Analyze this code change and classify it. Be strict about what's "meaningful".

CODE CHANGES:
\`\`\`
${changedCode}
\`\`\`

CONTEXT (surrounding code):
\`\`\`
${fullContent.substring(0, 500)}...
\`\`\`

Respond ONLY with JSON:
{
    "type": "logic" | "refactor" | "fix" | "feature" | "trivial",
    "isMeaningful": boolean (false for obvious/simple changes),
    "isPublicApi": boolean (true if exports, public methods, or API affected),
    "confidence": number (0-1),
    "reasoning": "one sentence explanation"
}

RULES:
- Simple variable declarations are NOT meaningful
- Console logs are NOT meaningful
- Import changes are NOT meaningful
- Renaming is refactor, usually NOT meaningful unless complex
- New functions/methods with logic ARE meaningful
- Bug fixes ARE meaningful
- API changes ARE meaningful and isPublicApi=true`;

        return llmService.generateJSON<ChangeClassification>(prompt, {
            type: 'logic',
            isMeaningful: true,
            isPublicApi: false,
            confidence: 0.6,
            reasoning: 'LLM analysis fallback'
        });
    }
}

export const diffAnalyzer = new DiffAnalyzer();
