import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as problemTypeService from '../services/problemType.service.js';

export const listProblemTypes = asyncHandler(async (req, res) => res.json(await problemTypeService.listProblemTypesFlat()));

export const getProblemTypeTree = asyncHandler(async (req, res) => res.json(await problemTypeService.getProblemTypeTree()));

export const getProblemType = asyncHandler(async (req, res, next) => {
  const problemType = await problemTypeService.getProblemType(req.params.id);
  if (!problemType) return next(ApiError.notFound('Problem type not found'));
  res.json(problemType);
});

export const createProblemType = asyncHandler(async (req, res) => {
  const problemType = await problemTypeService.createProblemType(req.body);
  res.status(201).json(problemType);
});

export const updateProblemType = asyncHandler(async (req, res, next) => {
  const existing = await problemTypeService.getProblemType(req.params.id);
  if (!existing) return next(ApiError.notFound('Problem type not found'));
  res.json(await problemTypeService.updateProblemType(req.params.id, req.body));
});

export const deleteProblemType = asyncHandler(async (req, res, next) => {
  const existing = await problemTypeService.getProblemType(req.params.id);
  if (!existing) return next(ApiError.notFound('Problem type not found'));
  await problemTypeService.deleteProblemType(req.params.id);
  res.status(204).send();
});
