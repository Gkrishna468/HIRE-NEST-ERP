import { adminDb } from '../../lib/firebase-admin.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'PAUSED';

export interface WorkflowInstance {
    workflowId: string;
    type: string;
    status: WorkflowStatus;
    input: any;
    state: any;
    history: any[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
    currentStep?: string;
    retryCount?: number;
}

export class TemporalEngine {
    constructor() {}

    /**
     * Start a durable workflow
     */
    async startWorkflow(type: string, input: any, workflowId?: string) {
        const id = workflowId || crypto.randomUUID();
        const docRef = adminDb.collection('workflows').doc(id);
        
        await docRef.set({
            workflowId: id,
            type,
            status: 'RUNNING',
            input,
            state: {},
            history: [{
                type: 'WorkflowExecutionStarted',
                timestamp: FieldValue.serverTimestamp(),
                details: 'Workflow initiated.'
            }],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            currentStep: 'INITIALIZE',
            retryCount: 0
        });

        // Trigger step progression immediately
        this.advanceWorkflow(id).catch(err => console.error(`Failed to advance ${id}:`, err));
        
        return id;
    }

    /**
     * Engine loop processor (simulated durability)
     */
    async advanceWorkflow(workflowId: string) {
        const docRef = adminDb.collection('workflows').doc(workflowId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return;

        const wf = docSnap.data() as WorkflowInstance;
        if (wf.status !== 'RUNNING') return; // Only process running workflows

        try {
            // Load the specific workflow definition
            const definition = WorkflowRegistry[wf.type];
            if (!definition) throw new Error(`Unknown workflow type: ${wf.type}`);

            // Execute the current step
            const result = await definition.executeStep(wf.currentStep!, wf.state, wf.input, workflowId);
            
            if (result.status === 'COMPLETED') {
                await docRef.update({
                    status: 'COMPLETED',
                    state: result.state || wf.state,
                    updatedAt: FieldValue.serverTimestamp(),
                    history: FieldValue.arrayUnion({
                        type: 'WorkflowExecutionCompleted',
                        timestamp: FieldValue.serverTimestamp(),
                        details: 'Workflow ran to completion.'
                    })
                });
            } else if (result.status === 'CONTINUE_AS_NEW') {
                await docRef.update({
                    currentStep: result.nextStep,
                    state: result.state || wf.state,
                    updatedAt: FieldValue.serverTimestamp(),
                    retryCount: 0,
                    history: FieldValue.arrayUnion({
                        type: 'ActivityTaskCompleted',
                        timestamp: FieldValue.serverTimestamp(),
                        step: wf.currentStep,
                        details: `Advanced to ${result.nextStep}`
                    })
                });
                // Recursive advance for next step (in a real system, this would be queue-driven)
                setTimeout(() => this.advanceWorkflow(workflowId), 0);
            } else if (result.status === 'AWAIT_SIGNAL') {
                await docRef.update({
                    status: 'PAUSED', // Waits for an external event to wake it up
                    currentStep: result.nextStep,
                    state: result.state || wf.state,
                    updatedAt: FieldValue.serverTimestamp(),
                    history: FieldValue.arrayUnion({
                        type: 'TimerStarted',
                        timestamp: FieldValue.serverTimestamp(),
                        details: `Awaiting external signal for step ${result.nextStep}`
                    })
                });
            }
        } catch (error: any) {
            console.error(`Workflow ${workflowId} failed at ${wf.currentStep}:`, error);
            
            if ((wf.retryCount || 0) < 3) { // Durable retries
                await docRef.update({
                    retryCount: FieldValue.increment(1),
                    updatedAt: FieldValue.serverTimestamp(),
                    history: FieldValue.arrayUnion({
                        type: 'ActivityTaskFailed',
                        timestamp: FieldValue.serverTimestamp(),
                        details: `Step ${wf.currentStep} failed: ${error.message}. Retrying...`
                    })
                });
                // Exponential backoff
                const backoff = Math.pow(2, wf.retryCount || 0) * 1000;
                setTimeout(() => this.advanceWorkflow(workflowId), backoff);
            } else {
                await docRef.update({
                    status: 'FAILED',
                    updatedAt: FieldValue.serverTimestamp(),
                    history: FieldValue.arrayUnion({
                        type: 'WorkflowExecutionFailed',
                        timestamp: FieldValue.serverTimestamp(),
                        details: `Max retries reached. Error: ${error.message}`
                    })
                });
                
                // Write to escalation engine
                await adminDb.collection('execution_events').add({
                    eventType: 'WORKFLOW_FAILED_ESCALATION',
                    targetType: 'workflow',
                    targetId: workflowId,
                    metadata: { type: wf.type, step: wf.currentStep, error: error.message },
                    timestamp: FieldValue.serverTimestamp(),
                    actorId: 'temporal-system',
                    actorType: 'system'
                });
            }
        }
    }

    /**
     * Signal a waiting workflow to resume
     */
    async signalWorkflow(workflowId: string, signalName: string, signalData: any) {
        const docRef = adminDb.collection('workflows').doc(workflowId);
        await docRef.update({
            status: 'RUNNING',
            updatedAt: FieldValue.serverTimestamp(),
            [`state.signals.${signalName}`]: signalData,
            history: FieldValue.arrayUnion({
                type: 'WorkflowExecutionSignaled',
                timestamp: FieldValue.serverTimestamp(),
                details: `Received signal: ${signalName}`
            })
        });
        
        // Wake up loop
        this.advanceWorkflow(workflowId).catch(err => console.error(`Signal resume failed:`, err));
    }
}

export const WorkflowRegistry: Record<string, any> = {};
export const temporal = new TemporalEngine();
