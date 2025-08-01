import express from 'express';
import { getAll, getById, getRuntimeConfig, create, update, remove, removeByName, forceRemove } from '../controllers/channelController';
import { validate } from '../middleware/validate';
import { createChannelSchema } from '../schemas/channelSchema';

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.get('/:id/runtime', getRuntimeConfig);
router.post('/', validate(createChannelSchema), create);
router.put('/:id', update);
router.delete('/:id', remove);
router.delete('/:id/force', forceRemove);
router.delete('/by-name/:name', removeByName);

export default router;
