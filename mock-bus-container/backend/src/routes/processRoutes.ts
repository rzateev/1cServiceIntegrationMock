import express from 'express';
import { getAll, getById, create, update, remove, removeByName } from '../controllers/processController';
import { validate } from '../middleware/validate';
import { processSchema } from '../schemas/processSchema';

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', validate(processSchema), create);
router.put('/:id', validate(processSchema), update);
router.delete('/:id', remove);
router.delete('/by-name/:name', removeByName);

export default router;
