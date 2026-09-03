import { db } from '../../lib/firebase-admin.js';
import { EventBus } from './EventBus.js';
import { BusinessGraphService } from './BusinessGraphService.js';
import { ProprietaryMatchingEngine } from './ProprietaryMatchingEngine.js';

export class MatchingOffice {
    
    private static withTimeout<T>(promise: Promise<T>, timeoutMs: number = 60000, context: string = "Matching Task"): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`[MatchingOffice Timeout] ${context} exceeded safety timeout of ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Entry point for handling business events.
     */
    static async handleEvent(type: string, payload: any, orgId?: string) {
        if (!db) return;
        
        console.log(`[MatchingOffice] Processing event ${type} in Matching Office...`);
        
        try {
            switch (type) {
                case 'REQUIREMENT_CREATED':
                case 'REQUIREMENT_UPDATED': {
                    const reqId = payload.requirementId || payload.id;
                    const candId = payload.candidateId;
                    if (reqId && candId) {
                        await this.withTimeout((async () => {
                            const reqDoc = await db.collection("requirements_public").doc(reqId).get();
                            const candDoc = await db.collection("candidatePool").doc(candId).get();
                            if (reqDoc.exists && candDoc.exists) {
                                await this.computeAndSaveMatch({ id: candDoc.id, ...candDoc.data() }, { id: reqDoc.id, ...reqDoc.data() });
                                await this.updateRequirementMatchIndex(reqId);
                            }
                        })(), 60000, `Singular match run for req ${reqId} and cand ${candId}`);
                    } else if (reqId) {
                        await this.withTimeout(this.matchRequirement(reqId, orgId), 60000, `Requirement matching for ${reqId}`);
                    }
                    break;
                }
                    
                case 'CANDIDATE_PARSED':
                case 'CANDIDATE_CREATED':
                case 'CANDIDATE_UPDATED': {
                    const candId = payload.candidateId || payload.id;
                    if (candId) {
                        await this.withTimeout(this.matchCandidate(candId, orgId), 60000, `Candidate matching for ${candId}`);
                    }
                    break;
                }

                case 'CANDIDATE_MATCH':
                case 'MATCH_REQUESTED': {
                    const reqId = payload.requirementId || payload.id;
                    const candId = payload.candidateId;
                    if (reqId && candId) {
                        await this.withTimeout((async () => {
                            const reqDoc = await db.collection("requirements_public").doc(reqId).get();
                            const candDoc = await db.collection("candidatePool").doc(candId).get();
                            if (reqDoc.exists && candDoc.exists) {
                                await this.computeAndSaveMatch({ id: candDoc.id, ...candDoc.data() }, { id: reqDoc.id, ...reqDoc.data() });
                                await this.updateRequirementMatchIndex(reqId);
                            }
                        })(), 60000, `Singular match run for req ${reqId} and cand ${candId}`);
                    } else if (reqId) {
                        await this.withTimeout(this.matchRequirement(reqId, orgId), 60000, `Requirement matching for ${reqId}`);
                    } else if (candId) {
                        await this.withTimeout(this.matchCandidate(candId, orgId), 60000, `Candidate matching for ${candId}`);
                    }
                    break;
                }
                    
                case 'REQUIREMENT_CLOSED': {
                    const reqId = payload.requirementId || payload.id;
                    if (reqId) {
                        await this.cleanupRequirementMatches(reqId);
                    }
                    break;
                }
                    
                case 'CANDIDATE_WITHDRAWN': {
                    const candId = payload.candidateId || payload.id;
                    if (candId) {
                        await this.cleanupCandidateMatches(candId);
                    }
                    break;
                }
                    
                default:
                    console.log(`[MatchingOffice] Event type ${type} ignored by Matching Office.`);
            }
        } catch (error) {
            console.error(`[MatchingOffice] Error handling event ${type}:`, error);
        }
    }

    private static async computeAndSaveMatch(cand: any, reqObj: any) {
        if (!db) return null;

        // Check if candidate is active/eligible
        const isArchived = cand.status === "archived" || cand.isArchived;
        const isDeleted =
            cand.status === "deleted" ||
            cand.status === "DELETED" ||
            cand.isDeleted ||
            cand.isActive === false ||
            cand.active === false;
        const isBlacklisted = cand.status === "blacklisted" || cand.isBlacklisted;

        if (isArchived || isDeleted || isBlacklisted) {
            return null;
        }

        // Check if requirement is closed or inactive
        const reqIsClosed = reqObj.status === "CLOSED" || reqObj.status === "ARCHIVED";
        if (reqIsClosed) {
            return null;
        }

        try {
            // Invoke HN-016 Proprietary Matching Engine
            const engineResult = await ProprietaryMatchingEngine.calculateMatch(
                cand.id, 
                reqObj.id, 
                reqObj.tenantId || reqObj.orgId || "GLOBAL"
            );

            const mScore = engineResult.compositeScore;

            if (mScore > 0) {
                const matchResult = {
                    canonicalRequirementId: reqObj.id,
                    requirementId: reqObj.id,
                    tenantId: reqObj.tenantId || reqObj.orgId || cand.tenantId || "TENANT-HQ",
                    matchScore: mScore,
                    matchTier: engineResult.tier || "WEAK_MATCH",
                    summary: engineResult.reasoning || "AI Match Generated",
                    strengths: engineResult.matchedSkills || [], 
                    missingSkills: engineResult.missingMandatorySkills || [],
                    matchedSkills: engineResult.matchedSkills || [],
                    missingMandatorySkills: engineResult.missingMandatorySkills || [],
                    missingPreferredSkills: engineResult.missingPreferredSkills || [],
                    experienceGaps: engineResult.experienceGaps || [],
                    riskFlags: engineResult.riskFlags || [],
                    breakdown: {
                        skillsScore: engineResult.deterministicScore || 0,
                        experienceScore: engineResult.deterministicScore || 0,
                        semanticScore: engineResult.semanticScore >= 0 ? engineResult.semanticScore : 0,
                        businessScore: engineResult.businessScore || 0,
                    },
                    suggestedAction: engineResult.suggestedAction || "RECRUITER_REVIEW",
                    aiScreeningStatus: engineResult.aiScreeningStatus || "COMPLETED"
                };

                const matchId = `${cand.id}_${reqObj.id}`;
                const vendorId = cand.vendorId || cand.orgId || "UNKNOWN";
                const effectiveOrgId = reqObj.orgId || cand.orgId || vendorId || "GLOBAL";
                
                const matchDocRef = db.collection("candidate_matches").doc(matchId);
                const existingMatch = await matchDocRef.get();
                const isNew = !existingMatch.exists;

                const matchPayload = {
                    ...matchResult,
                    candidateId: cand.id,
                    vendorId: vendorId,
                    orgId: cand.orgId || vendorId || "SYSTEM",
                    source: "PROPRIETARY_MATCHING_ENGINE_V1",
                    generatedAt: new Date().toISOString(),
                };

                await matchDocRef.set(matchPayload);

                // Update Business Graph Relationship (Candidate Match link)
                try {
                    await BusinessGraphService.addRelationship(
                        cand.id, 
                        reqObj.id, 
                        'MATCHED', 
                        { score: mScore, confidence: mScore / 100, tenantId: effectiveOrgId }
                    );
                } catch (graphErr) {
                    console.warn(`[MatchingOffice] Failed to update Business Graph for ${cand.id} <-> ${reqObj.id}:`, graphErr);
                }

                // Publish Event
                const eventType = isNew ? 'MATCH_CREATED' : 'MATCH_UPDATED';
                await EventBus.publish(eventType, {
                    matchId,
                    candidateId: cand.id,
                    requirementId: reqObj.id,
                    matchScore: mScore,
                    summary: matchResult.summary
                }, 'MATCHING_OFFICE', effectiveOrgId);

                // Publish MATCH_COMPLETED event
                await EventBus.publish('MATCH_COMPLETED', {
                    candidateId: cand.id,
                    requirementId: reqObj.id,
                    matchId,
                    score: mScore,
                    matchStatus: matchResult.suggestedAction || "RECRUITER_REVIEW"
                }, 'MATCHING_OFFICE', effectiveOrgId);

                return matchPayload;
            }
        } catch (err) {
            console.error(`[MatchingOffice] Error computing match for ${cand.id} and ${reqObj.id}:`, err);
        }
        return null;
    }

    static async matchRequirement(requirementId: string, orgId?: string) {
        if (!db) return;
        
        console.log(`[MatchingOffice] Matching all candidates against requirement: ${requirementId}`);
        
        const reqDoc = await db.collection("requirements_public").doc(requirementId).get();
        if (!reqDoc.exists) {
            console.warn(`[MatchingOffice] Requirement ${requirementId} not found.`);
            return;
        }
        
        const reqObj = { id: reqDoc.id, ...reqDoc.data() };
        
        // Fetch all active candidates
        const activeCandidates = await db.collection("candidatePool").get();
        const candidates = activeCandidates.docs.map(d => ({ id: d.id, ...d.data() }));
        
        for (const cand of candidates) {
            await this.computeAndSaveMatch(cand, reqObj);
        }
        
        // Update requirement match index
        await this.updateRequirementMatchIndex(requirementId);
    }

    static async matchCandidate(candidateId: string, orgId?: string) {
        if (!db) return;
        
        console.log(`[MatchingOffice] Matching candidate: ${candidateId} against all active requirements`);
        
        const candDoc = await db.collection("candidatePool").doc(candidateId).get();
        if (!candDoc.exists) {
            console.warn(`[MatchingOffice] Candidate ${candidateId} not found.`);
            return;
        }
        
        const candObj = { id: candDoc.id, ...candDoc.data() };
        
        // Fetch all active/open requirements
        const reqSnapshot = await db.collection("requirements_public")
            .where("status", "in", ["PUBLISHED", "ACTIVE", "OPEN"])
            .get();
            
        const requirements = reqSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        for (const reqObj of requirements) {
            await this.computeAndSaveMatch(candObj, reqObj);
            // Update requirement match index
            await this.updateRequirementMatchIndex(reqObj.id);
        }
    }

    static async cleanupRequirementMatches(requirementId: string) {
        if (!db) return;
        
        console.log(`[MatchingOffice] Cleaning up matches for requirement: ${requirementId}`);
        
        const oldMatches = await db.collection("candidate_matches")
            .where("requirementId", "==", requirementId)
            .get();
            
        for (const doc of oldMatches.docs) {
            const data = doc.data();
            await doc.ref.delete();
            
            // Publish Match Removed
            await EventBus.publish('MATCH_REMOVED', {
                matchId: doc.id,
                candidateId: data.candidateId,
                requirementId: requirementId
            }, 'MATCHING_OFFICE', data.orgId);
        }
        
        // Remove requirement match index
        await db.collection("requirement_match_index").doc(requirementId).delete().catch(() => {});
    }

    static async cleanupCandidateMatches(candidateId: string) {
        if (!db) return;
        
        console.log(`[MatchingOffice] Cleaning up matches for candidate: ${candidateId}`);
        
        const oldMatches = await db.collection("candidate_matches")
            .where("candidateId", "==", candidateId)
            .get();
            
        const affectedReqIds = new Set<string>();
        
        for (const doc of oldMatches.docs) {
            const data = doc.data();
            await doc.ref.delete();
            if (data.requirementId) {
                affectedReqIds.add(data.requirementId);
            }
            
            // Publish Match Removed
            await EventBus.publish('MATCH_REMOVED', {
                matchId: doc.id,
                candidateId: candidateId,
                requirementId: data.requirementId
            }, 'MATCHING_OFFICE', data.orgId);
        }
        
        // Update affected requirement indices
        for (const reqId of affectedReqIds) {
            await this.updateRequirementMatchIndex(reqId);
        }
    }

    private static async updateRequirementMatchIndex(requirementId: string) {
        if (!db) return;
        
        const matchesSnap = await db.collection("candidate_matches")
            .where("requirementId", "==", requirementId)
            .get();
            
        let topScore = 0;
        let totalMatches = matchesSnap.size;
        matchesSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.matchScore > topScore) topScore = data.matchScore;
        });
        
        await db.collection("requirement_match_index").doc(requirementId).set({
            requirementId: requirementId,
            totalMatches: totalMatches,
            topMatchScore: topScore,
            lastCalculated: new Date().toISOString(),
        });
    }
}
