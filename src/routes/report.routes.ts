import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new ReportController();

router.use(authMiddleware);

router.get('/summary', controller.getReportSummary);

export default router;
