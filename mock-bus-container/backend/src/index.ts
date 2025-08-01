import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import logger from './services/logger';
import rhea from 'rhea';
// import morgan from 'morgan'; // Morgan больше не нужен
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import connectDB from './db';
import applicationRoutes from './routes/applicationRoutes';
import processRoutes from './routes/processRoutes';
import channelRoutes from './routes/channelRoutes';
import userRoutes from './routes/userRoutes';
import artemisRoutes from './routes/artemisRoutes';
import testIntegrationRoutes from './routes/testIntegrationRoutes';
import esbEmulationRoutes from './routes/esbEmulationRoutes';
import exportImportRoutes from './routes/exportImportRoutes';
import adminRoutes from './routes/adminRoutes';
import ArtemisConfiguratorService from './services/ArtemisConfiguratorService';
import Application from './models/Application';
import initAdmin from './initAdmin';

import validateEnv from './config/validateEnv';

dotenv.config();
validateEnv(); // Проверяем переменные окружения при старте

const PORT = process.env.MOCK_API_PORT || 9090;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(morgan('dev')); // Morgan больше не нужен
app.use(cors());

// Middleware для логирования запросов через Winston
app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`,
            {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        );
    });
    next();
});

app.use('/api/applications', applicationRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/artemis', artemisRoutes);
app.use('/api/test', testIntegrationRoutes);
app.use(esbEmulationRoutes); // Без префикса /api/ для совместимости с 1C
app.use(exportImportRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
});

// Swagger/OpenAPI конфиг
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mock Service Integration 1C API',
      version: '1.0.0',
      description: 'Документация mock-сервиса интеграции 1С для интеграции и тестирования',
    },
    servers: [
      { url: process.env.MOCK_API_URL || `http://localhost:${PORT}` },
    ],
  },
  apis: ['./routes/*.ts'], // Указываем на .ts файлы
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mock OAuth 2.0 endpoint
app.post('/auth/oidc/token', async (req: Request, res: Response) => {
  logger.info('OIDC Token request', { 
    headers: Object.keys(req.headers),
    bodyKeys: Object.keys(req.body || {})
  });

  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const base64 = authHeader.substring(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf8');
  const [clientId, clientSecret] = decoded.split(':');

  if (!clientId || !clientSecret) {
    return res.status(401).json({ error: 'Invalid client credentials' });
  }

  const grantType = req.body.grant_type;
  if (grantType !== 'client_credentials') {
    return res.status(400).json({ error: 'Invalid grant_type' });
  }

  const app = await Application.findOne({ name: clientId, clientSecret });
  if (!app) {
    return res.status(401).json({ error: 'Invalid client credentials' });
  }

  // Возвращаем id_token напрямую (подход 1С:Шины)
  const response = {
    id_token: app.id_token,
    access_token: app.id_token,
    token_type: 'Bearer',
    expires_in: 3600
  };
  res.json(response);
});

// Глобальный обработчик ошибок
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});


(async () => {
  await connectDB();
  await initAdmin();
  await ArtemisConfiguratorService.configure();
  app.listen(PORT, () => logger.info(`Server started on port ${PORT}`));
})();