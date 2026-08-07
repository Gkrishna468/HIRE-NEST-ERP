/** Represents an immutable audit record in the system */
export interface AuditRecord {
  actor: string;
  agent?: string;
  tool: string;
  action: string;
  entity: string;
  before?: any;
  after?: any;
  timestamp: string;
  correlationId: string;
  workspaceId: string;
}

/** 
 * AuditServiceAPI provides an immutable ledger for compliance events.
 */
export interface AuditServiceAPI {
  /** Logs an immutable audit record */
  log(record: AuditRecord): Promise<void>;
  
  /** Queries historical audit records */
  query(filters: Record<string, any>): Promise<AuditRecord[]>;
}
