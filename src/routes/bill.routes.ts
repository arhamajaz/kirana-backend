import { Router } from 'express';
import { BillController } from '../controllers/bill.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const billController = new BillController();

router.use(authMiddleware);

router.get('/', billController.getBills);
router.post('/', billController.createBill);
router.post('/:id/void', billController.voidBill);

export default router;
