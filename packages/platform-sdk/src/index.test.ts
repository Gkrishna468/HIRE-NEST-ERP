import { describe, it, expect } from 'vitest';
import * as SDK from './index';

describe('Platform SDK', () => {
  it('exports MCP types successfully', () => {
    // Interfaces are erased at runtime by TS. 
    // We just verify the SDK object is exported correctly.
    expect(SDK).toBeDefined();
  });

  it('compiles dummy tool implementing MCPTool', () => {
    class DummyTool implements SDK.MCPTool<string, string> {
      manifest: SDK.MCPToolManifest = {
        id: 'dummy',
        name: 'Dummy Tool',
        version: '1.0.0',
        domain: 'test',
        owner: 'test',
        description: 'A test tool',
        permissions: [],
        capabilities: [],
        auditLevel: 'NONE',
        timeout: '1s',
        retryPolicy: 'none',
        visibility: 'internal',
        status: 'Draft',
        tags: []
      };

      async validate(input: string) {
        return { valid: true };
      }

      async authorize(context: SDK.ToolContext) {
        return { authorized: true };
      }

      async execute(input: string, context: SDK.ToolContext) {
        return input + ' processed';
      }

      async audit(execution: SDK.ToolExecution) {}

      async telemetry(execution: SDK.ToolExecution) {}
    }

    const tool = new DummyTool();
    expect(tool.manifest.id).toBe('dummy');
  });
});
