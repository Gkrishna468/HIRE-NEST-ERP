import { AIGateway } from './src/api-lib/services/AIGateway.js';
import dotenv from 'dotenv';
dotenv.config();
async function test() {
  const res = await AIGateway.processChat({
    prompt: 'Hello',
    model: 'gemini-3.1-pro-preview',
    tenantId: 'hq'
  });
  console.log(JSON.stringify(res, null, 2));
}
test();
