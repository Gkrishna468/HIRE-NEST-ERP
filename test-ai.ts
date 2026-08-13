import { AIGateway } from './src/api-lib/services/AIGateway.js';
import dotenv from 'dotenv';
dotenv.config();
async function test() {
  const gateway = new AIGateway();
  const res = await gateway.execute({
    prompt: 'Hello',
    model: 'gemini-3.1-pro-preview',
    tenantId: 'hq'
  });
  console.log(res);
}
test();
