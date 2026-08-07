import { MemoryPlatformAPI, MemoryEntry, MemorySegment } from '@hirenest/platform-sdk';

export class MemoryStore implements MemoryPlatformAPI {
  private memories: MemoryEntry[] = [];

  async store(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = `mem-${Date.now()}`;
    this.memories.push({ ...entry, id });
    return id;
  }

  async search(segment: MemorySegment, query: any): Promise<MemoryEntry[]> {
    return this.memories.filter(m => m.segment === segment); // Mock search
  }

  async archive(id: string): Promise<void> {
    this.memories = this.memories.filter(m => m.id !== id);
  }
}
