import { Request, Response } from 'express';
import Application from '../models/Application';
import ArtemisUserService from '../services/ArtemisUserService';
import logger from '../services/logger';
import crypto from 'crypto';

export const getAll = async (req: Request, res: Response) => {
  try {
    const apps = await Application.find();
    res.json({ success: true, data: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: app });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    // Генерируем id_token для AMQP аутентификации (подход 1С:Шины)
    // Используем только безопасные символы для Artemis
    const id_token = crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, 'x')
      .replace(/\//g, 'y')
      .replace(/=/g, 'z');
    const clientSecret = crypto.randomBytes(16).toString('hex');

            logger.info(`Creating user in Artemis: ${id_token}`);
    const artemisUserResult = await ArtemisUserService.createUser(id_token, id_token);
          logger.debug(`Artemis user creation result for ${id_token}:`, { result: artemisUserResult });

    const app = new Application({ ...req.body, clientSecret, id_token });
    await app.save();

    res.status(201).json({ success: true, data: app });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });

    // Обновляем только разрешенные поля (name, description)
    // В подходе 1С:Шины id_token не изменяется после создания
    const { name, description } = req.body;
    const updatedApp = await Application.findByIdAndUpdate(
      req.params.id, 
      { name, description }, 
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updatedApp });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

import ApplicationCascadeDeleteService from '../services/ApplicationCascadeDeleteService';

export const remove = async (req: Request, res: Response) => {
  try {
    const report = await ApplicationCascadeDeleteService.delete(req.params.id);
    const status = report.success ? 200 : 409; // 409 Conflict, если не удалось удалить
    res.status(status).json(report);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, undeletedChannels: [] });
  }
}; 

export const removeByName = async (req: Request, res: Response) => {
  try {
    const app = await Application.findOne({ name: req.params.name });
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });

    // Удаляем пользователя из Artemis по id_token
    if (app.id_token) {
      await ArtemisUserService.deleteUser(app.id_token);
    }

    await Application.findByIdAndDelete(app._id);

    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
