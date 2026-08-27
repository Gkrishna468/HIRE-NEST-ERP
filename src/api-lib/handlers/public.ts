import { adminDb } from "../../lib/firebase-admin.js";

function withTimeout<T = any>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export default async function publicHandler(req: any, res: any) {
  const { path } = req.query;
  const action = req.query.action || req.body?.action;
  
  if (path === 'public/submit-lead' || action === 'submit-lead') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
      const data = req.body || {};
      
      const email = (data.email || data.companyEmail || '').trim().toLowerCase();
      const fullName = (data.fullName || data.name || 'Anonymous').trim();
      const company = (data.companyName || data.company || 'N/A').trim();
      const phone = (data.phone || 'N/A').trim();
      const plan = (data.plan || 'Professional').trim();

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log("==========================================");
      console.log("NEW LEAD CAPTURED - NOTIFICATION");
      console.log(`Time: ${new Date().toISOString()}`);
      console.log(`Name: ${fullName}`);
      console.log(`Plan: ${plan}`);
      console.log(`Email: ${email}`);
      console.log(`Company: ${company}`);
      console.log(`Phone: ${phone}`);
      console.log("==========================================");

      // Send simulated email alert to info@hirenestworkforce.com
      console.log(`[ALERT_EMAIL] Sending system alert email to info@hirenestworkforce.com:
      Subject: New Landing Page Lead Captured - ${fullName}
      Body:
        A new lead has been captured from the landing page.
        Name: ${fullName}
        Email: ${email}
        Company Name: ${company}
        Phone: ${phone}
        Plan: ${plan}
        Timestamp: ${new Date().toISOString()}
      `);

      if (!adminDb) {
        console.warn('[PublicAPI] Admin DB not available, but lead logged to console.');
        return res.json({ success: true, message: 'Lead logged (Offline mode)' });
      }

      // Check for existing duplicate by email. Bounded by a timeout so a
      // Firestore call stuck on bad/expired credentials can't hold this
      // request open indefinitely.
      try {
        const existingLeads = await withTimeout(
          adminDb.collection('landing_page_leads_v1')
            .where('email', '==', email)
            .limit(1)
            .get(),
          8000,
          'Duplicate lead lookup'
        );

        if (!existingLeads.empty) {
          console.warn(`[PublicAPI] Lead already exists for email: ${email}. Recorded duplicate attempt.`);
          return res.json({ success: true, message: "Lead already exists, recorded duplicate attempt." });
        }
      } catch (dbCheckErr: any) {
        console.warn('[PublicAPI] Failed to check duplicate email in Firestore:', dbCheckErr.message);
      }

      try {
        await withTimeout(
          adminDb.collection('landing_page_leads_v1').add({
            fullName,
            company,
            email,
            phone,
            plan,
            status: "NEW",
            source: 'landing_page_v1',
            createdAt: new Date().toISOString()
          }),
          8000,
          'Lead save'
        );
      } catch (saveErr: any) {
        // Lead is already logged above; don't fail the visitor's submission
        // just because the Firestore write itself is slow/unavailable.
        console.error('[PublicAPI] Failed to persist lead to Firestore, falling back to logged-only:', saveErr.message);
        return res.json({ success: true, message: 'Lead logged (fallback mode)' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[SubmitLead Error]:", err);
      return res.status(500).json({ error: err.message || "Failed to submit lead" });
    }
  }

  return res.status(404).json({ error: "Public route not found" });
}
