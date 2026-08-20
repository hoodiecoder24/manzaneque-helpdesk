import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody, validateParams, idParamsSchema } from '../validators/common.js';
import { equipmentCreateSchema, equipmentUpdateSchema } from '../validators/equipment.validators.js';
import * as equipmentController from '../controllers/equipment.controller.js';

const router = Router();

router.get('/', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), equipmentController.listEquipment);
router.get('/:id', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), validateParams(idParamsSchema), equipmentController.getEquipment);
router.post('/', requireAuth, requireRole('ADMIN'), validateBody(equipmentCreateSchema), equipmentController.createEquipment);
router.put('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), validateBody(equipmentUpdateSchema), equipmentController.updateEquipment);
router.delete('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), equipmentController.deleteEquipment);

export default router;
