import { adminDb } from "../../src/lib/firebase-admin.js";

export default async function submitLeadHandler(req: any, res: any) {
  console.log("=== PUBLIC SUBMIT LEAD HANDLER EXECUTED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", JSON.stringify(req.headers));

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

    // Check for existing duplicate by email
    try {
      const existingLeads = await adminDb.collection('landing_page_leads_v1')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existingLeads.empty) {
        console.warn(`[PublicAPI] Lead already exists for email: ${email}. Recorded duplicate attempt.`);
        return res.json({ success: true, message: "Lead already exists, recorded duplicate attempt." });
      }
    } catch (dbCheckErr: any) {
      console.warn('[PublicAPI] Failed to check duplicate email in Firestore:', dbCheckErr.message);
    }
    
    await adminDb.collection('landing_page_leads_v1').add({
      fullName,
      company,
      email,
      phone,
      plan,
      status: "NEW",
      source: 'landing_page_v1',
      createdAt: new Date().toISOString()
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[SubmitLead Error]:", err);
    return res.status(500).json({ error: err.message || "Failed to submit lead" });
  }
}
