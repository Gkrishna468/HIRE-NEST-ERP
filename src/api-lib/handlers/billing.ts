import express from "express";
import { db } from "../../lib/firebase-admin.js";
import { WorkspaceResolver } from "../services/WorkspaceResolver.js";

const billingHandler = express.Router();

billingHandler.get("/status", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    
    // Query local synced subscription doc
    const snap = await db.collection("billing_subscriptions")
        .where("tenantId", "==", workspace.orgId)
        .limit(1)
        .get();
        
    if (snap.empty) {
        return res.json({
            success: true,
            status: "FREE_TIER",
            plan: "COMMUNITY",
            usage: {
                aiTokens: 0,
                activeRequirements: 0,
                placedCandidates: 0
            },
            limits: {
                aiTokens: 10000,
                activeRequirements: 3,
                placedCandidates: 1
            }
        });
    }

    const data = snap.docs[0].data();
    res.json({
        success: true,
        status: data.status || "ACTIVE",
        plan: data.plan || "PRO",
        usage: data.usage || {},
        limits: data.limits || {}
    });

  } catch (error: any) {
    console.error("[BILLING] Status fetch failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

billingHandler.get("/usage", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const billingPeriod = new Date().toISOString().substring(0, 7);
    const snap = await db.collection("billingLedgers").doc(`${workspace.orgId}_${billingPeriod}`).get();
    
    res.json({
        success: true,
        period: billingPeriod,
        usage: snap.exists ? snap.data() : {
            workflowExecutions: 0,
            aiTokens: 0,
            vectorQueries: 0
        }
    });
  } catch (error: any) {
    console.error("[BILLING] Usage fetch failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

billingHandler.post("/webhook", express.json(), async (req, res) => {
    let event;

    try {
        event = req.body;
    } catch (err: any) {
        console.error(`[BILLING WEBHOOK] Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        console.log("[BILLING WEBHOOK] Received event", event?.type);
        
        if (event && (event.type === "invoice.payment_succeeded" || event.type === "payment.captured")) {
            const tenantId = event.data?.object?.metadata?.tenantId;
            if (tenantId) {
                await db.collection("billing_subscriptions").doc(tenantId).set({
                    tenantId,
                    status: "ACTIVE",
                    plan: "ENTERPRISE",
                    lastPaymentAt: new Date().toISOString(),
                    limits: {
                        aiTokens: 1000000,
                        activeRequirements: -1, // unlimited
                        placedCandidates: -1
                    }
                }, { merge: true });
            }
        }

        res.json({ received: true });
    } catch (e: any) {
        console.error("[BILLING WEBHOOK] Error", e);
        res.status(500).json({ error: "Webhook Error" });
    }
});

export default billingHandler;
