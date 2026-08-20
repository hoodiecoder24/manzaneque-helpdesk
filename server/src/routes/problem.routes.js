import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody, validateQuery, validateParams, idParamsSchema } from '../validators/common.js';
import {
  problemCreateSchema, problemListQuerySchema, followUpCallSchema, reclassifySchema, resolveSchema
} from '../validators/problem.validators.js';
import * as problemController from '../controllers/problem.controller.js';

const router = Router();

router.get('/', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), validateQuery(problemListQuerySchema), problemController.listProblems);
router.get('/:id', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), validateParams(idParamsSchema), problemController.getProblem);

// -> sp_log_new_call. Log a Call screen, operator only.
router.post('/', requireAuth, requireRole('OPERATOR', 'ADMIN'), validateBody(problemCreateSchema), problemController.createProblem);

// Follow-up call: operator or the specialist working the ticket.
router.post('/:id/calls', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ADMIN'), validateParams(idParamsSchema), validateBody(followUpCallSchema), problemController.addFollowUpCall);

// Reclassification: Problem Detail screen, operator or specialist.
router.patch('/:id/type', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ADMIN'), validateParams(idParamsSchema), validateBody(reclassifySchema), problemController.reclassifyProblem);

// Escalation modal: operator only (ARCHITECTURE.md §4.2).
router.post('/:id/assign', requireAuth, requireRole('OPERATOR', 'ADMIN'), validateParams(idParamsSchema), problemController.assignProblem);

// -> sp_resolve_problem. Specialist resolves their own assigned work.
router.post('/:id/resolve', requireAuth, requireRole('SPECIALIST', 'ADMIN'), validateParams(idParamsSchema), validateBody(resolveSchema), problemController.resolveProblem);

export default router;
