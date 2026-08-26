import { Router } from 'express';
import { InsuranceController } from '../controllers/insurance.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const insuranceController = new InsuranceController();

router.use(authMiddleware);

router.get('/', insuranceController.getInsurance);
router.put('/', insuranceController.updateInsurance);

export default router;
