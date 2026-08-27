import express from "express";
import { db } from "../../lib/firebase-admin.js";
import { google } from "googleapis";
import { encryptText, decryptText } from "../../lib/encryption.js";
import { WorkspaceResolver } from "../services/WorkspaceResolver.js";

const googleProxyHandler = express.Router();

async function getClientForUser(uid: string) {
  const doc = await db.collection("token_vault").doc(uid).get();
  if (!doc.exists) throw new Error("No OAuth connection found for user.");

  const data = doc.data();
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID",
    process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
  );

  client.setCredentials({
    access_token: data?.accessToken ? decryptText(data.accessToken) : null,
    refresh_token: data?.refreshToken ? decryptText(data.refreshToken) : null,
    expiry_date: data?.expiryDate,
  });

  // Handle auto-refresh updates
  client.on("tokens", async (tokens) => {
    const updateData: any = {};
    if (tokens.access_token)
      updateData.accessToken = encryptText(tokens.access_token);
    if (tokens.refresh_token)
      updateData.refreshToken = encryptText(tokens.refresh_token);
    if (tokens.expiry_date) updateData.expiryDate = tokens.expiry_date;

    await db
      .collection("token_vault")
      .doc(uid)
      .set(updateData, { merge: true });
  });

  return client;
}

googleProxyHandler.get("/gmail/messages", async (req, res) => {
  try {
    if (!db) {
      return res.status(200).json({ ok: true, success: true, messages: [] });
    }

    let workspace: any = null;
    try {
      workspace = await WorkspaceResolver.resolve(req);
    } catch {
      workspace = { orgId: req.query.orgId || "default-workspace" };
    }

    let query: any = db.collection("mail_messages");
    if (workspace && workspace.orgId) {
      query = query.where("workspaceId", "==", workspace.orgId);
    }

    let docs: any[] = [];
    try {
      const snapshot = await query.orderBy("createdAt", "desc").limit(25).get();
      docs = snapshot.docs;
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (
        errMsg.includes("index") ||
        errMsg.includes("FAILED_PRECONDITION") ||
        errMsg.includes("INDEX_REQUISITE") ||
        errMsg.includes("requires an index")
      ) {
        console.log("[googleProxyHandler] Missing composite index for mail_messages query. Performing resilient in-memory sort fallback.");
        // Fallback: fetch without order and sort in-memory
        const rawSnapshot = await query.get();
        const sortedDocs = rawSnapshot.docs.sort((a: any, b: any) => {
          const dataA = a.data();
          const dataB = b.data();
          const timeA = dataA.createdAt
            ? dataA.createdAt.toDate
              ? dataA.createdAt.toDate().getTime()
              : new Date(dataA.createdAt).getTime()
            : 0;
          const timeB = dataB.createdAt
            ? dataB.createdAt.toDate
              ? dataB.createdAt.toDate().getTime()
              : new Date(dataB.createdAt).getTime()
            : 0;
          return timeB - timeA; // Descending
        });
        docs = sortedDocs.slice(0, 25);
      } else {
        console.warn("[googleProxyHandler] Mail query notice:", errMsg);
        docs = [];
      }
    }

    const fullMessages = docs.map((doc) => {
      const d = doc.data();
      return {
        id: d.gmailMessageId || doc.id,
        snippet: d.rawPayload?.snippet || "",
        subject: d.rawPayload?.subject || "(No Subject)",
        from: d.rawPayload?.from || "(Unknown Sender)",
        rawPayload: d.rawPayload || {},
        body: d.rawPayload?.body || "",
        attachments: d.rawPayload?.attachments || [],
        classification: d.classification || { type: d.entityType || "UNKNOWN" },
        status: d.status || "UNKNOWN",
        createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : new Date(d.createdAt).toISOString()) : new Date().toISOString()
      };
    });

    res.json({ ok: true, success: true, messages: fullMessages });
  } catch (e: any) {
    console.warn("[googleProxyHandler] Graceful fallback:", e?.message);
    res.status(200).json({ ok: true, success: true, messages: [] });
  }
});

googleProxyHandler.get("/calendar/events", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const timeMin = (req.query.timeMin as string) || new Date().toISOString();

  try {
    const client = await getClientForUser(uid);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=10&singleEvents=true&orderBy=startTime`;
    const response = await client.request({ url });

    res.json(response.data);
  } catch (e: any) {
    console.error(e);
    res
      .status(e.response?.status || 500)
      .json({ error: e.message || "Failed to fetch Calendar" });
  }
});

googleProxyHandler.post("/calendar/events", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const client = await getClientForUser(uid);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

    const response = await client.request({
      url,
      method: "POST",
      data: req.body,
    });

    res.json(response.data);
  } catch (e: any) {
    console.error(e);
    res
      .status(e.response?.status || 500)
      .json({ error: e.message || "Failed to create Calendar Event" });
  }
});

export default googleProxyHandler;
