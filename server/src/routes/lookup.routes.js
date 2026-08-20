import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateParams } from '../validators/common.js';
import { z } from 'zod';
import { serialParamSchema } from '../validators/lookup.validators.js';
import * as lookupController from '../controllers/lookup.controller.js';

const employeeIdParamSchema = z.object({ employeeId: z.coerce.number().int().positive() });

const router = Router();

router.get('/caller/:employeeId', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ADMIN'), validateParams(employeeIdParamSchema), lookupController.lookupCaller);
router.get('/equipment/:serial', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ADMIN'), validateParams(serialParamSchema), lookupController.lookupEquipment);

export default router;
