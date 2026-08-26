import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const itemController = new ItemController();

router.use(authMiddleware);

router.get('/', itemController.getItems);
router.post('/', itemController.createItem);
router.patch('/:id', itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

export default router;
