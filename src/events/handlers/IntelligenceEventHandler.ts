import { IEventBus } from '../IEventBus';
import { IEventHandler } from '../EventHandlerRegistry';
import { EventEnvelope } from '../types/EventEnvelope';
import { EventTypes } from '../../lib/events/EventTypes';
import { HIE } from '../../platform/intelligence';

export class IntelligenceEventHandler implements IEventHandler {
  handlerId = 'IntelligenceEventHandler';

  register(eventBus: IEventBus): void {
    // Reactive Event Bus Subscriptions
    eventBus.subscribe('CandidateUploaded', this.handlerId, this.handleCandidateUploaded.bind(this, eventBus));
    eventBus.subscribe('JobPublished', this.handlerId, this.handleRequirementCreated.bind(this, eventBus));
    eventBus.subscribe(EventTypes.SUBMISSION_CREATED, this.handlerId, this.handleSubmissionCreated.bind(this, eventBus));
    eventBus.subscribe(EventTypes.INTERVIEW_SCHEDULED, this.handlerId, this.handleInterviewScheduled.bind(this, eventBus));
  }

  private async handleCandidateUploaded(eventBus: IEventBus, event: EventEnvelope<any>): Promise<void> {
    const candidateId = event.payload?.candidateId || event.payload?.id || event.id;
    console.log(`[IntelligenceEventHandler] Reactive HIE Evaluation on CandidateUploaded: ${candidateId}`);
    try {
      const evalResult = await HIE.evaluateCandidate(candidateId);
      eventBus.publish({
        id: `hie-evt-${Date.now()}`,
        type: 'HIE_CANDIDATE_EVALUATED',
        timestamp: new Date().toISOString(),
        tenantId: event.tenantId || 'system',
        payload: { candidateId, evaluation: evalResult },
      });
    } catch (err: any) {
      console.warn(`[IntelligenceEventHandler] Candidate evaluation warning: ${err.message}`);
    }
  }

  private async handleRequirementCreated(eventBus: IEventBus, event: EventEnvelope<any>): Promise<void> {
    const requirementId = event.payload?.requirementId || event.payload?.id || event.id;
    console.log(`[IntelligenceEventHandler] Reactive HIE Evaluation on RequirementCreated: ${requirementId}`);
    try {
      const evalResult = await HIE.evaluateRequirement(requirementId);
      eventBus.publish({
        id: `hie-evt-${Date.now()}`,
        type: 'HIE_REQUIREMENT_EVALUATED',
        timestamp: new Date().toISOString(),
        tenantId: event.tenantId || 'system',
        payload: { requirementId, evaluation: evalResult },
      });
    } catch (err: any) {
      console.warn(`[IntelligenceEventHandler] Requirement evaluation warning: ${err.message}`);
    }
  }

  private async handleSubmissionCreated(eventBus: IEventBus, event: EventEnvelope<any>): Promise<void> {
    const submissionId = event.payload?.submissionId || event.payload?.id || event.id;
    console.log(`[IntelligenceEventHandler] Reactive HIE Evaluation on SubmissionCreated: ${submissionId}`);
    try {
      const evalResult = await HIE.evaluateSubmission(submissionId);
      eventBus.publish({
        id: `hie-evt-${Date.now()}`,
        type: 'HIE_SUBMISSION_EVALUATED',
        timestamp: new Date().toISOString(),
        tenantId: event.tenantId || 'system',
        payload: { submissionId, evaluation: evalResult },
      });
    } catch (err: any) {
      console.warn(`[IntelligenceEventHandler] Submission evaluation warning: ${err.message}`);
    }
  }

  private async handleInterviewScheduled(eventBus: IEventBus, event: EventEnvelope<any>): Promise<void> {
    const entityId = event.payload?.candidateId || event.payload?.submissionId || event.id;
    console.log(`[IntelligenceEventHandler] Reactive HIE NextBestAction on InterviewScheduled: ${entityId}`);
    try {
      const nbaResult = await HIE.nextBestAction('INTERVIEW', entityId);
      eventBus.publish({
        id: `hie-evt-${Date.now()}`,
        type: 'HIE_NEXT_BEST_ACTION_GENERATED',
        timestamp: new Date().toISOString(),
        tenantId: event.tenantId || 'system',
        payload: { entityId, nextBestAction: nbaResult },
      });
    } catch (err: any) {
      console.warn(`[IntelligenceEventHandler] NBA generation warning: ${err.message}`);
    }
  }
}
