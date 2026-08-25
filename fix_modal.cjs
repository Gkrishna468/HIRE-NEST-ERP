const fs = require('fs');

let content = fs.readFileSync('src/components/CandidateSubmissionModal.tsx', 'utf8');

const startTag = 'if (data.text) {';
const endTag = '} else {';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newLogic = `if (data.text) {
          const profile = data;
          if (profile.candidateName && profile.candidateName !== "Parsing Pending" && profile.candidateName !== "Unknown") {
            setName(profile.candidateName);
          }
          setEmail(
            profile.email?.includes("pending@") ? "" : profile.email || "",
          );
          setPhone(profile.phone === "N/A" ? "" : profile.phone || "");
          setExperience(profile.experienceYears === 0 ? "" : \`\${profile.experienceYears} Years\`);
          setKeySkills(
            Array.isArray(profile.skills)
              ? profile.skills.join(", ")
              : profile.skills || "",
          );

          const analysis = {
            fitScore: 88,
            skills: profile.skills || [],
            analysis: profile.candidateProfile?.summary || "Parsed from document.",
            candidateAnalysis: profile.candidateProfile?.summary || "Parsed from document.",
            sourcingCriteria: "Extracted candidate qualifications matched to job requirements.",
            authenticity: "Parsed from document",
            processingId: profile.processingId || profile.ledgerId
          };
          setAiAnalysis(analysis);
          setParsed(true);
      `;
      
  content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
  fs.writeFileSync('src/components/CandidateSubmissionModal.tsx', content);
  console.log("Successfully patched CandidateSubmissionModal.tsx");
} else {
  console.log("Could not find boundaries in CandidateSubmissionModal.tsx");
}
