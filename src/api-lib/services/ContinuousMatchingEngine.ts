import { db } from '../../lib/firebase-admin.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';

/**
 * ContinuousMatchingEngine is a living matching engine. 
 * It runs every 15 minutes (via Enterprise Scheduler) and recalibrates the network.
 * 
 * Loop: Open Requirements -> Active Candidates -> Existing Vendors -> Updated Resumes -> 
 * Interview Feedback -> Recalculate Match Scores -> Generate Opportunities -> Notify Offices.
 */
export class ContinuousMatchingEngine {
    
    static async executeNetworkMatchCycle() {
        if (!db) return;
        
        console.log(`[Continuous Matching] Executing network-wide recalibration...`);
        
        // 1. Identify open, stalled requirements (e.g. no new submissions in 48 hours)
        const stalledReqs = await db.collection('requirements_public')
            .where('status', '==', 'OPEN')
            // Add other filters as needed to detect "stalled"
            .limit(50)
            .get();
            
        // 2. Identify candidates needing opportunities (e.g. bench aging > 14 days)
        const agingCandidates = await db.collection('candidatePool')
            .where('status', '==', 'AVAILABLE')
            .limit(50)
            .get();
            
        // 3. For each stalled requirement, we can queue a deep matching job
        for (const req of stalledReqs.docs) {
            await AgentOrchestrator.enqueueJob('NETWORK_DEEP_MATCH', {
                requirementId: req.id,
                trigger: 'STALLED_REQUIREMENT',
                timestamp: new Date().toISOString()
            }, 'medium');
        }
        
        // 4. Update the AI COO that a network calibration was started
        console.log(`[Continuous Matching] Queued ${stalledReqs.docs.length} deep matches.`);
        
        return {
            stalledRequirementsFound: stalledReqs.docs.length,
            agingCandidatesFound: agingCandidates.docs.length
        };
    }
    
    /**
     * The Candidate Improvement Loop
     * 
     * Candidate Rejected -> Capture Feedback -> Update Candidate Memory -> 
     * Resume Improvement Agent -> Skill Gap Analysis -> Learning Recommendations -> 
     * Vendor Notification -> Re-match Against Open Requirements
     */
    static async triggerCandidateImprovementLoop(candidateId: string, rejectionReason: string) {
        if (!db) return;
        
        console.log(`[Continuous Matching] Triggering Candidate Improvement Loop for ${candidateId}`);
        
        await AgentOrchestrator.enqueueJob('CANDIDATE_IMPROVEMENT_AGENT', {
            candidateId,
            rejectionReason,
            timestamp: new Date().toISOString()
        }, 'high');
    }

    /**
     * The Requirement Improvement Loop
     * 
     * Requirement -> Low Match Rate -> Analyze JD -> Suggest Better Skills / Budget / Experience -> 
     * Recommend Additional Vendors -> Broadcast Again.
     */
    static async triggerRequirementImprovementLoop(requirementId: string) {
        if (!db) return;
        
        console.log(`[Continuous Matching] Triggering Requirement Improvement Loop for ${requirementId}`);
        
        await AgentOrchestrator.enqueueJob('REQUIREMENT_IMPROVEMENT_AGENT', {
            requirementId,
            timestamp: new Date().toISOString()
        }, 'high');
    }
}
