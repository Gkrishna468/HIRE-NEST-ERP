import express from 'express';
import { AIGateway } from '../services/AIGateway.js';
import { db } from '../../lib/firebase-admin.js';

const router = express.Router();

router.get('/models', (req: any, res: any) => {
    return res.json({
        object: 'list',
        data: [
            {
                id: 'gemini-2.5-flash',
                object: 'model',
                created: 1700000000,
                owned_by: 'google'
            },
            {
                id: 'gemini-2.5-pro',
                object: 'model',
                created: 1700000000,
                owned_by: 'google'
            },
            {
                id: 'qwen3:8b',
                object: 'model',
                created: 1700000000,
                owned_by: 'ollama'
            },
            {
                id: 'deepseek-r1',
                object: 'model',
                created: 1700000000,
                owned_by: 'ollama'
            }
        ]
    });
});

router.post('/chat/completions', async (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                message: 'Unauthorized: No token provided',
                type: 'invalid_request_error',
                param: null,
                code: 'unauthorized'
            }
        });
    }

    const token = authHeader.split('Bearer ')[1];
    const customApiKey = process.env.HIRENEST_API_KEY || 'HN_dev_key_123';
    
    let user = { uid: 'openai-compat', role: 'general' };
    let isAuthenticated = false;

    if (token === customApiKey) {
        user = { uid: 'system-api-key', role: 'admin' };
        isAuthenticated = true;
    } else if (token.startsWith('HN_')) {
        if (db) {
            try {
                const keySnap = await db.collection('api_keys').doc(token).get();
                if (keySnap.exists) {
                    const keyData = keySnap.data();
                    if (keyData && keyData.status === 'active') {
                        user = {
                            uid: keyData.userId || 'api-key-user',
                            role: keyData.role || 'recruiter'
                        };
                        isAuthenticated = true;
                    }
                }
            } catch (e) {
                console.warn('[OpenAI Router] Failed to retrieve API key details from database', e);
            }
        }
        
        // Dev environment / fallback check
        if (!isAuthenticated) {
            if (process.env.NODE_ENV !== 'production' || token === 'HN_dev_key_123') {
                user = { uid: 'dev-fallback', role: 'recruiter' };
                isAuthenticated = true;
            }
        }
    }

    if (!isAuthenticated) {
        return res.status(401).json({
            error: {
                message: 'Unauthorized: Invalid HIRENEST_API_KEY',
                type: 'invalid_request_error',
                param: null,
                code: 'unauthorized'
            }
        });
    }

    const { model = 'gemini-1.5-flash', messages, temperature, max_tokens, stream = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
            error: {
                message: 'messages array is required',
                type: 'invalid_request_error',
                param: 'messages',
                code: null
            }
        });
    }

    try {
        // Convert OpenAI-style message array to a unified prompt string for AIGateway
        const prompt = messages.map((m: any) => {
            const roleName = m.role === 'system' ? 'System' : m.role === 'user' ? 'User' : 'Assistant';
            return `${roleName}: ${m.content}`;
        }).join('\n\n') + '\n\nAssistant:';

        const userId = user.uid;
        const office = user.role;

        console.log(`[OpenAI Router] Processing chat completion for model ${model} requested by ${userId}`);

        const result = await AIGateway.processChat({
            prompt,
            model,
            userId,
            office,
            feature: 'general',
            skipCache: true
        });

        const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
        const completionTokens = Math.max(1, Math.ceil(result.response.length / 4));

        return res.json({
            id: `chatcmpl-${Math.random().toString(36).substring(2, 15)}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: result.model || model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.response
                    },
                    logprobs: null,
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
            }
        });
    } catch (err: any) {
        console.error('[OpenAI Router] Error processing request:', err);
        return res.status(500).json({
            error: {
                message: err.message || 'An internal server error occurred while processing your request.',
                type: 'api_error',
                param: null,
                code: 'internal_error'
            }
        });
    }
});

export default router;
