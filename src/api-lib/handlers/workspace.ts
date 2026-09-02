import express from "express";
import crypto from "crypto";
import { db } from "../../lib/firebase-admin.js";
import { createOAuthClient } from "./oauth.js";
import { google } from "googleapis";
import { encryptText, decryptText } from "../../lib/encryption.js";

import { MailOSService } from "../services/MailOSService.js";
import { WorkspaceResolver } from "../services/WorkspaceResolver.js";
import { EventBus } from "../services/EventBus.js";

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
    if (!db) {
      return res.json({ success: true, metrics: {} });
    }
    const workspace = await WorkspaceResolver.resolve(req);
    const today = new Date().toISOString().split('T')[0];
    const doc = await db.collection("intake_metrics").doc(`${workspace.orgId}_${today}`).get();
    res.json({ success: true, metrics: doc.exists ? doc.data() : {} });
  } catch (e: any) {
    console.warn("[INTAKE METRICS] Fallback:", e?.message);
    res.json({ success: true, metrics: {} });
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || clientId === "YOUR_CLIENT_ID" || !clientSecret || clientSecret === "YOUR_CLIENT_SECRET") {
    return res.json({ connected: false, status: "NOT_CONFIGURED" });
  }

  if (!db) {
    return res.json({ connected: false, status: "ERROR", error: "Database not configured" });
  }

  try {
    const doc = await db.collection("token_vault").doc(uid).get();
    if (!doc.exists) {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false, status: "NOT_CONNECTED" }, { merge: true });
      return res.json({ connected: false, status: "NOT_CONNECTED" });
    }

    const data = doc.data();
    if (!data?.accessToken) {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false, status: "NOT_CONNECTED" }, { merge: true });
      return res.json({ connected: false, status: "NOT_CONNECTED" });
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
      status: "CONNECTED",
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
    const errMsg = e.message || String(e);
    const isTokenError = errMsg.includes("invalid_grant") || errMsg.includes("Invalid Credentials") || errMsg.includes("expired") || errMsg.includes("token") || e.status === 401 || e.code === 401;
    const finalState = isTokenError ? "TOKEN_EXPIRED" : "ERROR";

    try {
      await db
        .collection("workspace_connections")
        .doc(uid)
        .set({ connected: false, status: finalState, error: errMsg }, { merge: true });
    } catch (innerErr) {
      console.error("[Workspace Status] Failed to update db:", innerErr);
    }
    res.json({
      connected: false,
      status: finalState,
      error: errMsg,
    });
  }
});

/**
 * Core logic for (re)establishing a Gmail push-notification watch() for a
 * single user. Extracted out of the /watch/setup route handler so the same
 * logic can also be driven in bulk by a scheduled cron job (see
 * renewExpiringGmailWatches below) rather than only ever firing when a human
 * happens to click "Connect"/"Reconnect" in Settings — watch() subscriptions
 * expire after at most 7 days, so without a scheduled renewal Mail OS
 * silently stops receiving mail about a week after any manual setup.
 */
export async function setupGmailWatch(
  uid: string,
): Promise<{ success: boolean; watchStatus: boolean; watchError: any }> {
  if (!db) {
    return { success: false, watchStatus: false, watchError: "Database not configured" };
  }

  const doc = await db.collection("token_vault").doc(uid).get();
  if (!doc.exists) {
    return { success: false, watchStatus: false, watchError: "No connection found" };
  }

  const data = doc.data();
  if (!data?.accessToken) {
    return { success: false, watchStatus: false, watchError: "No valid token" };
  }

  const userClient = createOAuthClient();
  const accessToken = decryptText(data.accessToken);
  const refreshToken = data.refreshToken ? decryptText(data.refreshToken) : null;

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
    console.error("[PubSub] Failed to ensure topic exists:", pubsubErr.message);
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
        watchExpiration: watchExpiration ? new Date(watchExpiration).toISOString() : null,
        watchHistoryId,
      },
      { merge: true },
    );

  return { success: true, watchStatus, watchError };
}

/**
 * Finds every user with a Gmail watch expiring within 48 hours (or with no
 * watch record at all despite an active connection) and renews it. Intended
 * to be called from a scheduled cron route (src/api-lib/handlers/cron.ts),
 * not from user-facing request handlers.
 */
export async function renewExpiringGmailWatches(): Promise<{ uid: string; watchStatus: boolean; watchError: any }[]> {
  if (!db) return [];

  const RENEWAL_WINDOW_MS = 48 * 60 * 60 * 1000;
  const connectionsSnap = await db
    .collection("workspace_connections")
    .where("gmail", "==", true)
    .limit(200)
    .get();

  const results: { uid: string; watchStatus: boolean; watchError: any }[] = [];

  for (const doc of connectionsSnap.docs) {
    const uid = doc.id;
    try {
      const watchDoc = await db.collection("gmail_watch").doc(uid).get();
      const watchData = watchDoc.exists ? watchDoc.data() : null;
      const expiration = watchData?.expiration || 0;
      const needsRenewal = !expiration || expiration < Date.now() + RENEWAL_WINDOW_MS;

      if (needsRenewal) {
        const result = await setupGmailWatch(uid);
        results.push({ uid, watchStatus: result.watchStatus, watchError: result.watchError });
      }
    } catch (e: any) {
      console.error(`[Gmail Watch Renewal] Failed for uid ${uid}:`, e.message || e);
      results.push({ uid, watchStatus: false, watchError: e.message || String(e) });
    }
  }

  return results;
}

workspaceHandler.post("/watch/setup", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await setupGmailWatch(uid);
    if (!result.success) {
      return res.status(400).json({ error: result.watchError });
    }
    res.json({ success: true, watchStatus: result.watchStatus, watchError: result.watchError });
  } catch (e: any) {
    console.error("[Workspace Watch Setup] Error:", e.message || e);
    res.status(500).json({ error: "Failed to setup watch" });
  }
});

workspaceHandler.post("/gmail/webhook", async (req, res) => { try { const message = req.body.message; if (!message || !message.data) return res.status(400).send("Bad Request"); const dataBuffer = Buffer.from(message.data, "base64"); const dataJson = JSON.parse(dataBuffer.toString("utf-8")); const emailAddress = dataJson.emailAddress; if (!emailAddress) return res.status(400).send("Missing emailAddress"); if (!db) return res.status(500).send("DB not connected"); const snapshot = await db.collection("workspace_connections").where("emailAddress", "==", emailAddress).limit(1).get(); if (snapshot.empty) { console.warn("No user found for email:", emailAddress); return res.status(200).send("OK"); } const uid = snapshot.docs[0].id; const userDoc = await db.collection("users").doc(uid).get(); let orgId = "default"; if (userDoc.exists) { orgId = userDoc.data()?.orgId || "default"; } console.log("Triggering syncInbox for", emailAddress); MailOSService.syncInbox(uid, orgId).then(() => console.log("syncInbox completed")).catch(err => console.error("syncInbox failed", err)); res.status(200).send("OK"); } catch (err) { console.error("Error", err); res.status(500).send("Internal Server Error"); } });

/**
 * WhatsApp Cloud API webhook verification handshake. Meta calls this once
 * when you register the webhook URL in the Meta App Dashboard, with
 * hub.mode=subscribe, hub.verify_token=<whatever you configured there>, and
 * hub.challenge=<a random string>. You must echo hub.challenge back as
 * plain text if hub.verify_token matches WHATSAPP_VERIFY_TOKEN — otherwise
 * Meta refuses to ever deliver messages to this URL. No such handler
 * existed anywhere in this repo before, so the webhook could never be
 * registered with Meta in the first place.
 */
workspaceHandler.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expectedToken && token === expectedToken) {
    console.log("[WhatsApp Webhook] Verification handshake succeeded.");
    return res.status(200).send(challenge);
  }
  console.warn("[WhatsApp Webhook] Verification handshake failed or WHATSAPP_VERIFY_TOKEN not configured.");
  return res.status(403).send("Verification failed");
});

/**
 * Receives inbound WhatsApp messages from Meta's Cloud API and hands them
 * to the same intake pipeline Gmail uses (via EventBus -> IntakeOffice ->
 * IntakeEngine), so a client requirement, candidate resume, or vendor reply
 * arriving over WhatsApp gets classified and turned into a real record the
 * same way an email does.
 */
workspaceHandler.post("/whatsapp/webhook", async (req, res) => {
  // Always ack quickly — Meta retries aggressively on non-200 responses and
  // this webhook also fires for delivery/read status callbacks we don't
  // need to act on.
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      if (!signatureHeader || signatureHeader !== expectedSig) {
        console.warn("[WhatsApp Webhook] Signature verification failed — rejecting payload.");
        return res.status(403).send("Invalid signature");
      }
    }

    const entries = req.body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        const messages = value?.messages || [];
        if (!messages.length) continue; // status callbacks, no message content

        const contact = value?.contacts?.[0];
        const senderName: string = contact?.profile?.name || "";
        const waId: string = contact?.wa_id || messages[0]?.from || "unknown";

        for (const msg of messages) {
          const body =
            msg?.text?.body ||
            msg?.button?.text ||
            msg?.interactive?.button_reply?.title ||
            msg?.interactive?.list_reply?.title ||
            "";

          const attachments: { filename: string; mimeType: string; content: string }[] = [];
          const mediaNode = msg?.image || msg?.document || msg?.audio || msg?.video;
          if (mediaNode?.id) {
            // Media content requires a follow-up authenticated download from
            // Meta's Graph API (GET /{media-id}) — deliberately not fetched
            // here to keep webhook handling fast; the media id is preserved
            // in metadata so a later step can retrieve it if needed.
            attachments.push({
              filename: mediaNode.filename || `whatsapp-media-${mediaNode.id}`,
              mimeType: mediaNode.mime_type || "application/octet-stream",
              content: "",
            });
          }

          try {
            await EventBus.publish(
              "WHATSAPP_MESSAGE_RECEIVED",
              {
                sender: waId,
                channel: waId,
                senderName,
                subject: "",
                body,
                attachments,
                receivedAt: new Date().toISOString(),
                metadata: {
                  whatsappMessageId: msg?.id,
                  phoneNumberId: value?.metadata?.phone_number_id,
                  mediaId: mediaNode?.id,
                },
              },
              "WHATSAPP_WEBHOOK",
              "GLOBAL",
            );
          } catch (publishErr) {
            console.error("[WhatsApp Webhook] Failed to publish WHATSAPP_MESSAGE_RECEIVED:", publishErr);
          }
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    // Still return 200 — an error here is our bug, not the sender's, and
    // returning non-200 just causes Meta to retry the same payload.
    console.error("[WhatsApp Webhook] Error processing payload:", err);
    return res.status(200).send("OK");
  }
});

export default workspaceHandler;
