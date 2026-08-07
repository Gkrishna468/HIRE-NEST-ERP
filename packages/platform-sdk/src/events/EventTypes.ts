export interface ImmutableEvent<T = any> {
  eventId: string;
  type: string;
  version: string;
  source: string;
  workspaceId: string;
  timestamp: string;
  payload: T;
  correlationId: string;
}

export interface EventPlatformAPI {
  publish(event: ImmutableEvent): Promise<void>;
  subscribe(type: string, handler: (event: ImmutableEvent) => Promise<void>): void;
  query(filters: any): Promise<ImmutableEvent[]>;
}
