import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody, validateParams, idParamsSchema } from '../validators/common.js';
import { problemTypeCreateSchema, problemTypeUpdateSchema } from '../validators/problemType.validators.js';
import * as problemTypeController from '../controllers/problemType.controller.js';

// Everyone who logs, reclassifies or escalates a problem needs the
// cascading picker, so reads are open to every operational role.
const router = Router();

router.get('/', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), problemTypeController.listProblemTypes);
router.get('/tree', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), problemTypeController.getProblemTypeTree);
router.get('/:id', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), validateParams(idParamsSchema), problemTypeController.getProblemType);
router.post('/', requireAuth, requireRole('ADMIN'), validateBody(problemTypeCreateSchema), problemTypeController.createProblemType);
router.put('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), validateBody(problemTypeUpdateSchema), problemTypeController.updateProblemType);
router.delete('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), problemTypeController.deleteProblemType);

export default router;
