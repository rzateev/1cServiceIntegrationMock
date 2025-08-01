import { Request, Response } from 'express';
import Channel from '../models/Channel';
import Process from '../models/Process';
import Application from '../models/Application';
import JolokiaQueueService from '../services/JolokiaQueueService';
import logger from '../services/logger';

export const getAll = async (req: Request, res: Response) => {
  try {
    const items = await Channel.find();
    res.json({ success: true, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const item = await Channel.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getRuntimeConfig = async (req: Request, res: Response) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, message: 'Not found' });

    const proc = await Process.findById(channel.processId);
    if (!proc) return res.status(404).json({ success: false, message: 'Process not found' });

    const application = await Application.findById(proc.applicationId);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const host = process.env.AMQP_HOST || 'localhost';
    const port = process.env.ARTEMIS_AMQP_PORT || 6698;

    const runtimeConfig = {
      channel: channel.name,
      amqp: {
        host: host,
        port: port,
        protocol: 'AMQP_1_0',
        exchange: 'amq.direct', // Or any other logic
        routingKey: channel.name,
        // В подходе 1С:Шины клиент использует id_token напрямую для подключения к AMQP
        // Учетные данные не передаются в runtime конфигурации
      }
    };

    res.json({ success: true, data: runtimeConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    // Очищаем имя канала от лишних символов
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }
    
    // Устанавливаем destination по умолчанию, если не указан
    if (!req.body.destination) {
      req.body.destination = 'Office';
    }
    
            logger.info(`Creating queue for channel: ${req.body.name} with destination: ${req.body.destination}`);
    let queueResult = null;
    try {
      queueResult = await JolokiaQueueService.createQueue(req.body.destination);
              logger.debug(`Queue creation result for ${req.body.destination}:`, { result: queueResult });
    } catch (err) {
      console.error(`[DIAG] Ошибка при создании очереди ${req.body.destination}:`, err);
    }
    const item = new Channel(req.body);
    await item.save();
    res.status(201).json({ success: true, data: item, queueResult });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    // Очищаем имя канала от лишних символов
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }
    
    const oldChannel = await Channel.findById(req.params.id);
    if (!oldChannel) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    
    // Проверяем, изменился ли destination (имя очереди в Artemis)
    const oldQueueName = oldChannel.destination || oldChannel.name;
    const newQueueName = req.body.destination || req.body.name || oldQueueName;
    
    // Если изменилось имя очереди, проверяем наличие сообщений в старой очереди
    if (oldQueueName !== newQueueName) {
      const messageCount = await JolokiaQueueService.getQueueMessageCount(oldQueueName);
      if (messageCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Невозможно переименовать канал, так как очередь "${oldQueueName}" содержит ${messageCount} сообщений.`
        });
      }
    }
    
    const newChannel = await Channel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!newChannel) return res.status(404).json({ success: false, message: 'Not found' });

    // Если изменилось имя очереди, удаляем старую и создаем новую
    if (oldQueueName !== newQueueName) {
      try {
        await JolokiaQueueService.deleteQueue(oldQueueName);
        await JolokiaQueueService.createQueue(newQueueName);
        logger.info(`Queue renamed: "${oldQueueName}" -> "${newQueueName}"`);
      } catch (queueErr: any) {
        console.error(`[DIAG] Ошибка при переименовании очереди:`, queueErr.message);
        // Не возвращаем ошибку, так как канал уже обновлен в БД
      }
    }
    
    res.json({ success: true, data: newChannel });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Канал не найден' });
    }

    // Используем destination для работы с очередью в Artemis
    const queueName = channel.destination || channel.name;
    
    const messageCount = await JolokiaQueueService.getQueueMessageCount(queueName);
    if (messageCount > 0) {
      return res.status(409).json({ // 409 Conflict
        success: false, 
        message: `Невозможно удалить канал, так как его очередь "${queueName}" содержит ${messageCount} сообщений.`
      });
    }

    await JolokiaQueueService.deleteQueue(queueName);
    await Channel.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: `Канал и связанная очередь "${queueName}" успешно удалены` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const removeByName = async (req: Request, res: Response) => {
  try {
    const channels = await Channel.find({ name: req.params.name });
    if (channels.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

    for (const channel of channels) {
        // Используем destination для работы с очередью в Artemis
        const queueName = channel.destination || channel.name;
        
        // Проверяем наличие сообщений в очереди
        const messageCount = await JolokiaQueueService.getQueueMessageCount(queueName);
        if (messageCount > 0) {
          return res.status(409).json({
            success: false,
            message: `Невозможно удалить канал "${channel.name}", так как его очередь "${queueName}" содержит ${messageCount} сообщений.`
          });
        }
        
        await JolokiaQueueService.deleteQueue(queueName);
        await Channel.findByIdAndDelete(channel._id);
    }

    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const forceRemove = async (req: Request, res: Response) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Канал не найден' });
    }

    // Используем destination для работы с очередью в Artemis
    const queueName = channel.destination || channel.name;

    // Принудительно удаляем очередь и канал без проверки сообщений
    try {
      await JolokiaQueueService.deleteQueue(queueName);
    } catch (queueErr: any) {
      console.warn(`Ошибка удаления очереди ${queueName}:`, queueErr.message);
    }
    
    await Channel.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: `Канал и очередь "${queueName}" принудительно удалены` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
