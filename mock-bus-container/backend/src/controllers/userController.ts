import { Request, Response } from 'express';
import User from '../models/User';

export const getAll = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    // Контроллер работает с чистым паролем, модель сама его хэширует
    const user = new User(req.body);
    await user.save();
    // Не возвращаем пароль клиенту
    const { password, ...userData } = user.toObject();
    res.status(201).json({ success: true, data: userData });
  } catch (err: any) {
    // Обработка ошибки дублирования username
    if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Пользователь с таким именем уже существует' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Обновляем поля
    Object.assign(user, req.body);

    // Вызываем save(), чтобы сработал хук хэширования пароля
    await user.save();

    const { password, ...userData } = user.toObject();
    res.json({ success: true, data: userData });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    res.json({ success: true, message: 'Пользователь удален' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
