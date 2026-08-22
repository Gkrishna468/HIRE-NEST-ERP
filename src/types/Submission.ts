export interface Submission {
  id: string; // The canonical ID
  candidateId: string;
  requirementId: string;
  vendorId: string;
  recruiterId: string;
  status: string;
  interviewStatus: string;
  interviewFeedback: string;
  interviewRounds: number;
  offerStatus: string;
  joiningStatus: string;
  candidateAnalysis?: any;
  sourcingCriteria?: any;
}

export type SubmissionInput = Omit<Submission, 'id'>;
export type SubmissionUpdate = Partial<SubmissionInput>;
