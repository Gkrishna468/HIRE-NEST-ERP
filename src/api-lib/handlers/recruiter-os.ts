import express from "express";
import { adminDb } from "../../lib/firebase-admin.js";
import { EventBus, BusinessEvent } from "../services/EventBus.js";

const recruiterOsHandler = express.Router();

recruiterOsHandler.post("/action", async (req: any, res: any) => {
  try {
    const { action, payload } = req.body;
    const actorId = req.user?.uid || "unknown_recruiter";
    const tenantId = req.user?.organizationId || "TENANT-HQ";
    
    if (!action) {
      return res.status(400).json({ success: false, error: "Action is required" });
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();

    let event: BusinessEvent;

    switch (action) {
      case "SUBMIT_CANDIDATE":
        event = {
          eventId,
          eventType: "CANDIDATE_SUBMITTED",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            candidateId: payload.candidateId,
            requirementId: payload.requirementId,
            actorId,
            ...(payload.notes ? { notes: payload.notes } : {})
          }
        };
        // Update Submission Collection
        await adminDb.collection("submissions").add({
          candidateId: payload.candidateId,
          requirementId: payload.requirementId,
          status: "SUBMITTED",
          submittedBy: actorId,
          tenantId,
          createdAt: timestamp
        });
        break;

      case "SCHEDULE_REMINDER":
        event = {
          eventId,
          eventType: "INTERVIEW_REMINDER_SCHEDULED",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            candidateId: payload.candidateId,
            interviewId: payload.interviewId,
            actorId
          }
        };
        break;

      case "SEND_PREP_BRIEFING":
        event = {
          eventId,
          eventType: "PREP_BRIEFING_SENT",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            candidateId: payload.candidateId,
            actorId
          }
        };
        break;
        
      case "SEND_HM_BRIEFING":
        event = {
          eventId,
          eventType: "HM_BRIEFING_SENT",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            candidateId: payload.candidateId,
            actorId
          }
        };
        break;

      case "RESOLVE_FOLLOWUP":
        event = {
          eventId,
          eventType: "FOLLOWUP_RESOLVED",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            followupId: payload.followupId,
            actorId
          }
        };
        // Mutate task status if we had a tasks collection
        if (payload.followupId) {
            await adminDb.collection("intake_review_queue").doc(payload.followupId).update({
                status: "RESOLVED",
                resolvedAt: timestamp,
                resolvedBy: actorId
            }).catch(() => {}); // ignore if doesn't exist
        }
        break;
        
      case "EXECUTE_BRIEFING_PLAN":
        event = {
          eventId,
          eventType: "BRIEFING_PLAN_EXECUTED",
          timestamp,
          source: "RECRUITER_OS",
          tenantId,
          payload: {
            category: payload.category,
            actorId
          }
        };
        break;

      default:
        return res.status(400).json({ success: false, error: "Unknown action" });
    }

    // Dispatch via EventBus (this ensures Kill Switch is checked downstream if it triggers automations)
    await EventBus.publishInternal(event);
    
    // Also log in system_events for Timeline
    await adminDb.collection("system_events").doc(eventId).set(event);

    return res.status(200).json({ success: true, eventId, message: `Action ${action} executed successfully` });
  } catch (err: any) {
    console.error("[RecruiterOS Handler] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default recruiterOsHandler;
