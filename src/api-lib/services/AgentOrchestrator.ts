import { db } from '../../lib/firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { AICOO } from './AICOO.js';
import { NetworkOpportunityEngine } from './NetworkOpportunityEngine.js';
import { ContinuousMatchingEngine } from './ContinuousMatchingEngine.js';
import { ContinuousImprovementEngine } from './ContinuousImprovementEngine.js';
import { OfficeRuntimeService } from './OfficeRuntimeService.js';
import { MatchingOffice } from './MatchingOffice.js';

export interface AgentJob {
    jobId: string;
    agentId: string;
    event: any;
    priority: 'high' | 'medium' | 'low';
    attempts: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
    runtime?: number;
    orgId?: string;
}

export class AgentOrchestrator {
    
    // Core Seed - creates the necessary agents if they don't exist
    static async seedCoreAgents() {
        if (!db) return;
        
        const coreAgents = [
            // Layer 1: Office Agents
            { id: 'founder-office', name: 'Founder Office', category: 'Layer 1: Office Agents', triggerType: 'CRON', schedule: 'Twice Daily (8:30 AM, 6:00 PM)', status: 'Healthy', enabled: true, core: true, desc: 'Owns overall business outcomes, overnight briefings, and EOD reports.' },
            { id: 'gtm-office', name: 'GTM Office', category: 'Layer 1: Office Agents', triggerType: 'CRON', schedule: '9:00 AM Daily', status: 'Healthy', enabled: true, core: true, desc: 'Generates demand, runs outbound campaigns, finds new leads.' },
            { id: 'recruitment-office', name: 'Recruitment Office', category: 'Layer 1: Office Agents', triggerType: 'EVENT', triggerEvent: 'REQUIREMENT_CREATED', schedule: 'Event-driven', status: 'Healthy', enabled: true, core: true, desc: 'Delivers talent, manages resume parsing, matching, and submissions.' },
            { id: 'vendor-office', name: 'Vendor Office', category: 'Layer 1: Office Agents', triggerType: 'CRON', schedule: '9:15 AM Daily', status: 'Healthy', enabled: true, core: true, desc: 'Improves partner success, collects bench profiles, coaches vendors.' },
            { id: 'client-office', name: 'Client Office', category: 'Layer 1: Office Agents', triggerType: 'EVENT', triggerEvent: 'REQUIREMENT_UPDATED', schedule: 'Event-driven', status: 'Healthy', enabled: true, core: true, desc: 'Drives hiring outcomes, sends market insights, monitors SLA.' },
            { id: 'marketplace-office', name: 'Marketplace Office', category: 'Layer 1: Office Agents', triggerType: 'CRON', schedule: 'Every 15 min', status: 'Healthy', enabled: true, core: true, desc: 'Optimizes entire ecosystem, detects idle bench, drives cross-workspace matches.' },
            { id: 'matching-office', name: 'Matching Office', category: 'Layer 1: Office Agents', triggerType: 'EVENT', triggerEvent: 'REQUIREMENT_CREATED', schedule: 'Event-driven', status: 'Healthy', enabled: true, core: true, desc: 'Maintains candidate-requirement relationships and updates candidate_matches.' },
            { id: 'scheduling-office', name: 'Scheduling Office', category: 'Layer 1: Office Agents', triggerType: 'EVENT', triggerEvent: 'INTERVIEW_REQUESTED', schedule: 'Event-driven', status: 'Healthy', enabled: true, core: true, desc: 'Coordinates interviews, manages Google Calendar sync, and sends invites.' },
            
            // Layer 2: Shared Skills
            { id: 'resume-parser', name: 'Resume Parser', category: 'Layer 2: Shared Skills', triggerType: 'CALL', schedule: 'On Demand', status: 'Healthy', enabled: true, desc: 'Extracts entities and skills from resumes.' },
            { id: 'matching-engine', name: 'Matching Engine', category: 'Layer 2: Shared Skills', triggerType: 'CALL', schedule: 'On Demand', status: 'Healthy', enabled: true, desc: 'Calculates match scores between candidates and requirements.' },
            { id: 'vendor-broadcast', name: 'Vendor Broadcast', category: 'Layer 2: Shared Skills', triggerType: 'CALL', schedule: 'On Demand', status: 'Healthy', enabled: true, desc: 'Notifies vendors about new requirements.' },
            { id: 'lead-discovery', name: 'Lead Finder', category: 'Layer 2: Shared Skills', triggerType: 'CALL', schedule: 'On Demand', status: 'Healthy', enabled: true, desc: 'Scrapes LinkedIn and web for prospects.' },
            
            // Layer 3: Background Workers
            { id: 'mailos-agent', name: 'MailOS Agent', category: 'Layer 3: Background Workers', triggerType: 'CRON', schedule: 'Every 5 min', status: 'Healthy', enabled: true, core: true, desc: 'Syncs emails from Workspace, triggers requirement parsing.' },
            { id: 'audit-logger', name: 'Audit Agent', category: 'Layer 3: Background Workers', triggerType: 'EVENT', triggerEvent: 'ANY_EVENT', schedule: 'Event-driven', status: 'Healthy', enabled: true, core: true, desc: 'Logs compliance and security events to Firestore.' },
            { id: 'queue-processor', name: 'Queue Processor', category: 'Layer 3: Background Workers', triggerType: 'CRON', schedule: 'Every 1 min', status: 'Healthy', enabled: true, core: true, desc: 'Maintains system queues and retry logic.' },
        ];
        
        for (const agent of coreAgents) {
            const docRef = db.collection('ai_agents').doc(agent.id);
            const doc = await docRef.get();
            if (!doc.exists) {
                await docRef.set({
                    ...agent,
                    successRate: 100,
                    avgRuntime: 0,
                    execsToday: 0,
                    failureCount: 0,
                    lastRun: new Date().toISOString()
                });
            }
        }
    }

    // Push an event to the queue
    static async enqueueJob(agentId: string, eventPayload: any, priority: 'high' | 'medium' | 'low' = 'medium', orgId?: string) {
        if (!db) return;
        
        const job: AgentJob = {
            jobId: `job-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            agentId,
            event: eventPayload,
            priority,
            attempts: 0,
            status: 'queued',
            createdAt: new Date().toISOString(),
            orgId
        };
        
        await db.collection('agent_queue').doc(job.jobId).set(job);
        
        // Also update the agent's status to Busy if we want real-time metrics, but wait for processing
        return job.jobId;
    }

    // A simple mock for executing different agent types
    static async executeAgentLogic(agentId: string, payload: any): Promise<{ success: boolean; output: any; tokens?: number; model?: string; error?: string }> {
        // Simulate execution time for UI visibility
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
        
        switch (agentId) {
            case 'resume-parser':
                return { success: true, output: { status: 'parsed', name: 'Extracted Name' }, tokens: 1250, model: 'gemini-3.1-pro-preview' };
            case 'AI_COO_QUEUE_REVIEW':
                const reviewResult = await AICOO.reviewEnterpriseQueues(payload.workspaceId || 'default-workspace');
                return { success: true, output: reviewResult, tokens: 350, model: 'gemini-3.7-flash' };
            case 'NETWORK_OPPORTUNITIES':
                const oppResult = await NetworkOpportunityEngine.searchForOpportunities();
                return { success: true, output: oppResult, tokens: 450, model: 'gemini-3.7-flash' };
            case 'NETWORK_RECALIBRATION':
                const recalibrationResult = await ContinuousMatchingEngine.executeNetworkMatchCycle();
                return { success: true, output: recalibrationResult, tokens: 2500, model: 'gemini-3.1-pro-preview' };
            case 'CONTINUOUS_IMPROVEMENT_ANALYSIS':
                const improveResult = await ContinuousImprovementEngine.executeNightlyAnalysis(payload.workspaceId || 'default-workspace');
                return { success: true, output: improveResult, tokens: 4000, model: 'gemini-3.1-pro-preview' };
            case 'RECRUITMENT_MORNING_PROCESSING':
                const recResult = await OfficeRuntimeService.executeManagerRoutine(payload.workspaceId || 'default-workspace', 'RECRUITMENT');
                return { success: true, output: recResult, tokens: 1500, model: 'gemini-3.1-pro-preview' };
            case 'CANDIDATE_IMPROVEMENT_AGENT':
                console.log(`[CANDIDATE_IMPROVEMENT] Processing candidate ${payload.candidateId}`);
                return { success: true, output: { status: 'Candidate Improvement Loop Triggered', candidateId: payload.candidateId }, tokens: 3000, model: 'gemini-3.1-pro-preview' };
            case 'REQUIREMENT_IMPROVEMENT_AGENT':
                console.log(`[REQUIREMENT_IMPROVEMENT] Processing requirement ${payload.requirementId}`);
                return { success: true, output: { status: 'Requirement Improvement Loop Triggered', requirementId: payload.requirementId }, tokens: 2500, model: 'gemini-3.1-pro-preview' };
            case 'matching-office':
                console.log(`[MATCHING_OFFICE] Running Event-Driven Match Routine for event type: ${payload.eventType || 'UNKNOWN'}`);
                await MatchingOffice.handleEvent(payload.eventType, payload.payload, payload.orgId);
                return { success: true, output: { status: 'Match Loop Completed Successfully' }, tokens: 3500, model: 'gemini-3.7-flash' };
            case 'scheduling-office':
                console.log(`[SCHEDULING_OFFICE] Running Event-Driven Scheduling Routine for event type: ${payload.eventType || 'UNKNOWN'}`);
                const { SchedulingOffice } = await import('./SchedulingOffice.js');
                await SchedulingOffice.handleEvent(payload.eventType, payload.payload, payload.orgId);
                return { success: true, output: { status: 'Scheduling Loop Completed Successfully' }, tokens: 1200, model: 'gemini-3.7-flash' };
            default:
                return { success: true, output: { status: 'processed' }, tokens: 450, model: 'gemini-3.7-flash' };
        }
    }

    // Process the queue
    static async processQueue() {
        if (!db) return;
        
        // Get up to 5 queued jobs
        const snapshot = await db.collection('agent_queue')
            .where('status', '==', 'queued')
            .orderBy('createdAt', 'asc')
            .limit(5)
            .get();
            
        if (snapshot.empty) return;
        
        for (const doc of snapshot.docs) {
            const job = doc.data() as AgentJob;
            
            // Mark as processing
            await doc.ref.update({ status: 'processing', startedAt: new Date().toISOString() });
            
            // Update agent status to Busy
            await db.collection('ai_agents').doc(job.agentId).update({ status: 'Busy' }).catch(() => {});
            
            const start = Date.now();
            
            try {
                const result = await this.executeAgentLogic(job.agentId, job.event);
                const duration = Date.now() - start;
                
                // Mark job as completed
                await doc.ref.update({ 
                    status: 'completed', 
                    finishedAt: new Date().toISOString(),
                    runtime: duration 
                });
                
                // Record execution history
                await db.collection('agent_executions').add({
                    jobId: job.jobId,
                    agentId: job.agentId,
                    orgId: job.orgId || null,
                    inputs: job.event,
                    outputs: result.output,
                    duration,
                    tokens: result.tokens || 0,
                    model: result.model || 'unknown',
                    status: 'success',
                    timestamp: new Date().toISOString()
                });
                
                // Update agent stats
                await db.collection('ai_agents').doc(job.agentId).update({
                    status: 'Healthy',
                    lastRun: new Date().toISOString(),
                    // Increment execs Today would require a transaction, but we'll simplify here or do it in the UI
                });
                
            } catch (e: any) {
                const duration = Date.now() - start;
                // Mark job as failed
                await doc.ref.update({ 
                    status: 'failed', 
                    finishedAt: new Date().toISOString(),
                    runtime: duration,
                    error: e.message 
                });
                
                // Record execution history
                await db.collection('agent_executions').add({
                    jobId: job.jobId,
                    agentId: job.agentId,
                    orgId: job.orgId || null,
                    inputs: job.event,
                    error: e.message,
                    duration,
                    status: 'error',
                    timestamp: new Date().toISOString()
                });
                
                // Update agent stats
                await db.collection('ai_agents').doc(job.agentId).update({
                    status: 'Healthy', // or Degraded
                    failureCount: FieldValue.increment(1)
                });
            }
        }
    }
}
