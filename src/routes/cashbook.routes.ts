import { Router } from 'express';
import { CashbookController } from '../controllers/cashbook.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const cashbookController = new CashbookController();

router.use(authMiddleware);

router.get('/', cashbookController.getCashbook);
router.post('/', cashbookController.createCashbookEntry);
router.post('/:id/void', cashbookController.voidCashbookEntry);

export default router;
