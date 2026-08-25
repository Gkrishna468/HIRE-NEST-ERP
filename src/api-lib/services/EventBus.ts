import { db } from '../../lib/firebase-admin.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { WorkOrchestrator } from './WorkOrchestrator.js';
import { BusinessEvent } from '../os/kernel/RuntimeTypes.js';

export class EventBus {
    
    // Seed default subscriptions if none exist to guarantee an operational foundation
    private static async ensureDefaultSubscriptions() {
        if (!db) return;
        
        const subSnap = await db.collection('event_subscriptions').limit(1).get();
        if (!subSnap.empty) return; // Already seeded
        
        console.log('[EventBus] No event subscriptions found. Seeding default subscription registry...');
        
        const defaultSubs = [
            { id: 'sub-coo-all', eventType: '*', subscriber: 'AICOORuntime', priority: 100, enabled: true },
            { id: 'sub-graph-all', eventType: '*', subscriber: 'GraphProjectionWorker', priority: 90, enabled: true },
            { id: 'sub-email-resume', eventType: 'EMAIL_RECEIVED', subscriber: 'ResumeParserSkill', priority: 10, enabled: true },
            { id: 'sub-email-requirement', eventType: 'EMAIL_RECEIVED', subscriber: 'RequirementParserSkill', priority: 10, enabled: true },
            { id: 'sub-email-recruitment', eventType: 'EMAIL_RECEIVED', subscriber: 'RecruitmentOffice', priority: 8, enabled: true },
            { id: 'sub-req-recruitment', eventType: 'REQUIREMENT_CREATED', subscriber: 'RecruitmentOffice', priority: 10, enabled: true },
            { id: 'sub-req-matching', eventType: 'REQUIREMENT_CREATED', subscriber: 'MatchingEngine', priority: 10, enabled: true },
            { id: 'sub-req-vendor', eventType: 'REQUIREMENT_CREATED', subscriber: 'VendorOffice', priority: 8, enabled: true },
            { id: 'sub-cand-vendor', eventType: 'CANDIDATE_CREATED', subscriber: 'VendorOffice', priority: 10, enabled: true },
            { id: 'sub-cand-recruitment', eventType: 'CANDIDATE_CREATED', subscriber: 'RecruitmentOffice', priority: 8, enabled: true },
            { id: 'sub-match-recruitment', eventType: 'MATCH_COMPLETED', subscriber: 'RecruitmentOffice', priority: 10, enabled: true },
            { id: 'sub-match-client', eventType: 'MATCH_COMPLETED', subscriber: 'ClientOffice', priority: 8, enabled: true },
            { id: 'sub-req-matching-created', eventType: 'REQUIREMENT_CREATED', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-req-matching-updated', eventType: 'REQUIREMENT_UPDATED', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-req-matching-closed', eventType: 'REQUIREMENT_CLOSED', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-cand-matching-created', eventType: 'CANDIDATE_CREATED', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-cand-matching-updated', eventType: 'CANDIDATE_UPDATED', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-cand-matching-withdrawn', eventType: 'CANDIDATE_WITHDRAWN', subscriber: 'matching-office', priority: 10, enabled: true },
            { id: 'sub-resume-uploaded', eventType: 'RESUME_UPLOADED', subscriber: 'ResumeScreeningService', priority: 10, enabled: true },
            { id: 'sub-cand-matched', eventType: 'CANDIDATE_MATCHED', subscriber: 'ClientOffice', priority: 10, enabled: true },
            { id: 'sub-cand-shortlisted', eventType: 'CANDIDATE_SHORTLISTED', subscriber: 'RecruitmentOffice', priority: 10, enabled: true },
            { id: 'sub-cand-submitted', eventType: 'CANDIDATE_SUBMITTED', subscriber: 'SubmissionOrchestrator', priority: 10, enabled: true },
            { id: 'sub-interview-scheduling', eventType: 'INTERVIEW_REQUESTED', subscriber: 'scheduling-office', priority: 10, enabled: true }
        ];
        
        for (const sub of defaultSubs) {
            await db.collection('event_subscriptions').doc(sub.id).set(sub);
        }
        console.log('[EventBus] Successfully seeded event subscription registry.');
    }

    // Register business events and route to appropriate agents
    static async publish(type: string, payload: any, source: string = 'SYSTEM', orgId?: string, traceContext?: {
        traceId?: string;
        correlationId?: string;
        parentCorrelationId?: string;
        causationId?: string;
    }) {
        if (!db) return;

        const eventId = `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const traceId = traceContext?.traceId || payload?.traceId || `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const causationId = traceContext?.causationId || payload?.eventId || "";
        const correlationId = traceContext?.correlationId || `EV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const entityId = payload?.id || payload?.requirementId || payload?.candidateId || payload?.matchId || payload?.submissionId || 'unknown';
        
        // Derive entityType heuristically from event type
        const entityType = type.split('_')[0] || 'UNKNOWN';

        const event: BusinessEvent = {
            eventId,
            eventType: type, // standard field
            type, // legacy
            eventVersion: 1,
            correlationId,
            causationId,
            entityType,
            entityId,
            tenantId: orgId || payload?.orgId || payload?.organizationId || 'GLOBAL',
            source,
            priority: 'NORMAL', // Default priority, AI COO can adjust
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            retryCount: 0,
            traceId,
            payload,
            metadata: {
                parentCorrelationId: traceContext?.parentCorrelationId || payload?.correlationId || ""
            },
            orgId: orgId || payload?.orgId || payload?.organizationId || 'GLOBAL' // legacy
        };

        // 1. Record the event in the events collection
        await db.collection('business_events').doc(event.eventId).set(event);

        // Record to system_runtime if running
        try {
            const runtimeDoc = await db.collection('system_runtime').doc('state').get();
            if (runtimeDoc.exists && runtimeDoc.data()?.status === 'LIVE') {
                const timestamp = new Date();
                await db.collection('system_logs').add({
                    timestamp: timestamp.toISOString(),
                    time: timestamp.toLocaleTimeString(),
                    type: 'Event Bus',
                    text: `Published event: ${type} (ID: ${event.eventId})`,
                    trace: event.traceId || event.eventId || 'TR-EVENT'
                });

                if (type === 'REQUIREMENT_CREATED') {
                    const { triggerAutonomousSequence } = await import('../handlers/ops.js');
                    triggerAutonomousSequence(event).catch(e => console.error('[EventBus] Autonomous sequence error', e));
                }
            }
        } catch (err) {
            console.warn('[EventBus] Failed tracking runtime logs', err);
        }

        const { FeatureFlags } = await import('../os/kernel/FeatureFlags.js');
        if (FeatureFlags.OUTBOX_PATTERN_ENABLED) {
            // Write to Outbox instead of direct queueing
            await db.collection('outbox_events').doc(event.eventId).set({
                event,
                status: 'PENDING',
                createdAt: new Date().toISOString()
            });

            // Trigger Outbox Dispatcher
            const { OutboxDispatcher } = await import('../os/kernel/OutboxDispatcher.js');
            OutboxDispatcher.dispatchOutbox().catch(e => console.error('[EventBus] Outbox trigger failed', e));
        } else {
            await this.publishInternal(event);
        }

        return event.eventId;
    }

    static async publishInternal(event: BusinessEvent) {
        if (!db) return;

        try {
            // Ensure default subscriptions are registered
            await this.ensureDefaultSubscriptions();

            // Evaluate Automation Kill Switch
            try {
                const { AutomationKillSwitchService } = await import('./AutomationKillSwitchService.js');
                const ksCheck = await AutomationKillSwitchService.evaluateKillSwitch({
                    workflowId: event.eventType,
                    tenantId: event.tenantId || 'GLOBAL',
                    agentId: event.payload?.agentId || event.source,
                    actorId: event.payload?.actorId,
                    eventId: event.eventId
                });
                if (ksCheck.blocked) {
                    console.warn(`[EventBus] Dispatch for event ${event.eventId} (${event.eventType}) BLOCKED by Kill Switch: ${ksCheck.reason}`);
                    return;
                }
            } catch (ksErr: any) {
                console.warn('[EventBus] Fail-Closed Kill Switch check triggered:', ksErr.message);
                return;
            }

            // Fetch all active event subscriptions
            const subSnap = await db.collection('event_subscriptions')
                .where('enabled', '==', true)
                .get();

            if (subSnap.empty) {
                console.warn('[EventBus] No active subscriptions found in registry.');
                return;
            }

            // Map and filter for the event's type or wildcard '*'
            const subscriptions = subSnap.docs.map(doc => doc.data());
            const matchingSubs = subscriptions.filter(sub => 
                sub.eventType === event.eventType || sub.eventType === '*'
            );

            // Sort by priority (highest first)
            matchingSubs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            console.log(`[EventBus] Dispatching event ${event.eventType} to ${matchingSubs.length} matching subscribers:`, 
                matchingSubs.map(s => s.subscriber)
            );

            // Execute subscriptions
            for (const sub of matchingSubs) {
                try {
                    if (sub.subscriber === 'AICOORuntime') {
                        const { AICOORuntime } = await import('../os/kernel/AICOORuntime.js');
                        await AICOORuntime.enqueueEvent(event);
                    } else if (sub.subscriber === 'GraphProjectionWorker') {
                        const { GraphProjectionWorker } = await import('../os/kernel/GraphProjectionWorker.js');
                        await GraphProjectionWorker.queueProjection(event);
                    } else if (sub.subscriber === 'matching-office') {
                        const { MatchingOffice } = await import('./MatchingOffice.js');
                        await MatchingOffice.handleEvent(event.eventType, event.payload, event.tenantId);
                    } else if (sub.subscriber === 'scheduling-office') {
                        const { SchedulingOffice } = await import('./SchedulingOffice.js');
                        await SchedulingOffice.handleEvent(event.eventType, event.payload, event.tenantId);
                    } else {
                        console.log(`[EventBus] Dynamically routing event ${event.eventId} to AgentOrchestrator queue for: ${sub.subscriber}`);
                        await AgentOrchestrator.enqueueJob(sub.subscriber, { eventType: event.eventType, payload: event.payload, orgId: event.tenantId });
                    }
                } catch (err) {
                    console.error(`[EventBus] Failed to dispatch event to subscriber ${sub.subscriber}:`, err);
                }
            }
        } catch (error) {
            console.error('[EventBus] Error in publishInternal router:', error);
        }
    }
}
