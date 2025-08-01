import express from 'express';
import { getAll, getById, create, update, remove, removeByName } from '../controllers/applicationController';
import { validate } from '../middleware/validate';
import { applicationSchema } from '../schemas/applicationSchema';

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', validate(applicationSchema), create);
router.put('/:id', validate(applicationSchema), update);
router.delete('/:id', remove);
router.delete('/by-name/:name', removeByName);

export default router;