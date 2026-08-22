import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { emitEvent } from "../../services/eventBus";

export interface SubmissionRequest {
  candidateData: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    resumeHash?: string;
    resumeText?: string;
    skills?: string[];
    [key: string]: any;
  };
  requirementId: string;
  clientId: string;
  vendorId: string;
  submitterId: string; // The user making the submission
  initialStatus?: string;
  matchScore?: number;
  aiAnalysis?: any;
  bypassOwnershipCheck?: boolean;
}

export interface SubmissionResponse {
  success: boolean;
  message: string;
  candidateId?: string;
  submissionId?: string;
  error?: string;
  ownershipDetails?: any;
}

export class SubmissionOrchestrator {
  /**
   * Generates a unique fingerprint for a candidate
   */
  static generateFingerprint(
    email?: string,
    phone?: string,
    resumeHash?: string,
  ): string {
    const parts = [];
    if (email) parts.push(email.toLowerCase().trim());
    if (phone) parts.push(phone.replace(/\D/g, ""));
    if (resumeHash) parts.push(resumeHash);

    if (parts.length === 0) return crypto.randomUUID();
    return parts.join("|");
  }

  /**
   * Main authoritative entry point for creating a submission.
   */
  static async submitCandidate(
    request: SubmissionRequest,
  ): Promise<SubmissionResponse> {
    try {
      const {
        candidateData,
        requirementId,
        clientId,
        vendorId,
        submitterId,
        initialStatus = "SUBMITTED",
        matchScore = 0,
        aiAnalysis,
      } = request;

      console.log("Submission Request Start:", {
        candidateId: candidateData.id,
        requirementId,
        clientId,
        vendorId,
      });

      const fingerprint = this.generateFingerprint(
        candidateData.email,
        candidateData.phone,
        candidateData.resumeHash,
      );

      // 1. Identify Candidate
      let candidateId = candidateData.id;

      if (!candidateId) {
        // Condition 1: Same Resume fingerprint (hash)
        if (candidateData.resumeHash) {
          try {
            console.log("STEP 1A: Query candidatePool by resumeHash");
            const hashQ = query(
              collection(db, "candidatePool"),
              where("resumeHash", "==", candidateData.resumeHash),
            );
            const hashSnap = await getDocs(hashQ);
            if (!hashSnap.empty) {
               candidateId = hashSnap.docs[0].id; // Exact fingerprint match merges identity universally or should it be vendor scoped? "OR Resume fingerprint match > 95%"
               console.log("STEP 1A SUCCESS: Fingerprint Match");
            }
          } catch (e) {
            console.error("STEP 1A FAILED", e);
            throw e;
          }
        }

        // Condition 2: Same vendor AND Same email AND Same phone
        if (!candidateId && candidateData.email && candidateData.phone) {
          try {
            console.log("STEP 1B: Query candidatePool by email, phone, and vendor");
            const emailQ = query(
              collection(db, "candidatePool"),
              where("email", "==", candidateData.email.toLowerCase().trim()),
              where("vendorId", "==", vendorId)
            );
            const emailSnap = await getDocs(emailQ);
            if (!emailSnap.empty) {
              const incomingPhone = candidateData.phone.replace(/\D/g, "");
              for (const doc of emailSnap.docs) {
                 const docPhone = (doc.data().phone || "").replace(/\D/g, "");
                 if (docPhone === incomingPhone && incomingPhone !== "") {
                    candidateId = doc.id;
                    console.log("STEP 1B SUCCESS: Vendor + Email + Phone Match");
                    break;
                 }
              }
            }
          } catch (e) {
            console.error("STEP 1B FAILED", e);
            throw e;
          }
        }
      }

      // 2. Determine Ownership
      if (candidateId) {
        try {
          console.log("STEP 2: Query candidateOwnership");
          const { CandidateOwnershipEngine } = await import("./CandidateOwnershipEngine");
          const ownershipCheck = await CandidateOwnershipEngine.verifyOwnershipAndCheckConflicts(candidateId, vendorId);
          
          if (!ownershipCheck.canProceed && !request.bypassOwnershipCheck && vendorId !== "HQ") {
              return {
                success: false,
                message: `Candidate is owned by another vendor.`,
                ownershipDetails: { owner: ownershipCheck.lockedBy, expiresAt: ownershipCheck.lockUntil },
              };
          }
          console.log("STEP 2 SUCCESS");
        } catch (e) {
          console.error("STEP 2 FAILED", e);
          throw e;
        }
      }

      // 3. Create or Update Candidate
      if (!candidateId) {
        // Create new candidate in candidatePool (Source of truth for identity)
        const { auth } = await import("../../lib/firebase");
        let currentUserUid = auth.currentUser?.uid;
        let currentOrganizationId = "UNKNOWN";
        if (currentUserUid) {
          try {
            console.log("STEP 3A: getDoc user profile");
            const { getDoc } = await import("firebase/firestore");
            const userDoc = await getDoc(doc(db, "users", currentUserUid));
            if (userDoc.exists()) {
              currentOrganizationId = userDoc.data().organizationId;
            }
            console.log("STEP 3A SUCCESS");
          } catch (e) {
            console.error("STEP 3A FAILED", e);
            throw e;
          }
        }
        console.log("CANDIDATE CREATE PAYLOAD", {
          vendorId,
          clientId,
          currentUserUid,
          currentOrganizationId,
        });
        let newCandRef;
        try {
          console.log("STEP 3B: addDoc candidatePool");
          newCandRef = await addDoc(collection(db, "candidatePool"), {
            name: candidateData.name,
            fullName: candidateData.name,
            manualName: candidateData.name,
            email: candidateData.email || "",
            phone: candidateData.phone || "",
            resumeHash: candidateData.resumeHash || "",
            resumeText: candidateData.resumeText || "",
            fingerprint: fingerprint,
            SystemSource: "ORCHESTRATOR",
            vendorId: vendorId,
            clientId: clientId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log("STEP 3B SUCCESS", newCandRef.id);
        } catch (e) {
          console.error("STEP 3B FAILED", e);
          throw e;
        }
        candidateId = newCandRef.id;

        try {
          // Write candidateId back to document for easier querying
          console.log("STEP 3C: updateDoc candidateId");
          await updateDoc(newCandRef, { candidateId });
          console.log("STEP 3C SUCCESS");
        } catch (e) {
          console.error("STEP 3C FAILED", e);
          throw e;
        }
      }

      // 4. Idempotency & Duplicate Submission check
      const idempotencyKey = `${candidateId}_${requirementId}`;
      let subSnap;
      try {
        console.log("STEP 4: query submissions");
        const subQ = query(
          collection(db, "submissions"),
          where("idempotencyKey", "==", idempotencyKey),
        );
        subSnap = await getDocs(subQ);
        console.log("STEP 4 SUCCESS");
      } catch (e) {
        console.error("STEP 4 FAILED", e);
        throw e;
      }

      // 4.5. Fetch candidate name and req title to prevent undefined in logs
      let candidateName = candidateData.name || candidateData.fullName;
      if (candidateId && (!candidateName || candidateName === "Unknown" || candidateName === "Anonymous")) {
         try {
             const { getDoc, doc } = await import("firebase/firestore");
             const candSnap = await getDoc(doc(db, "candidatePool", candidateId));
             if (candSnap.exists()) {
                 candidateName = candSnap.data().name || candSnap.data().fullName || candSnap.data().manualName;
             }
         } catch (e) {
             console.error("Failed to fetch candidate name", e);
         }
      }
      candidateName = candidateName || "Anonymous";

      let reqTitle = "Unknown Requirement";
      if (requirementId) {
         try {
             const { getDoc, doc } = await import("firebase/firestore");
             const reqSnap = await getDoc(doc(db, "requirements_public", requirementId));
             if (reqSnap.exists()) {
                 reqTitle = reqSnap.data().title || "Unknown Requirement";
             }
         } catch(e) {
             console.error("Failed to fetch req title", e);
         }
      }

      let vendorName = "HQ";
      if (vendorId && vendorId !== "HQ") {
         try {
             const { getDoc, doc } = await import("firebase/firestore");
             const vendorSnap = await getDoc(doc(db, "organizations", vendorId));
             if (vendorSnap.exists()) {
                 vendorName = vendorSnap.data().name || vendorId;
             }
         } catch(e) {
             console.error("Failed to fetch vendor name", e);
         }
      }

      let submissionId = null;

      if (!subSnap.empty) {
        // Exists. Do not duplicate.
        submissionId = subSnap.docs[0].id;
        // Optionally update it if re-submitting to an active stage
        const existingStatus = subSnap.docs[0].data().status;
        if (existingStatus !== "REJECTED") {
          return {
            success: true,
            message: "Submission already exists and is active.",
            candidateId,
            submissionId,
          };
        } else {
          try {
            console.log("STEP 4B: update rejected submission");
            // If rejected, we might allow a status bump to RESUBMITTED, but for now just update
            await updateDoc(doc(db, "submissions", submissionId), {
              status: initialStatus,
              candidateAnalysis: aiAnalysis?.candidateAnalysis || aiAnalysis?.analysis || "AI Analysis pending manual recruiter validation.",
              sourcingCriteria: aiAnalysis?.sourcingCriteria || aiAnalysis?.criteria || "Sourcing criteria matching verified by vendor recruiter.",
              updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "candidatePool", candidateId), {
                pipelineStage: "Matched",
                matchedRequirementId: requirementId,
                submissionId: submissionId,
                updatedAt: serverTimestamp()
            });
            console.log("STEP 4B SUCCESS");
          } catch (e) {
            console.error("STEP 4B FAILED", e);
            throw e;
          }
        }
      } else {
        // 5. Create Submission (Source of Truth for Pipeline Progress)
        try {
          console.log("STEP 5: addDoc submissions", {
            candidateId,
            requirementId,
            clientId,
            vendorId,
          });
          const newSubRef = await addDoc(collection(db, "submissions"), {
            candidateId,
            candidateName: candidateName,
            candidateEmail:
              candidateData.email || candidateData.primaryEmail || "",
            requirementId,
            canonicalRequirementId: requirementId,
            reqTitle: reqTitle,
            clientId,
            vendorId, // authoritative
            status: initialStatus,
            submittedBy: submitterId,
            matchScore,
            aiAnalysis: aiAnalysis || null,
            candidateAnalysis: aiAnalysis?.candidateAnalysis || aiAnalysis?.analysis || "AI Analysis pending manual recruiter validation.",
            sourcingCriteria: aiAnalysis?.sourcingCriteria || aiAnalysis?.criteria || "Sourcing criteria matching verified by vendor recruiter.",
            idempotencyKey,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            timeline: [
              { action: initialStatus, timestamp: new Date().toISOString() },
            ],
          });
          submissionId = newSubRef.id;
          
          console.log("STEP 5B: update cand pipelineStage");
          await updateDoc(doc(db, "candidatePool", candidateId), {
              pipelineStage: "Matched",
              matchedRequirementId: requirementId,
              submissionId: submissionId,
              updatedAt: serverTimestamp()
          });

          await addDoc(collection(db, "operationalEvents"), {
            entityId: candidateId,
            type: "Candidate Submitted",
            actorRole: "Vendor/System",
            metadata: {
              source: "Workflow Orchestrator",
              message: `Candidate submitted to requirement ${requirementId}`
            },
            timestamp: serverTimestamp()
          });

          console.log("STEP 5 SUCCESS", submissionId);
        } catch (e) {
          console.error("STEP 5 FAILED", e);
          throw e;
        }
      }

      // 6. Establish/Update Ownership
      try {
        console.log("STEP 6: establishOwnership");
        if (vendorId !== "HQ") {
            const { CandidateOwnershipEngine } = await import("./CandidateOwnershipEngine");
            await CandidateOwnershipEngine.establishOwnership(candidateId, vendorId, "VENDOR", 180);
        }
        console.log("STEP 6 SUCCESS");
      } catch (e) {
        console.error("STEP 6 FAILED", e);
        // don't throw, let submission continue even if ownership recording fails
      }

      // 7. Event Ledger
      try {
        console.log("STEP 7: emitEvents");
        await emitEvent(
          "SubmissionCreated",
          "SUBMISSION",
          submissionId,
          request.submitterId || "SYSTEM",
          "vendor",
          { candidateId, requirementId, vendorId, vendorName, matchScore, candidateName, reqTitle },
        );
        await emitEvent(
          "CandidateMatched",
          "CANDIDATE",
          candidateId,
          request.submitterId || "SYSTEM",
          "vendor",
          { candidateId, requirementId, vendorId, vendorName, matchScore, candidateName, reqTitle },
        );
        console.log("STEP 7 SUCCESS");
      } catch (e) {
        console.error("STEP 7 FAILED", e);
      }

      return {
        success: true,
        message: "Candidate successfully sequenced through orchestrator.",
        candidateId,
        submissionId,
      };
    } catch (error: any) {
      console.error("Submission Orchestrator Error:", error);
      return {
        success: false,
        message: "Orchestration failed",
        error: error.message,
      };
    }
  }
}
