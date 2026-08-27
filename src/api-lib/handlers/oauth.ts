import { db } from "../../lib/firebase-admin.js";
import { google } from "googleapis";
import express from "express";
import { observabilityService } from "../services/ObservabilityService.js";
import { encryptText } from "../../lib/encryption.js";

// Use environment variables or rely on user metadata logic if missing
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/oauth/callback";

export const createOAuthClient = () =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
export const oauth2Client = createOAuthClient();

const oauthHandler = express.Router();

oauthHandler.get("/url", (req, res) => {
  try {
    const { uid, redirectTo } = req.query;
    if (!uid) {
      return res.status(400).json({
        ok: false,
        configured: false,
        error: {
          code: "MISSING_UID",
          message: "Missing uid parameter"
        }
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || clientId === "YOUR_CLIENT_ID" || !clientSecret || clientSecret === "YOUR_CLIENT_SECRET") {
      return res.status(200).json({
        ok: false,
        configured: false,
        error: {
          code: "GOOGLE_OAUTH_NOT_CONFIGURED",
          message: "Google connection is not configured."
        }
      });
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar",
      ],
      state: JSON.stringify({ uid, redirectTo: redirectTo || "/app" }),
    });

    res.json({ ok: true, success: true, url, configured: true });
  } catch (err: any) {
    console.warn("[OAuth] generateAuthUrl error:", err?.message);
    res.status(200).json({
      ok: false,
      configured: false,
      error: {
        code: "GOOGLE_OAUTH_ERROR",
        message: err?.message || "Unable to initialize Google connection."
      }
    });
  }
});

oauthHandler.get("/callback", async (req, res) => {
  console.log("STEP 1 callback reached");
  const code = req.query.code as string;
  const stateStr = req.query.state as string;

  if (!code || !stateStr) {
    return res.status(400).send("Missing code or state");
  }

  try {
    console.log("STEP 2 parsing state");
    const state = JSON.parse(stateStr);

    console.log("STEP 3 exchanging token");
    const { tokens } = await oauth2Client.getToken(code);

    console.log("STEP 4 token received");
    console.log("Scopes:", tokens.scope);
    const userClient = createOAuthClient();
    userClient.setCredentials(tokens);

    if (!db) {
      console.error(
        "[OAuth] Firebase adminDb is null. Cannot store token. Check FIREBASE_PRIVATE_KEY env vars.",
      );
      return res
        .status(500)
        .send("Database not configured. Check backend environment variables.");
    }

    console.log("STEP 5 firestore write");
    // Store in backend vault securely
    try {
      await db
        .collection("token_vault")
        .doc(state.uid)
        .set(
          {
            accessToken: tokens.access_token
              ? encryptText(tokens.access_token)
              : null,
            refreshToken: tokens.refresh_token
              ? encryptText(tokens.refresh_token)
              : null,
            expiryDate: tokens.expiry_date,
            scope: tokens.scope,
            updatedAt: new Date(),
          },
          { merge: true },
        );
    } catch (dbErr: any) {
      if (dbErr.message && dbErr.message.includes("UNAUTHENTICATED")) {
        console.error(
          "[OAuth] FATAL: Cannot store token. Firebase Admin SDK lacks credentials.",
        );
        console.error(
          "[OAuth] FIX: You MUST set FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, and FIREBASE_PROJECT_ID in your environment variables (e.g. Vercel Settings) to write to the token_vault.",
        );
        return res
          .status(500)
          .send(
            "Firebase Admin SDK is not configured with a Service Account. OAuth token cannot be securely stored. Please configure FIREBASE_PRIVATE_KEY.",
          );
      }
      throw dbErr;
    }

    console.log("STEP 5.1 Verification");
    try {
      const gmail = google.gmail({ version: "v1", auth: userClient });
      const profile = await gmail.users.getProfile({ userId: "me" });
      console.log("Connected Gmail:", profile.data.emailAddress);

      const calendar = google.calendar({ version: "v3", auth: userClient });
      const calendars = await calendar.calendarList.list({ maxResults: 1 });

      console.log("STEP 5.2 Update SSOT");
      await db.collection("workspace_connections").doc(state.uid).set(
        {
          provider: "google",
          connected: true,
          gmail: true,
          calendar: !!calendars.data.items,
          emailAddress: profile.data.emailAddress,
          watchStatus: false,
          lastVerified: new Date(),
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } catch (verifyErr: any) {
      console.error(
        "[OAuth] Workspace verification failed during callback:",
        verifyErr.message,
      );
      try {
        await db.collection("workspace_connections").doc(state.uid).set(
          {
            connected: false,
            error: verifyErr.message,
          },
          { merge: true },
        );
      } catch (innerErr) {
        console.error("[OAuth] Failed to set disconnected state:", innerErr);
      }
    }

    observabilityService
      .logOAuthEvent({
        provider: "google",
        status: "success",
        severity: "INFO",
        actorId: state.uid,
        metadata: { scope: tokens.scope },
      })
      .catch(console.error);

    console.log("STEP 6 redirect");
    // Redirect back to application
    res.redirect(state.redirectTo);
  } catch (err: any) {
    console.error("FULL OAUTH ERROR", err);
    console.error("STACK", err?.stack);
    console.error("OAuth callback error:", err);
    observabilityService
      .logOAuthEvent({
        provider: "google",
        status: "failure",
        severity: "ERROR",
        metadata: { error: err.message || String(err) },
      })
      .catch(console.error);

    res.status(500).send("OAuth Authorization Failed.");
  }
});

// Removed status endpoint from oauthHandler as it is now in workspaceHandler

oauthHandler.post("/disconnect", async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    await db.collection("token_vault").doc(uid).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

export default oauthHandler;
