import { Router } from 'express';
import authRoutes from './auth.routes.js';
import referenceDataRoutes from './referenceData.routes.js';
import employeeRoutes from './employee.routes.js';
import equipmentRoutes from './equipment.routes.js';
import problemTypeRoutes from './problemType.routes.js';
import problemRoutes from './problem.routes.js';
import lookupRoutes from './lookup.routes.js';
import knowledgeRoutes from './knowledge.routes.js';
import reportsRoutes from './reports.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/problem-types', problemTypeRoutes);
router.use('/problems', problemRoutes);
router.use('/lookup', lookupRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/reports', reportsRoutes);
router.use('/', referenceDataRoutes); // departments, job-titles, equipment-types, software, staff

export default router;
