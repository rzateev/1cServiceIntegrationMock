import { Request, Response } from 'express';
import Process from '../models/Process';

export const getAll = async (req: Request, res: Response) => {
  try {
    // Проверяем наличие параметра applicationId для фильтрации
    const filter: any = {};
    if (req.query.applicationId) {
      filter.applicationId = req.query.applicationId;
    }
    
    const items = await Process.find(filter);
    res.json({ success: true, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const item = await Process.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const item = new Process(req.body);
    await item.save();
    
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const item = await Process.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

import ProcessCascadeDeleteService from '../services/ProcessCascadeDeleteService';

export const remove = async (req: Request, res: Response) => {
  try {
    const report = await ProcessCascadeDeleteService.delete(req.params.id);
    const status = report.success ? 200 : 409; // 409 Conflict
    res.status(status).json(report);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, undeletedChannels: [] });
  }
};

export const removeByName = async (req: Request, res: Response) => {
  try {
    const result = await Process.deleteMany({ name: req.params.name });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};