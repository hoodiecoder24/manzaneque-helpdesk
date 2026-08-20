import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateQuery, validateParams, idParamsSchema } from '../validators/common.js';
import { similarQuerySchema } from '../validators/lookup.validators.js';
import * as knowledgeController from '../controllers/knowledge.controller.js';

// Knowledge Lookup screen, operator only (ARCHITECTURE.md §4.2).
const router = Router();

router.get('/similar', requireAuth, requireRole('OPERATOR', 'ADMIN'), validateQuery(similarQuerySchema), knowledgeController.similar);
router.get('/by-equipment/:id', requireAuth, requireRole('OPERATOR', 'ADMIN'), validateParams(idParamsSchema), knowledgeController.byEquipment);
router.get('/by-caller/:id', requireAuth, requireRole('OPERATOR', 'ADMIN'), validateParams(idParamsSchema), knowledgeController.byCaller);

export default router;
