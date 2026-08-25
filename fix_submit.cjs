const fs = require('fs');

let content = fs.readFileSync('src/components/CandidateSubmissionModal.tsx', 'utf8');

const bad = `      if (response && !response.success) {
         if (response.ownershipDetails) {
            alert("Blocked: " + response.message);
             }
      } else {
            alert("Submission failed: " + response.error);
         }
         setIsSubmitting(false);
         return;
      }`;

const good = `      if (response && !response.success) {
         if (response.ownershipDetails) {
            alert("Blocked: " + response.message);
         } else {
            alert("Submission failed: " + response.error);
         }
         setIsSubmitting(false);
         return;
      }`;

content = content.replace(bad, good);
fs.writeFileSync('src/components/CandidateSubmissionModal.tsx', content);
