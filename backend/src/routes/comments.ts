import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { commentGenerator } from '../services/commentGenerator';
import { diffAnalyzer } from '../services/diffAnalyzer';
import { CommentRequest, CommentResponse } from '../types';

export const commentRoutes = Router();

// Request validation schema
const generateRequestSchema = z.object({
    filePath: z.string(),
    language: z.string(),
    diffChunks: z.array(z.object({
        startLine: z.number(),
        endLine: z.number(),
        changes: z.array(z.object({
            lineNumber: z.number(),
            content: z.string(),
            type: z.enum(['added', 'removed', 'unchanged'])
        })),
        contextBefore: z.array(z.string()),
        contextAfter: z.array(z.string())
    })),
    fullFileContent: z.string(),
    commentStyle: z.enum(['short', 'explanatory', 'pr-review'])
});

/**
 * POST /api/comments/generate
 * Generate comment suggestions for code changes
 */
commentRoutes.post('/generate', async (req: Request, res: Response) => {
    try {
        // Validate request body
        const parseResult = generateRequestSchema.safeParse(req.body);

        if (!parseResult.success) {
            res.status(400).json({
                error: 'Invalid request body',
                code: 'VALIDATION_ERROR',
                details: parseResult.error.issues
            });
            return;
        }

        const request: CommentRequest = parseResult.data;

        // Analyze the diff to determine if it's worth commenting
        const analysis = await diffAnalyzer.analyze(request.diffChunks, request.fullFileContent);

        if (!analysis.isMeaningful) {
            const response: CommentResponse = {
                success: true,
                suggestions: [],
                shouldUpdateDocs: false
            };
            res.json(response);
            return;
        }

        // Generate comments
        const suggestions = await commentGenerator.generate(
            request.diffChunks,
            request.fullFileContent,
            request.language,
            request.commentStyle,
            analysis
        );

        const response: CommentResponse = {
            success: true,
            suggestions,
            shouldUpdateDocs: analysis.isPublicApi,
            docUpdateReason: analysis.isPublicApi
                ? 'This change affects public API and may need documentation updates'
                : undefined
        };

        res.json(response);
    } catch (error) {
        console.error('Comment generation error:', error);
        res.status(500).json({
            error: 'Failed to generate comments',
            code: 'GENERATION_ERROR'
        });
    }
});
