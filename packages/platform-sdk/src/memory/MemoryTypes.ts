export type MemorySegment = 'Operational' | 'Conversation' | 'Business' | 'Knowledge' | 'Executive' | 'Vector';

export interface MemoryEntry {
  id: string;
  segment: MemorySegment;
  workspaceId: string;
  domain: string;
  content: any;
  timestamp: string;
  expiresAt?: string;
}

export interface MemoryPlatformAPI {
  search(segment: MemorySegment, query: any): Promise<MemoryEntry[]>;
  store(entry: Omit<MemoryEntry, 'id'>): Promise<string>;
  archive(id: string): Promise<void>;
}
