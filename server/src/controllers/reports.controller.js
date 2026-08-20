import { asyncHandler } from '../utils/asyncHandler.js';
import * as reportsService from '../services/reports.service.js';

export const openByAge = asyncHandler(async (req, res) =>
  res.json(await reportsService.openProblemsByAge(req.query.dateFrom, req.query.dateTo)));

export const specialistWorkload = asyncHandler(async (req, res) =>
  res.json(await reportsService.specialistWorkload()));

export const equipmentFailures = asyncHandler(async (req, res) =>
  res.json(await reportsService.equipmentFailureRanking()));

export const typeFrequency = asyncHandler(async (req, res) =>
  res.json(await reportsService.problemTypeFrequency()));
