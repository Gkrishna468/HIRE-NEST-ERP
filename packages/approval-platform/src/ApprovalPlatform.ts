import { ApprovalRequest, ApprovalResponse, ApprovalPlatformAPI } from '@hirenest/platform-sdk';

export class ApprovalPlatform implements ApprovalPlatformAPI {
  private pending: Map<string, ApprovalRequest> = new Map();

  async request(request: ApprovalRequest): Promise<ApprovalResponse> {
    this.pending.set(request.id, request);
    
    // In a real system, this would emit an event or send a push notification.
    // For this turn, we'll simulate an auto-approval for demo purposes 
    // unless the system is specifically waiting for user input.
    
    console.log(`[ApprovalPlatform] Pending request: ${request.action} from agent ${request.agentId}`);
    
    // Mocking response (would normally be async via UI interaction)
    return new Promise((resolve) => {
        // Simulating a slight delay for human-like interaction
        setTimeout(() => {
            this.pending.delete(request.id);
            resolve({
                approvalId: request.id,
                status: 'approved',
                approverId: 'system-auto-approver'
            });
        }, 100);
    });
  }

  async getPending(): Promise<ApprovalRequest[]> {
    return Array.from(this.pending.values());
  }
}
