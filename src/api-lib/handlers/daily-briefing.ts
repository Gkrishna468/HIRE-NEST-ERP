import express from "express";
import { adminDb } from "../../lib/firebase-admin.js";
import { AIGateway } from "../services/AIGateway.js";

const dailyBriefingHandler = express.Router();

dailyBriefingHandler.get("/", async (req: any, res: any) => {
  try {
    const role = req.user?.role || "recruiter";
    const tenantId = req.user?.organizationId || req.query.orgId || "TENANT-HQ";
    const userEmail = req.user?.email || "User";
    
    // Fetch quick aggregates to give context to Gemini
    let statsCtx = "";
    if (role === "admin" || role === "super_admin") {
      const usersSnap = await adminDb.collection("users").count().get();
      const reqsSnap = await adminDb.collection("requirements_public").where("status", "==", "ACTIVE").count().get();
      statsCtx = `System has ${usersSnap.data().count} users and ${reqsSnap.data().count} active requirements.`;
    } else if (role === "vendor") {
      const candidatesSnap = await adminDb.collection("candidatePool").where("vendorId", "==", tenantId).count().get();
      statsCtx = `Vendor has ${candidatesSnap.data().count} candidates in pool.`;
    } else if (role === "client") {
      const reqsSnap = await adminDb.collection("requirements_public").where("clientId", "==", tenantId).count().get();
      statsCtx = `Client has ${reqsSnap.data().count} active open requirements.`;
    } else {
      // Recruiter
      const candidatesSnap = await adminDb.collection("candidatePool").where("assignedRecruiter", "==", userEmail).count().get();
      statsCtx = `Recruiter manages ${candidatesSnap.data().count} active candidates.`;
    }

    const schema = {
      type: "object",
      properties: {
        briefing: {
          type: "string",
          description: "A short, engaging 2-3 sentence personalized morning briefing paragraph acknowledging their role."
        },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string", description: "Short actionable item title" },
              type: { type: "string" }
            },
            required: ["id", "title", "type"]
          }
        }
      },
      required: ["briefing", "actionItems"]
    };

    const prompt = `You are the AI COO of HireNestOS. 
Generate a personalized morning briefing for a user with role: ${role}.
Here are the current system stats for their context: ${statsCtx}.
Keep the briefing professional, insightful, and motivating.
Provide 2-3 specific action items based on their role.`;

    const aiResponse = await AIGateway.processChat({
      prompt,
      feature: "executive_summary",
      schema,
      temperature: 0.7
    });

    let resultData: any;
    try {
      resultData = JSON.parse(aiResponse.response);
    } catch (e) {
      resultData = null;
    }

    if (!resultData || typeof resultData !== "object") {
      resultData = {
        briefing: "Good morning! Your dashboard is active and ready.",
        actionItems: []
      };
    }

    if (!resultData.actionItems || !Array.isArray(resultData.actionItems)) {
      resultData.actionItems = [];
    }

    if (!resultData.briefing) {
      resultData.briefing = "Good morning! Your dashboard is active and ready.";
    }

    return res.status(200).json({
      success: true,
      data: {
        briefing: resultData.briefing,
        actionItems: resultData.actionItems,
        metrics: {
          newCandidates: 0,
          pendingReviews: resultData.actionItems.length,
          upcomingInterviews: 0
        }
      }
    });

  } catch (err: any) {
    console.error("[DailyBriefing] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default dailyBriefingHandler;
