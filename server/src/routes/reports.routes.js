import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateQuery } from '../validators/common.js';
import { dateRangeQuerySchema } from '../validators/reports.validators.js';
import * as reportsController from '../controllers/reports.controller.js';

// Reports screen, analyst and admin only (ARCHITECTURE.md §4.2).
const router = Router();

router.get('/open-by-age', requireAuth, requireRole('ANALYST', 'ADMIN'), validateQuery(dateRangeQuerySchema), reportsController.openByAge);
router.get('/specialist-workload', requireAuth, requireRole('ANALYST', 'ADMIN'), reportsController.specialistWorkload);
router.get('/equipment-failures', requireAuth, requireRole('ANALYST', 'ADMIN'), reportsController.equipmentFailures);
router.get('/type-frequency', requireAuth, requireRole('ANALYST', 'ADMIN'), reportsController.typeFrequency);

export default router;
