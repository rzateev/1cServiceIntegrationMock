import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import adminAuth from '../middleware/adminAuth';

const router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }
    if (!user.isActive) {
        return res.status(403).json({ message: 'Пользователь деактивирован' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
    const token = jwt.sign(
      { userId: user._id, username: user.username, roles: user.roles },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
    res.json({ token });
  } catch (e: any) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

router.get('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

export default router;