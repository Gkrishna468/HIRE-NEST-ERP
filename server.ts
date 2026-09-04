import { startTracing } from './src/api-lib/telemetry/tracer.js';
// startTracing(); // Optionally start telemetry (disabled in dev to reduce console spam)
import 'dotenv/config';
import express from 'express';
// express-async-errors is incompatible with Express 5 and unnecessary since Express 5 natively handles async errors.
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import path from 'path';
import fs from 'fs';

// Add global error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Polyfill Promise.try for third-party libraries (e.g., pdf-parse, pdfjs-dist)
if (typeof (Promise as any).try === 'undefined') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (error) {
        reject(error);
      }
    });
  };
}

// Polyfill Uint8Array.prototype.toHex for newer versions of pdfjs-dist
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (this: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

// Polyfill Map and WeakMap getOrInsertComputed and getOrInsert for pdfjs-dist and modern ECMAScript specifications
if (typeof (Map.prototype as any).getOrInsertComputed !== 'function') {
  (Map.prototype as any).getOrInsertComputed = function (key: any, callback: (key: any) => any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callback(key);
    this.set(key, value);
    return value;
  };
}

if (typeof (Map.prototype as any).getOrInsert !== 'function') {
  (Map.prototype as any).getOrInsert = function (key: any, value: any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
    return value;
  };
}

if (typeof (WeakMap.prototype as any).getOrInsertComputed !== 'function') {
  (WeakMap.prototype as any).getOrInsertComputed = function (key: any, callback: (key: any) => any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callback(key);
    this.set(key, value);
    return value;
  };
}

if (typeof (WeakMap.prototype as any).getOrInsert !== 'function') {
  (WeakMap.prototype as any).getOrInsert = function (key: any, value: any): any {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
    return value;
  };
}

// Polyfill Math.sumPrecise for modern ECMAScript specifications
if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = function (iterable: any): number {
    if (iterable === null || iterable === undefined || typeof iterable[Symbol.iterator] !== 'function') {
      throw new TypeError('Math.sumPrecise: Argument must be an iterable');
    }

    let hasElements = false;
    let hasNaN = false;
    let hasPositiveInfinity = false;
    let hasNegativeInfinity = false;
    
    const values: number[] = [];
    for (const item of iterable) {
      if (typeof item !== 'number') {
        throw new TypeError('Math.sumPrecise: All elements must be numbers');
      }
      hasElements = true;
      if (Number.isNaN(item)) {
        hasNaN = true;
      } else if (item === Infinity) {
        hasPositiveInfinity = true;
      } else if (item === -Infinity) {
        hasNegativeInfinity = true;
      } else {
        values.push(item);
      }
    }

    if (!hasElements) {
      return -0;
    }

    if (hasNaN || (hasPositiveInfinity && hasNegativeInfinity)) {
      return NaN;
    }
    if (hasPositiveInfinity) {
      return Infinity;
    }
    if (hasNegativeInfinity) {
      return -Infinity;
    }

    let sum = -0;
    let c = 0;
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      if (i === 0) {
        sum = x;
        continue;
      }
      const t = sum + x;
      if (Math.abs(sum) >= Math.abs(x)) {
        c += (sum - t) + x;
      } else {
        c += (x - t) + sum;
      }
      sum = t;
    }

    return sum + c;
  };
}

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
import publicCandidateResumeHandler from './src/api-lib/handlers/public-candidate-resume';
import matchDetailedHandler from './src/api-lib/handlers/match-candidates-detailed';
import bulkParseHandler from './src/api-lib/handlers/bulk-parse-resumes';
import workflowsHandler from './src/api-lib/handlers/workflows';
import rescanMatchesHandler from './src/api-lib/handlers/rescan-matches';
import rescanResumeHandler from './src/api-lib/handlers/rescan-resume';
import resumeLedgerHandler from './src/api-lib/handlers/resume-ledger';
import rebuildMatrixHandler from './src/api-lib/handlers/rebuild-matrix';
import cleanupMatchesHandler from './src/api-lib/handlers/cleanup-matches';
import matchHealthHandler from './src/api-lib/handlers/match-health';
import clientAiMatchesHandler from './src/api-lib/handlers/client-ai-matches';
import oauthHandler from './src/api-lib/handlers/oauth';
import workspaceHandler from './src/api-lib/handlers/workspace';
import googleProxyHandler from './src/api-lib/handlers/google-proxy';
import cronHandler from './src/api-lib/handlers/cron';
import eventsHandler from './src/api-lib/handlers/events';
import clientCandidateHandler from './src/api-lib/handlers/client-candidate';
import clientSubmissionsHandler from './src/api-lib/handlers/client-submissions';
import interviewsHandler from './src/api-lib/handlers/interviews';
import submissionsHandler from './src/api-lib/handlers/submissions';
import integrationsHandler from './src/api-lib/handlers/integrations';
import copilotHandler from './src/api-lib/handlers/copilot';
import automationEventsHandler from './src/api-lib/handlers/automation-events';
import candidateScreenHandler from './src/api-lib/handlers/candidate-screen';
import communicationHandler from './src/api-lib/handlers/communication';
import killSwitchHandler from './src/api-lib/handlers/kill-switch';
import syncRequirementsHandler from './src/api-lib/handlers/sync-requirements.js';

import analyticsHandler from './src/api-lib/handlers/analytics';
import opsHandler from './src/api-lib/handlers/ops';
import recruiterOsHandler from './src/api-lib/handlers/recruiter-os';
import searchCandidatesHandler from './src/api-lib/handlers/search-candidates';
import executiveMetricsHandler from './src/api-lib/handlers/executive-metrics';
import dailyBriefingHandler from './src/api-lib/handlers/daily-briefing';
import billingHandler from './src/api-lib/handlers/billing';
import aiGatewayHandler from './src/api-lib/handlers/ai-gateway';
import agentsExecuteHandler from './src/api-lib/handlers/agents-execute';
import rufloHandler from './src/api-lib/handlers/ruflo';
import aiHealthHandler from './src/api-lib/handlers/ai-health';
import { ErrorMonitor } from './src/api-lib/telemetry/errorMonitor.js';
import { CRMEventBridge } from './src/integrations/crm/CRMEventBridge.js';

const __dirname = process.cwd();

/**
 * Races a promise against a timeout so a slow/hanging downstream dependency
 * (e.g. Firestore calls made with stale or misconfigured credentials) can
 * never leave a request open long enough to be cut off by an upstream
 * proxy/load balancer, which would otherwise return its own non-JSON error
 * page to the client instead of our JSON error response.
 */
function withTimeout<T = any>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', version: '1.0' }));
  app.get('/health/ai', async (req, res) => {
      return await aiHealthHandler(req, res);
  });
  app.get('/ready', (req, res) => {
      res.status(200).json({ status: 'ready', databaseConnected: !!adminDb });
  });
  app.get('/readyz', (req, res) => {
      res.status(200).json({ status: 'ready', databaseConnected: !!adminDb });
  });
  app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', version: '1.0' }));
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
      // Use the ipKeyGenerator helper so IPv6 addresses are normalized to a
      // subnet before being used as a rate-limit key (raw IPv6 addresses
      // would otherwise let a single client cycle through addresses to
      // bypass the limit, and express-rate-limit logs a validation error
      // on every request if this helper isn't used).
      return ipKeyGenerator(req.ip) || (req.headers['x-forwarded-for'] as string) || 'anonymous';
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
  app.use('/api/matching-global', aiLimiter);
  app.use('/api/rescan-matches', aiLimiter);
  app.use('/api/rebuild-matrix', aiLimiter);
  app.use('/api/ai', aiLimiter);

  const publicResumeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 parses per minute per IP
    keyGenerator,
    message: { error: 'Rate limit exceeded. Please wait a minute before uploading another resume.' }
  });

  // Public candidate resume parsing endpoints (no auth required)
  app.post('/api/public-candidate-resume', publicResumeLimiter, async (req: any, res: any) => {
    return await publicCandidateResumeHandler(req, res);
  });
  app.post('/api/public/candidate-resume', publicResumeLimiter, async (req: any, res: any) => {
    return await publicCandidateResumeHandler(req, res);
  });

  // Public endpoints (no auth)
  app.post('/api/public/submit-lead', async (req: any, res: any) => {
    try {
      const data = req.body || {};
      
      const email = (data.email || data.companyEmail || '').trim().toLowerCase();
      const fullName = (data.fullName || data.name || 'Anonymous').trim();
      const company = (data.companyName || data.company || 'N/A').trim();
      const phone = (data.phone || 'N/A').trim();
      const plan = (data.plan || 'Professional').trim();

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      console.log("==========================================");
      console.log("NEW LEAD CAPTURED - NOTIFICATION");
      console.log(`Time: ${new Date().toISOString()}`);
      console.log(`Name: ${fullName}`);
      console.log(`Plan: ${plan}`);
      console.log(`Email: ${email}`);
      console.log(`Company: ${company}`);
      console.log(`Phone: ${phone}`);
      console.log("==========================================");

      // Send simulated email alert to info@hirenestworkforce.com
      console.log(`[ALERT_EMAIL] Sending system alert email to info@hirenestworkforce.com:
      Subject: New Landing Page Lead Captured - ${fullName}
      Body:
        A new lead has been captured from the landing page.
        Name: ${fullName}
        Email: ${email}
        Company Name: ${company}
        Phone: ${phone}
        Plan: ${plan}
        Timestamp: ${new Date().toISOString()}
      `);

      if (!adminDb) {
        console.warn('[PublicAPI] Admin DB not available, but lead logged to console.');
        return res.json({ success: true, message: 'Lead logged (Offline mode)' });
      }

      // Check for existing duplicate by email. Bounded by a timeout so that
      // a Firestore call stuck retrying against bad/expired credentials
      // can't hold this request open indefinitely.
      try {
        const existingLeads = await withTimeout(
          adminDb.collection('landing_page_leads_v1')
            .where('email', '==', email)
            .limit(1)
            .get(),
          8000,
          'Duplicate lead lookup'
        );

        if (!existingLeads.empty) {
          console.warn(`[PublicAPI] Lead already exists for email: ${email}. Recorded duplicate attempt.`);
          return res.json({ success: true, message: "Lead already exists, recorded duplicate attempt." });
        }
      } catch (dbCheckErr: any) {
        console.warn('[PublicAPI] Failed to check duplicate email in Firestore:', dbCheckErr.message);
      }

      try {
        await withTimeout(
          adminDb.collection('landing_page_leads_v1').add({
            fullName,
            company,
            email,
            phone,
            plan,
            timestamp: new Date().toISOString(),
            status: 'new',
            source: 'landing_page_v1_api'
          }),
          8000,
          'Lead save'
        );
        console.log(`[PublicAPI] Lead saved to Firestore for: ${email}`);
      } catch (saveErr: any) {
        // The lead has already been logged above (console + alert log), so
        // don't fail the visitor's submission just because the Firestore
        // write itself is slow/unavailable (e.g. stale credentials) — treat
        // it the same as offline mode instead of surfacing a 500.
        console.error('[PublicAPI] Failed to persist lead to Firestore, falling back to logged-only:', saveErr.message);
        return res.json({ success: true, message: 'Lead logged (fallback mode)' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[PublicAPI] Lead processing failed:', err);
      return res.status(500).json({ success: false, error: err.message || "A server error occurred while processing lead" });
    }
  });

  // Mount OAuth and Google Proxy BEFORE global catch-all
  app.use('/api/oauth', oauthHandler);
  app.use('/api/workspace', workspaceHandler);
  app.use("/api/billing", billingHandler);
  app.use('/api/cron', cronHandler);
  app.use('/api/events', eventsHandler);
  app.use('/api/google', googleProxyHandler);
  app.use('/api/ruflo', rufloHandler);
  app.use('/api/communication', communicationHandler);
  app.use('/api/kill-switch', killSwitchHandler);
  app.use('/api/sync-requirements', syncRequirementsHandler);
  app.use('/api/recruiter-os', recruiterOsHandler);
  app.use('/api/executive-metrics', executiveMetricsHandler);
  app.use('/api/daily-briefing', dailyBriefingHandler);

  // API Route Handler
  app.use('/api', async (req: any, res: any, next: any) => {
    // req.path is relative to the mount point (e.g. '/client-matches')
    const apiRawPath = req.path.replace(/^\//, '');
    const apiPath = apiRawPath.split('?')[0];
    
    // Detailed logging for debugging
    console.log(`[API_MAP] Path: ${apiPath} (Full: ${req.originalUrl || req.url})`);
    
    const queryData = { ...req.query, ...req.params };
    try {
      Object.defineProperty(req, 'query', {
        value: queryData,
        writable: true,
        configurable: true
      });
    } catch (e) {
      try {
        req.query = queryData;
      } catch (err) {
        // Fallback
      }
    }

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
          
        case 'public-candidate-resume':
        case 'public/candidate-resume':
          if (publicCandidateResumeHandler) return await publicCandidateResumeHandler(req, res);
          break;

        case 'match-candidates-detailed':
          if (matchDetailedHandler) return await matchDetailedHandler(req, res);
          break;


        case "bulk-parse":
        case "bulk-parse-resumes":
          if (bulkParseHandler) return await bulkParseHandler(req, res);
          break;
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

        case 'rescan-resume':
        case 'rescan':
          if (rescanResumeHandler) return await rescanResumeHandler(req, res);
          break;

        case 'resume-ledger':
        case 'watchdog/recover-stale':
          if (resumeLedgerHandler) return await resumeLedgerHandler(req, res);
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

        case 'automation/events':
        case 'automation-events':
          return await automationEventsHandler(req, res);

        case 'candidates/screen':
        case 'candidate-screen':
          return await candidateScreenHandler(req, res);

        case 'jobs/update-status': {
          if (!adminDb) {
            return res.status(503).json({ error: 'Firebase Admin Database not initialized.' });
          }
          try {
            const { jobId, status } = req.body;
            if (!jobId || !status) {
              return res.status(400).json({ error: 'Missing required fields: jobId and status' });
            }
            await adminDb.collection('requirements_public').doc(jobId).set({
              status,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            // Also update 'requirements' if it exists
            const reqRef = adminDb.collection('requirements').doc(jobId);
            const reqSnap = await reqRef.get();
            if (reqSnap.exists) {
              await reqRef.set({
                status,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }

            return res.status(200).json({ success: true });
          } catch (err: any) {
            return res.status(500).json({ error: err.message });
          }
        }

        case 'communication':
        case 'communication/evaluate':
        case 'communication/send':
        case 'communication/consent':
        case 'communication/audit':
          return await communicationHandler(req, res, next);

        case 'kill-switch':
        case 'kill-switch/activate':
        case 'kill-switch/deactivate':
        case 'kill-switch/clear-all':
        case 'kill-switch/evaluate':
        case 'kill-switch/list':
        case 'kill-switch/audit':
          return await killSwitchHandler(req, res, next);
          
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

  // Global Error Handler to guarantee JSON for API errors
  app.use(async (err: any, req: any, res: any, next: any) => {
    console.error("[Global Error Handler]", err);
    
    // Asynchronous error tracking for production readiness
    try {
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
      if (req.originalUrl?.startsWith('/api') || req.path?.startsWith('/api') || req.originalUrl?.startsWith('/v1') || req.path?.startsWith('/v1')) {
         return res.status(err.status || 500).json({ success: false, error: err.message || "A server error occurred", requestId: req.requestId });
      }
      if (req.xhr || req.headers?.accept?.indexOf('json') !== -1) {
         return res.status(err.status || 500).json({ success: false, error: err.message || "A server error occurred", requestId: req.requestId });
      }
      next(err);
    }
  });

  // Vite integration
  const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
  const isRunningFromCjs = process.argv[1]?.endsWith('server.cjs');
  const isProd = process.env.NODE_ENV === 'production' || isRunningFromCjs || !fs.existsSync(path.resolve(process.cwd(), 'vite.config.ts'));

  const serveStaticFiles = () => {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      const url = req.originalUrl || req.url;
      if (url.startsWith('/api') || req.path?.startsWith('/api')) {
        return res.status(404).json({ success: false, error: `API endpoint ${url} not found` });
      }
      if (fs.existsSync(distIndexPath)) {
        res.sendFile(distIndexPath);
      } else {
        res.status(404).send('Application build not found. Please build the project.');
      }
    });
  };

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
      });
      app.use(vite.middlewares);
      
      app.use(async (req, res, next) => {
        const url = req.originalUrl || req.url;
        if (url.startsWith('/api') || req.path?.startsWith('/api')) {
          return res.status(404).json({ success: false, error: `API endpoint ${url} not found` });
        }
        try {
          let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
    } catch (viteImportError) {
      console.warn("[Server] Vite is not available in this environment. Falling back to production static serving mode.");
      serveStaticFiles();
    }
  } else {
    serveStaticFiles();
  }

  const PORT = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT) : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

createServer();
