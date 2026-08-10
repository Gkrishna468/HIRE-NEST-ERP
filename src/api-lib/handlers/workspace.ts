import express from "express";
import { db } from "../../lib/firebase-admin.js";
import { createOAuthClient } from "./oauth.js";
import { google } from "googleapis";
import { encryptText, decryptText } from "../../lib/encryption.js";

import { MailOSService } from "../services/MailOSService.js";
import { WorkspaceResolver } from "../services/WorkspaceResolver.js";

const workspaceHandler = express.Router();

workspaceHandler.post("/mailos/sync", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const results = await MailOSService.syncInbox(
      workspace.uid,
      workspace.orgId,
    );
    res.json({ success: true, processed: results });
  } catch (e: any) {
    console.error("MailOS Sync Error:", e);
    res.status(500).json({ error: e.message });
  }
});

workspaceHandler.post("/mailos/message/:id/analyze", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const forceIntent = req.body?.forceIntent;
    const result = await MailOSService.analyzeMessage(workspace.uid, workspace.orgId, req.params.id, forceIntent);
    res.json({ success: true, result });
  } catch (e: any) {
    console.error("Analyze Message Error:", e);
    res.status(500).json({ error: e.message });
  }
});


workspaceHandler.get("/intake/metrics", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const today = new Date().toISOString().split('T')[0];
    const doc = await db.collection("intake_metrics").doc(`${workspace.orgId}_${today}`).get();
    res.json({ success: true, metrics: doc.exists ? doc.data() : {} });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

workspaceHandler.get("/intake/review-queue", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const snap = await db.collection("intake_review_queue")
        .where("tenantId", "==", workspace.orgId)
        .where("status", "==", "PENDING_REVIEW")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
    const queue = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, queue });
  } catch (e: any) {
    console.error("[REVIEW QUEUE] Error:", e.stack);
    res.json({ success: true, queue: [] });
  }
});

workspaceHandler.get("/intake/audit", async (req, res) => {
  try {
    const workspace = await WorkspaceResolver.resolve(req);
    const snap = await db.collection("intake_audit")
        .where("tenantId", "==", workspace.orgId)
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();
    const audit = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, audit });
  } catch (e: any) {
    console.error("[INTAKE AUDIT] Error:", e.stack);
    res.json({ success: true, audit: [] });
  }
});



workspaceHandler.get("/status", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  if (!db) {
    return res.json({ connected: false, error: "Database not configured" });
  }

  try {
    const doc = await db.collection("token_vault").doc(uid).get();
    if (!doc.exists) {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false }, { merge: true });
      return res.json({ connected: false });
    }

    const data = doc.data();
    if (!data?.accessToken) {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false }, { merge: true });
      return res.json({ connected: false });
    }

    const userClient = createOAuthClient();
    userClient.on("tokens", (tokens) => {
      if (tokens.access_token) {
        db.collection("token_vault")
          .doc(uid)
          .set(
            {
              accessToken: encryptText(tokens.access_token),
              ...(tokens.refresh_token && {
                refreshToken: encryptText(tokens.refresh_token),
              }),
              ...(tokens.expiry_date && { expiryDate: tokens.expiry_date }),
              updatedAt: new Date(),
            },
            { merge: true },
          )
          .catch((err) =>
            console.error("[OAuth] Failed to update refreshed token:", err),
          );
      }
    });

    const accessToken = decryptText(data.accessToken);
    const refreshToken = data.refreshToken
      ? decryptText(data.refreshToken)
      : null;

    userClient.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: userClient });
    const profile = await gmail.users.getProfile({ userId: "me" });

    // Ensure calendar is responsive
    const calendar = google.calendar({ version: "v3", auth: userClient });
    const calendars = await calendar.calendarList.list({ maxResults: 1 });

    let watchStatus = false;
    let watchError = null;
    let watchExpiration: number | null = null;
    let watchHistoryId: string | null = null;
    let watchData: any = null;

    const watchDoc = await db.collection("gmail_watch").doc(uid).get();
    if (watchDoc.exists) {
      watchData = watchDoc.data();
      // Renew watch if it expires in less than 24 hours
      if (
        watchData &&
        watchData.expiration > Date.now() + 24 * 60 * 60 * 1000
      ) {
        watchStatus = true;
        watchExpiration = watchData.expiration;
        watchHistoryId = watchData.historyId;
      }
    }

    let watchRemainingHours = 0;
    if (watchExpiration) {
      watchRemainingHours = Math.max(
        0,
        Math.floor((watchExpiration - Date.now()) / (1000 * 60 * 60)),
      );
    }

    const connectionStatus = {
      connected: true,
      provider: "google",
      gmail: true,
      calendar: !!calendars.data.items,
      hasRefreshToken: !!data.refreshToken,
      emailAddress: profile.data.emailAddress,
      expiresAt: data.expiryDate,
      watchStatus,
      watchError,
      watchExpiration: watchExpiration
        ? new Date(watchExpiration).toISOString()
        : null,
      watchRemainingHours,
      watchHistoryId,
      scopes: data.scope,
      lastRefresh: data.updatedAt || new Date(),
      mailSync: {
        lastHistoryId: watchData?.lastHistoryId || watchHistoryId || null,
        lastPubSubMessage: watchData?.lastPubSubMessage || null,
        lastSync: watchData?.lastSync || null,
        status: watchStatus ? "healthy" : "error",
      },
    };

    await db
      .collection("workspace_connections")
      .doc(uid)
      .set(connectionStatus, { merge: true });

    res.json(connectionStatus);
  } catch (e: any) {
    console.error("[Workspace Status] Error:", e.message || e);
    try {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false }, { merge: true });
    } catch (innerErr) {
      console.error("[Workspace Status] Failed to update db:", innerErr);
    }
    res.json({
      connected: false,
      error: "Failed to verify tokens with Google APIs",
    });
  }
});

workspaceHandler.post("/watch/setup", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  if (!db) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const doc = await db.collection("token_vault").doc(uid).get();
    if (!doc.exists)
      return res.status(400).json({ error: "No connection found" });

    const data = doc.data();
    if (!data?.accessToken)
      return res.status(400).json({ error: "No valid token" });

    const userClient = createOAuthClient();
    const accessToken = decryptText(data.accessToken);
    const refreshToken = data.refreshToken
      ? decryptText(data.refreshToken)
      : null;

    userClient.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: userClient });
    let watchStatus = false;
    let watchError = null;
    let watchExpiration: number | null = null;
    let watchHistoryId: string | null = null;

    const pubsub = new (require("@google-cloud/pubsub").PubSub)();
    const pubsubTopicName = process.env.PUBSUB_TOPIC_NAME || "gmail-events";
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const fullyQualifiedTopicName = `projects/${projectId}/topics/${pubsubTopicName}`;

    try {
      const topic = pubsub.topic(pubsubTopicName);
      const [exists] = await topic.exists();
      if (!exists) {
        await pubsub.createTopic(pubsubTopicName);
        console.log(`[PubSub] Topic ${pubsubTopicName} created.`);

        const iam = topic.iam;
        const [policy] = await iam.getPolicy();
        policy.bindings = policy.bindings || [];
        policy.bindings.push({
          role: "roles/pubsub.publisher",
          members: ["serviceAccount:gmail-api-push@system.gserviceaccount.com"],
        });
        await iam.setPolicy(policy);
        console.log(`[PubSub] Granted publisher role to Gmail API.`);
      }
    } catch (pubsubErr: any) {
      console.error(
        "[PubSub] Failed to ensure topic exists:",
        pubsubErr.message,
      );
    }

    try {
      console.log("WATCH TOPIC =", fullyQualifiedTopicName);
      const watchRes = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: fullyQualifiedTopicName,
          labelIds: ["INBOX"],
          labelFilterBehavior: "INCLUDE",
        },
      });
      if (watchRes.data.historyId && watchRes.data.expiration) {
        watchExpiration = Number(watchRes.data.expiration);
        watchHistoryId = watchRes.data.historyId;
        await db.collection("gmail_watch").doc(uid).set(
          {
            historyId: watchHistoryId,
            expiration: watchExpiration,
            updatedAt: Date.now(),
          },
          { merge: true },
        );
        watchStatus = true;
      }
    } catch (watchErr: any) {
      console.error("========== GMAIL WATCH FAILED ==========");
      console.error("MESSAGE:", watchErr.message);

      watchStatus = false;
      watchError = watchErr.response?.data || watchErr.message;
    }

    await db
      .collection("workspace_connections")
      .doc(uid)
      .set(
        {
          watchStatus,
          watchError,
          watchExpiration: watchExpiration
            ? new Date(watchExpiration).toISOString()
            : null,
          watchHistoryId,
        },
        { merge: true },
      );

    res.json({ success: true, watchStatus, watchError });
  } catch (e: any) {
    console.error("[Workspace Watch Setup] Error:", e.message || e);
    res.status(500).json({ error: "Failed to setup watch" });
  }
});

workspaceHandler.post("/gmail/webhook", async (req, res) => { try { const message = req.body.message; if (!message || !message.data) return res.status(400).send("Bad Request"); const dataBuffer = Buffer.from(message.data, "base64"); const dataJson = JSON.parse(dataBuffer.toString("utf-8")); const emailAddress = dataJson.emailAddress; if (!emailAddress) return res.status(400).send("Missing emailAddress"); if (!db) return res.status(500).send("DB not connected"); const snapshot = await db.collection("workspace_connections").where("emailAddress", "==", emailAddress).limit(1).get(); if (snapshot.empty) { console.warn("No user found for email:", emailAddress); return res.status(200).send("OK"); } const uid = snapshot.docs[0].id; const userDoc = await db.collection("users").doc(uid).get(); let orgId = "default"; if (userDoc.exists) { orgId = userDoc.data()?.orgId || "default"; } console.log("Triggering syncInbox for", emailAddress); MailOSService.syncInbox(uid, orgId).then(() => console.log("syncInbox completed")).catch(err => console.error("syncInbox failed", err)); res.status(200).send("OK"); } catch (err) { console.error("Error", err); res.status(500).send("Internal Server Error"); } });
export default workspaceHandler;
