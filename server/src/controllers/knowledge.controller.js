import { asyncHandler } from '../utils/asyncHandler.js';
import * as knowledgeService from '../services/knowledge.service.js';

export const similar = asyncHandler(async (req, res) =>
  res.json(await knowledgeService.knowledgeBySimilarType(req.query.problemTypeId)));

export const byEquipment = asyncHandler(async (req, res) =>
  res.json(await knowledgeService.knowledgeByEquipment(req.params.id)));

export const byCaller = asyncHandler(async (req, res) =>
  res.json(await knowledgeService.knowledgeByCaller(req.params.id)));
