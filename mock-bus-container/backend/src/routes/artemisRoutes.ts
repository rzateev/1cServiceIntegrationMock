import express, { Request, Response } from 'express';
import ArtemisUserService from '../services/ArtemisUserService';
import JolokiaQueueService from '../services/JolokiaQueueService';

const router = express.Router();

router.post('/users', async (req: Request, res: Response) => {
    const { username, password, role } = req.body;
    try {
        const success = await ArtemisUserService.createUser(username, password, role);
        if (success) {
            res.status(201).json({ success: true });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create user' });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/users/:username', async (req: Request, res: Response) => {
    const { username } = req.params;
    try {
        const success = await ArtemisUserService.deleteUser(username);
        if (success) {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete user' });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/queues', async (req: Request, res: Response) => {
    const { queueName } = req.body;
    try {
        const success = await JolokiaQueueService.createQueue(queueName);
        if (success) {
            res.status(201).json({ success: true });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create queue' });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/queues/:queueName', async (req: Request, res: Response) => {
    const { queueName } = req.params;
    try {
        const success = await JolokiaQueueService.deleteQueue(queueName);
        if (success) {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete queue' });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;