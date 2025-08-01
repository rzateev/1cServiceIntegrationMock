import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Расширяем интерфейс Request, чтобы добавить свойство user
interface IRequestWithUser extends Request {
  user?: any;
}

export const adminAuth = (req: IRequestWithUser, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Нет или неверный Authorization header' });
  }
  const token = authHeader.substring(7);
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!payload.roles || !payload.roles.includes('admin')) {
      return res.status(403).json({ message: 'Недостаточно прав' });
    }
    req.user = payload;
    next();
  } catch (e: any) {
    return res.status(401).json({ message: 'Неверный токен', error: e.message });
  }
};

export default adminAuth;