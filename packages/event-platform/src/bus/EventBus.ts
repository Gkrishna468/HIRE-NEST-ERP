import { EventPlatformAPI, ImmutableEvent } from '@hirenest/platform-sdk';

export class EventBus implements EventPlatformAPI {
  private events: ImmutableEvent[] = [];
  private handlers: Map<string, Array<(event: ImmutableEvent) => Promise<void>>> = new Map();

  async publish(event: ImmutableEvent): Promise<void> {
    this.events.push(event);
    const typeHandlers = this.handlers.get(event.type) || [];
    for (const handler of typeHandlers) {
      await handler(event).catch(console.error); // Do not block the bus
    }
  }

  subscribe(type: string, handler: (event: ImmutableEvent) => Promise<void>): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  async query(filters: any): Promise<ImmutableEvent[]> {
    return this.events.filter(e => {
      if (filters.type && e.type !== filters.type) return false;
      if (filters.correlationId && e.correlationId !== filters.correlationId) return false;
      return true;
    });
  }
}
