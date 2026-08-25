const fs = require('fs');

let content = fs.readFileSync('src/views/CandidatesTab.tsx', 'utf8');

const regex = /let count = 0;\s*for\(const c of imported\) \{[\s\S]*?\/\/ Trigger background matchmaking scan after successful batch parsing/;

if (regex.test(content)) {
  const newLogic = `
                     let count = 0;
                     for(const c of imported) {
                        const isFailed = c.parsedProfile?.status === "PARSE_FAILED" || !c.extractedText || c.extractedText.includes("[Parse Failure Fallback]");
                        
                        if (isFailed) {
                          setProcessingStats((prev) => prev ? { ...prev, processing: Math.max(0, prev.processing - 1), failed: (prev.failed||0) + 1 } : null);
                          continue;
                        }

                        try {
                           const savePayload = {
                             id: c.candidateProfile?.candidateId || c.id || "HN-CAN-" + Math.random().toString(36).substr(2, 9),
                             candidateId: c.candidateProfile?.candidateId || c.id || "HN-CAN-" + Math.random().toString(36).substr(2, 9),
                             name: c.name,
                             fullName: c.name,
                             email: c.email || null,
                             phone: c.phone || null,
                             location: c.location || "Remote",
                             skills: c.skills || [],
                             experience: c.experienceYears ? \`\${c.experienceYears} Years\` : "0 Years",
                             totalExperience: c.experienceYears || 0,
                             currentRole: c.currentRole || "",
                             resumeText: c.extractedText || c.candidateProfile?.resumeText || "",
                             vendorId: userOrgId || "HQ",
                             ownerType: userRole === "vendor" ? "VENDOR" : "RECRUITER",
                             createdByRole: (userRole || "vendor").toUpperCase(),
                             status: "COMPLETED",
                             distillationStatus: "COMPLETED",
                             pipelineStage: "Candidate Added",
                             resumeLastParsedAt: new Date().toISOString(),
                             createdAt: new Date().toISOString(),
                           };
                           
                           await fetch("/api/upsert-candidate", {
                             method: "POST",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({ candidate: savePayload, orgId: userOrgId, userId: auth.currentUser?.uid, userRole })
                           });

                           count++;
                           setProcessingStats((prev) => prev ? { ...prev, processing: Math.max(0, prev.processing - 1), parsed: (prev.parsed||0) + 1 } : null);
                        } catch(err) {
                           console.error(err);
                           setProcessingStats((prev) => prev ? { ...prev, processing: Math.max(0, prev.processing - 1), failed: (prev.failed||0) + 1 } : null);
                        }
                     }
                    
                     // Trigger background matchmaking scan after successful batch parsing`;
                     
  content = content.replace(regex, newLogic);
  fs.writeFileSync('src/views/CandidatesTab.tsx', content);
  console.log("Successfully patched CandidatesTab.tsx");
} else {
  console.log("Could not find regex match");
}
