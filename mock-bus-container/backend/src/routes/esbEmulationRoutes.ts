import express, { Request, Response, NextFunction } from 'express';
import Application from '../models/Application';
import Process from '../models/Process';
import Channel from '../models/Channel';
import logger from '../services/logger';

const router = express.Router();

// Middleware для проверки Bearer token (заглушка)
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    logger.warn('ESB Authentication failed: Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  next();
}

// GET /applications/:application/sys/esb/metadata/channels
router.get('/applications/:application/sys/esb/metadata/channels', authMiddleware, async (req: Request, res: Response) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  logger.info(`ESB Metadata request: ${fullUrl}`, { params: req.params });
  
  try {
    const app = await Application.findOne({ name: req.params.application });
    logger.debug(`ESB App lookup: ${app ? app.name : 'not found'}`);
    
    if (!app) {
      logger.warn(`ESB App not found: ${req.params.application}`);
      return res.status(404).json([]);
    }

    const processes = await Process.find({ applicationId: app._id });
    const channels = await Channel.find({ processId: { $in: processes.map(p => p._id) } });
    logger.debug(`ESB Found: ${processes.length} processes, ${channels.length} channels`);

    const result = channels.map(ch => {
      const proc = processes.find(p => p._id.equals(ch.processId));
      return {
        process: proc ? proc.name || '' : '',
        processDescription: proc ? proc.description || '' : '',
        channel: ch.name || '',
        channelDescription: ch.direction || '',
        access: ch.direction === 'inbound' ? 'READ_ONLY' : 'WRITE_ONLY'
      };
    });

    logger.info(`ESB Metadata response: ${result.length} channels`);
    res.json(result);
  } catch (e: any) {
    logger.error('ESB Metadata error:', { error: e.message, stack: e.stack });
    res.status(500).json({ error: e.message });
  }
});

// GET /applications/:application/sys/esb/runtime/channels
router.get('/applications/:application/sys/esb/runtime/channels', authMiddleware, async (req: Request, res: Response) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  logger.info(`ESB Runtime request: ${fullUrl}`, { params: req.params });
  
  try {
    const app = await Application.findOne({ name: req.params.application }).sort({ createdAt: -1 });
    if (!app) {
      logger.warn(`ESB Runtime app not found: ${req.params.application}`);
      return res.status(401).json({ error: 'Invalid token or application' });
    }

    const processes = await Process.find({ applicationId: app._id });
    const channels = await Channel.find({ processId: { $in: processes.map(p => p._id) } });

    const items = channels.map(ch => {
      const proc = processes.find(p => p._id.toString() === ch.processId.toString());
      return {
        process: proc ? proc.name || '' : '',
        channel: ch.name || '',
        destination: ch.destination || 'Office'
      };
    });

    const responseBody = { items, port: parseInt(process.env.ARTEMIS_AMQP_PORT || '6698') };
    logger.info(`ESB Runtime response: ${items.length} channels`);
    res.json(responseBody);
  } catch (e: any) {
    logger.error('ESB Runtime error:', { error: e.message, stack: e.stack });
    res.status(500).json({ error: e.message });
  }
});

export default router;
