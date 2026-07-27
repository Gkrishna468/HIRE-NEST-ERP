import { Router } from 'express';
import { verifyAuth, requireRole } from '../middlewares/authMiddleware';
import { rufloService } from '../services/RufloIntegrationService';

const rufloHandler = Router();

rufloHandler.use(verifyAuth);

rufloHandler.post('/init', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const success = await rufloService.initialize();
    res.json({ success, message: success ? 'Ruflo initialized (L1)' : 'Initialization failed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

rufloHandler.get('/health', async (req, res) => {
  try {
    const health = await rufloService.health();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

rufloHandler.post('/execute', async (req, res) => {
  try {
    const result = await rufloService.execute(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

rufloHandler.get('/metrics', async (req, res) => {
  try {
    const metrics = await rufloService.metrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default rufloHandler;
