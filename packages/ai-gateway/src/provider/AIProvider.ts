export interface AIProvider {
  id: string;
  name: string;
  chat(request: any): Promise<any>;
  embed(request: any): Promise<any>;
  vision(request: any): Promise<any>;
  speech(request: any): Promise<any>;
  image(request: any): Promise<any>;
  rerank(request: any): Promise<any>;
  health(): Promise<'healthy' | 'unhealthy' | 'degraded'>;
}
