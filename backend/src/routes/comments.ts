import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { commentGenerator } from '../services/commentGenerator';
import { diffAnalyzer } from '../services/diffAnalyzer';
import { checkUsage, incrementUsage } from '../services/usageTracker';
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
        // Get device ID from header (no login required)
        const deviceId = req.headers['x-device-id'] as string || req.headers['authorization']?.replace('Bearer ', '') || 'anonymous';

        // Check usage limits
        const usage = checkUsage(deviceId);
        if (!usage.allowed) {
            res.status(429).json({
                error: 'Daily limit reached',
                code: 'LIMIT_EXCEEDED',
                usage: {
                    used: usage.used,
                    limit: usage.limit,
                    remaining: 0
                }
            });
            return;
        }

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
            res.json({
                success: true,
                suggestions: [],
                shouldUpdateDocs: false,
                usage: {
                    used: usage.used,
                    limit: usage.limit,
                    remaining: usage.remaining
                }
            });
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

        // Increment usage only if we actually generated comments
        if (suggestions.length > 0) {
            incrementUsage(deviceId);
        }

        const updatedUsage = checkUsage(deviceId);

        const response = {
            success: true,
            suggestions,
            shouldUpdateDocs: analysis.isPublicApi,
            docUpdateReason: analysis.isPublicApi
                ? 'This change affects public API and may need documentation updates'
                : undefined,
            usage: {
                used: updatedUsage.used,
                limit: updatedUsage.limit,
                remaining: updatedUsage.remaining
            }
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
