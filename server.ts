import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

// Add global error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Static Imports for all Handlers & Admin
import { adminAuth, db as adminDb } from './src/lib/firebase-admin';
import { verifyAuth } from './src/api-lib/middlewares/authMiddleware.js';
import adminHandler from './src/api-lib/handlers/admin';
import userHandler from './src/api-lib/handlers/user';
import candidatesHandler from './src/api-lib/handlers/candidates';
import matchingGlobalHandler from './src/api-lib/handlers/matching-global';
import intelHandler from './src/api-lib/handlers/intel';
import parseJdHandler from './src/api-lib/handlers/parse-jd';
import extractTextHandler from './src/api-lib/handlers/extract-text';
import matchDetailedHandler from './src/api-lib/handlers/match-candidates-detailed';
import matchV2Handler from './src/api-lib/handlers/match-v2';
import bulkParseHandler from './src/api-lib/handlers/bulk-parse-resumes';
import workflowsHandler from './src/api-lib/handlers/workflows';
import rescanMatchesHandler from './src/api-lib/handlers/rescan-matches';
import rebuildMatrixHandler from './src/api-lib/handlers/rebuild-matrix';
import cleanupMatchesHandler from './src/api-lib/handlers/cleanup-matches';
import matchHealthHandler from './src/api-lib/handlers/match-health';
import clientAiMatchesHandler from './src/api-lib/handlers/client-ai-matches';
import oauthHandler from './src/api-lib/handlers/oauth';
import workspaceHandler from './src/api-lib/handlers/workspace';
import whatsappHandler from './src/api-lib/handlers/whatsapp';
import googleProxyHandler from './src/api-lib/handlers/google-proxy';
import cronHandler from './src/api-lib/handlers/cron';
import eventsHandler from './src/api-lib/handlers/events';
import clientCandidateHandler from './src/api-lib/handlers/client-candidate';
import clientSubmissionsHandler from './src/api-lib/handlers/client-submissions';
import interviewsHandler from './src/api-lib/handlers/interviews';
import submissionsHandler from './src/api-lib/handlers/submissions';
import integrationsHandler from './src/api-lib/handlers/integrations';
import copilotHandler from './src/api-lib/handlers/copilot';

import analyticsHandler from './src/api-lib/handlers/analytics';
import opsHandler from './src/api-lib/handlers/ops';
import searchCandidatesHandler from './src/api-lib/handlers/search-candidates';
import billingHandler from './src/api-lib/handlers/billing';
import aiGatewayHandler from './src/api-lib/handlers/ai-gateway';
import agentsExecuteHandler from './src/api-lib/handlers/agents-execute';
import rufloHandler from './src/api-lib/handlers/ruflo';
import openAIRouter from './src/api-lib/handlers/openai';
import { CRMEventBridge } from './src/integrations/crm/CRMEventBridge.js';

const __dirname = process.cwd();

async function createServer() {
  // Initialize CRM to HireNestOS Event Bridge
  CRMEventBridge.initialize();

  const app = express();
  app.set('trust proxy', 1); // Trust first proxy (required by express-rate-limit behind reverse proxy like Cloud Run)
  
  // --- Security Headers (OWASP) ---
  app.use(helmet({
    // Vibe Coding Checklist: Secure headers configured.
    // Disabling CSP and X-Frame-Options temporarily to allow AI Studio iframe preview functionality.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }));
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // --- Health Endpoints ---
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', version: '1.0' }));
  app.get('/health/ai', async (req, res) => {
      const aiHealthHandler = (await import('./src/api-lib/handlers/ai-health')).default;
      return await aiHealthHandler(req, res);
  });
  app.get('/ready', (req, res) => {
      if (adminDb) {
          res.status(200).json({ status: 'ready' });
      } else {
          res.status(503).json({ status: 'not_ready' });
      }
  });
  app.get('/live', (req, res) => res.status(200).json({ status: 'alive' }));

  app.get('/api/purge-forbidden', async (req, res) => {
    if (!adminDb) {
      return res.status(503).json({ error: 'adminDb is not available in the server context.' });
    }
    try {
      console.log("[PURGE] Starting comprehensive database purge of forbidden mock terms...");
      const results: Record<string, string[]> = {};
      const collections = [
        "candidatePool",
        "submissions",
        "requirements_public",
        "organizations",
        "candidate_matches",
        "match_opportunities",
        "requirement_match_index",
        "dealRooms",
        "ai_employees",
        "ai_reports",
        "ai_policies",
        "ownership_claims",
        "onboarding_requests",
        "activities",
        "event_ledger",
        "operationalEvents",
        "notifications",
        "interviews",
        "feedback",
        "system_events",
        "invoices",
        "placements",
        "vendor_payouts",
        "resume_parses",
        "users",
        "resume_cache",
        "requirements",
        "candidateMatches",
        "coo_recommendations",
        "ai_agents",
        "agent_queue",
        "agent_executions",
        "mailos_executions",
        "office_runtime",
        "lifecycle_events",
        "system_metrics",
        "system_logs",
        "slas",
        "recommendation_feedback",
        "ai_learning_events",
        "risk_assessments",
        "dlq_events",
        "audit_logs",
        "activity_feed",
        "ownershipVault"
      ];
      const forbiddenPatterns = [
        "sarah jenkins",
        "michael chen",
        "retailgenius",
        "retail genius",
        "techsource staffing",
        "techsource",
        "healthcorp",
        "acme corp",
        "acme",
        "demo candidate",
        "mock vendor"
      ];
      
      for (const colName of collections) {
        try {
          const snap = await adminDb.collection(colName).get();
          results[colName] = [];
          for (const d of snap.docs) {
            const data = d.data();
            const str = JSON.stringify(data).toLowerCase();
            const hasForbidden = forbiddenPatterns.some(pat => str.includes(pat.toLowerCase()));
            if (hasForbidden) {
              const label = data.fullName || data.name || data.email || data.title || d.id;
              results[colName].push(`${d.id} (${label})`);
              await adminDb.collection(colName).doc(d.id).delete();
              console.log(`[PURGE] Deleted document ${d.id} from ${colName} with label: ${label}`);
            }
          }
        } catch (colErr: any) {
          console.warn(`[PURGE] Collection ${colName} scan failed:`, colErr.message);
        }
      }
      return res.status(200).json({ success: true, deleted: results });
    } catch (e: any) {
      console.error("[PURGE] Failed:", e);
      return res.status(500).json({ error: e.message });
    }
  });
  app.get('/metrics', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.status(200).send(`
# HELP node_uptime_seconds The uptime of the Node.js process.
# TYPE node_uptime_seconds counter
node_uptime_seconds ${process.uptime()}
# HELP hirenest_active_requests Current active requests
# TYPE hirenest_active_requests gauge
hirenest_active_requests 0
      `.trim());
  });

  // --- Rate Limiting ---
  const keyGenerator = (req: any, res: any) => {
      if (req.user?.uid) {
          // vendors get higher limits or different limits
          return `${req.user.uid}-${req.user.role || 'guest'}`;
      }
      return ipKeyGenerator(req.ip); // fallback to IP for anonymous
  };

  const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: any) => {
        if (req.user?.role === 'super_admin' || req.user?.role === 'admin') return 1000;
        if (req.user?.role === 'recruiter') return 500;
        return 100; // Limit each IP/user to 100 requests per `window`
    }, 
    keyGenerator,
    message: { error: 'Too many requests, please try again later.' }
  });

  // --- Structured Logging Middleware ---
  app.use((req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
    req.requestId = requestId;
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip
      }));
    });
    next();
  });

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: (req: any) => {
        if (req.user?.role === 'super_admin' || req.user?.role === 'admin') return 100;
        if (req.user?.role === 'recruiter') return 50;
        return 10; 
    },
    keyGenerator,
    message: { error: 'AI request limit reached, please try again later.' }
  });

  // --- Auth Middleware ---
  // verifyAuth is now imported from src/api-lib/middlewares/authMiddleware.js
  
  // Skip auth for oauth callback etc, then enforce it
  app.use('/api', verifyAuth);

  // Apply standard limits to all /api
  app.use('/api/', standardLimiter);
  
  // Apply strict limits to AI operations
  app.use('/api/parse-jd', aiLimiter);
  app.use('/api/extract-text', aiLimiter);
  app.use('/api/match-candidates', aiLimiter);
  app.use('/api/match-candidates-detailed', aiLimiter);
  app.use('/api/match-v2', aiLimiter);
  app.use('/api/matching-global', aiLimiter);
  app.use('/api/rescan-matches', aiLimiter);
  app.use('/api/rebuild-matrix', aiLimiter);
  app.use('/api/ai', aiLimiter);

  // Public endpoints (no auth)
  app.post('/api/public/submit-lead', async (req: any, res: any) => {
    try {
      const data = req.body;
      
      console.log("==========================================");
      console.log("NEW LEAD CAPTURED - NOTIFICATION");
      console.log(`Time: ${new Date().toISOString()}`);
      console.log(`Name: ${data.name}`);
      console.log(`Plan: ${data.plan}`);
      console.log(`Emails: ${data.email}, ${data.companyEmail}`);
      console.log(`Company: ${data.companyName}`);
      console.log(`Phone: ${data.phone || 'N/A'}`);
      console.log("==========================================");

      if (!adminDb) {
        console.warn('[PublicAPI] Admin DB not available, but lead logged to console.');
        // If DB is down, we still return success because we logged it (simulated email)
        return res.json({ success: true, message: 'Lead logged' });
      }
      
      await adminDb.collection('landing_page_leads_v1').add({
        ...data,
        timestamp: new Date().toISOString(),
        status: 'new',
        source: 'landing_page_v1_api'
      });
      
      console.log(`[PublicAPI] Lead also saved to Firestore for: ${data.email}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[PublicAPI] Lead processing failed:', err);
      // Still return success if it was at least logged to console
      return res.json({ success: true, warning: 'DB save failed, but lead captured' });
    }
  });

  // Mount OAuth and Google Proxy BEFORE global catch-all
  app.use('/api/oauth', oauthHandler);
  app.use('/api/workspace', workspaceHandler);
  app.use("/api/whatsapp", whatsappHandler);
  app.use("/api/billing", billingHandler);
  app.use('/api/cron', cronHandler);
  app.use('/api/events', eventsHandler);
  app.use('/api/google', googleProxyHandler);
  app.use('/api/ruflo', rufloHandler);

  // OpenAI-Compatible API Gateway routes
  app.use('/v1', aiLimiter, openAIRouter);
  app.use('/api/v1', aiLimiter, openAIRouter);

  // API Route Handler
  app.use('/api', async (req: any, res: any) => {
    // req.path is relative to the mount point (e.g. '/client-matches')
    const apiRawPath = req.path.replace(/^\//, '');
    const apiPath = apiRawPath.split('?')[0];
    
    // Detailed logging for debugging
    console.log(`[API_MAP] Path: ${apiPath} (Full: ${req.originalUrl || req.url})`);
    
    req.query = { ...req.query, ...req.params };

    try {
      switch (apiPath) {
        case 'create-user':
        case 'user/create':
        case 'delete-user':
        case 'user/delete':
        case 'assign-role':
        case 'user/assign-role':
        case 'user-context':
        case 'user/context':
        case 'user':
        case 'finalize-onboarding':
          return await userHandler(req, res);
          
        case 'metrics':
        case 'admin/metrics':
        case 'diagnostics':
        case 'admin/diagnostics':
        case 'governance-data':
        case 'admin/governance-data':
        case 'pre-flight':
        case 'admin/pre-flight':
        case 'approve-request':
        case 'admin/approve-request':
        case 'onboard-request':
        case 'admin/onboard-request':
        case 'governance':
        case 'admin/governance':
        case 'admin/notify-approval':
        case 'admin/approve-requirement':
        case 'admin/notifications':
        case 'admin':
          return await adminHandler(req, res);

        case 'client-matches':
          return await clientAiMatchesHandler(req, res);

        case 'client-candidate':
          return await clientCandidateHandler(req, res);

        case 'client-submissions':
          return await clientSubmissionsHandler(req, res);

        case 'submissions/transition':
        case 'submissions':
          return await submissionsHandler(req, res);

        case 'interviews':
          return await interviewsHandler(req, res);

        case 'user-candidates':
        case 'user/candidates':
        case 'candidates':
          return await candidatesHandler(req, res);

        case 'matching/global':
        case 'matching-global':
          return await matchingGlobalHandler(req, res);

        case 'search/candidates':
          return await searchCandidatesHandler(req, res);

        case 'deal-intelligence':
        case 'intel':
          return await intelHandler(req, res);

        case 'parse-jd':
          if (parseJdHandler) return await parseJdHandler(req, res);
          break;
          
        case 'extract-text':
          if (extractTextHandler) return await extractTextHandler(req, res);
          break;
          
        case 'match-candidates-detailed':
          if (matchDetailedHandler) return await matchDetailedHandler(req, res);
          break;

        case 'match-v2':
          if (matchV2Handler) return await matchV2Handler(req, res);
          break;

        case 'bulk-parse-resumes':
          if (bulkParseHandler) return await bulkParseHandler(req, res);
          break;

        case 'ai':
        case 'ai/chat':
        case 'ai-gateway':
          if (aiGatewayHandler) return await aiGatewayHandler(req, res);
          break;

        case 'agents/list':
        case 'agents/execute':
          if (agentsExecuteHandler) return await agentsExecuteHandler(req, res);
          break;
          
        case 'rescan-matches':
          if (rescanMatchesHandler) return await rescanMatchesHandler(req, res);
          break;

        case 'rebuild-matrix':
          if (rebuildMatrixHandler) return await rebuildMatrixHandler(req, res);
          break;

        case 'cleanup-matches':
          if (cleanupMatchesHandler) return await cleanupMatchesHandler(req, res);
          break;

        case 'match-health':
          if (matchHealthHandler) return await matchHealthHandler(req, res);
          break;

        case 'workflows':
          return await workflowsHandler(req, res);
          
        case 'copilot':
          return await copilotHandler(req, res);
          
        case 'analytics':
        case 'analytics/client':
        case 'analytics/vendor':
        case 'analytics/recruiter':
        case 'analytics/hq':
        case 'analytics/hq-production-health':
          return await analyticsHandler(req, res);

        case 'ops':
        case 'ops/heartbeats':
        case 'ops/heartbeats/publish':
        case 'ops/queue':
        case 'ops/timeline':
        case 'ops/trends':
        case 'ops/replay':
        case 'ops/runtime/start':
        case 'ops/runtime/stop':
        case 'ops/runtime/pause':
        case 'ops/runtime/resume':
        case 'ops/runtime/status':
        case 'ops/runtime/simulate':
          return await opsHandler(req, res);

        case 'integrations/events':
        case 'integrations/sync/resolve':
        case 'integrations/status':
          return await integrationsHandler(req, res);
      }
      
      console.warn(`[API_404] No static handler explicitly configured for: ${apiPath}.`);
      return res.status(404).json({ success: false, error: `API Route /api/${apiPath} not implemented` });
    } catch (err: any) {
      console.error(`[API_ERR] Execution failed [${apiPath}]:`, err);
      // Ensure we DO NOT use res.send or text
      if (!res.headersSent) {
         return res.status(500).json({ success: false, error: 'Internal Server Error', details: err?.message || String(err), file: apiPath });
      }
    }
  });

  // Vite integration
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = 3000;
  
  // Global Error Handler to guarantee JSON for API errors
  app.use(async (err: any, req: any, res: any, next: any) => {
    console.error("[Global Error Handler]", err);
    
    // Asynchronous error tracking for production readiness
    try {
        const { ErrorMonitor } = await import("./src/api-lib/telemetry/errorMonitor.js");
        await ErrorMonitor.captureError({
            requestId: req.requestId,
            context: req.path,
            errorType: 'BACKEND_EXCEPTION',
            errorMessage: err.message || "A server error occurred",
            stackTrace: err.stack,
            metadata: { method: req.method, ip: req.ip }
        });
    } catch (e) {
        console.error("Failed to log error to telemetry", e);
    }

    if (!res.headersSent) {
      if (req.path.startsWith('/api/')) {
         return res.status(err.status || 500).json({ success: false, error: err.message || "A server error occurred", requestId: req.requestId });
      }
      next(err);
    }
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
