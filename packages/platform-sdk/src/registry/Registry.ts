import { MCPToolManifest } from '../mcp/MCPToolManifest';
import { MCPTool } from '../mcp/MCPTool';

/**
 * RegistryAPI handles the discovery and lifecycle of MCP tools.
 */
export interface RegistryAPI {
  /** Registers a new tool into the registry */
  register(tool: MCPTool): void;
  
  /** Discovers tools matching a specific query */
  discover(query: Record<string, any>): MCPToolManifest[];
  
  /** Resolves a specific tool instance by ID and optional version */
  resolve(id: string, version?: string): MCPTool | undefined;
  
  /** Retrieves the health status of all registered tools */
  health(): Record<string, 'healthy' | 'unhealthy' | 'unknown'>;
  
  /** Lists all available versions of a specific tool */
  versions(id: string): string[];
  
  /** Marks a tool version as deprecated */
  deprecate(id: string, version: string): void;
  
  /** Removes a tool version from the registry */
  remove(id: string, version: string): void;
}
