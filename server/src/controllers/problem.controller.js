import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as problemService from '../services/problem.service.js';

export const listProblems = asyncHandler(async (req, res) => res.json(await problemService.listProblems(req.query)));

export const getProblem = asyncHandler(async (req, res, next) => {
  const problem = await problemService.getProblem(req.params.id);
  if (!problem) return next(ApiError.notFound('Problem not found'));
  res.json(problem);
});

// -> sp_log_new_call. Returns the problem number for the operator to
// quote back to the caller immediately.
export const createProblem = asyncHandler(async (req, res) => {
  const result = await problemService.logNewCall(req.body, req.user.staffId);
  res.status(201).json({ problemId: result.problemId, problemNumber: result.problemNumber });
});

export const addFollowUpCall = asyncHandler(async (req, res, next) => {
  const problem = await problemService.getProblem(req.params.id);
  if (!problem) return next(ApiError.notFound('Problem not found'));
  await problemService.addFollowUpCall(req.params.id, req.user.staffId, req.body.notes);
  res.status(201).json(await problemService.getProblem(req.params.id));
});

export const reclassifyProblem = asyncHandler(async (req, res, next) => {
  const problem = await problemService.getProblem(req.params.id);
  if (!problem) return next(ApiError.notFound('Problem not found'));
  await problemService.reclassifyProblem(req.params.id, req.body.problemTypeId);
  res.json(await problemService.getProblem(req.params.id));
});

// -> sp_assign_least_loaded. If no ancestor problem type has a qualified
// specialist, assignedStaffId comes back null — the operator has to
// escalate manually (see PROGRESS.md assumption on fallback exhaustion).
export const assignProblem = asyncHandler(async (req, res, next) => {
  const problem = await problemService.getProblem(req.params.id);
  if (!problem) return next(ApiError.notFound('Problem not found'));
  const result = await problemService.assignLeastLoaded(req.params.id);
  if (result.assignedStaffId === null) {
    return res.status(409).json({
      error: { code: 'NO_SPECIALIST_AVAILABLE', message: 'No qualified specialist found for this problem type or any of its ancestors. Escalate manually.' }
    });
  }
  res.json(await problemService.getProblem(req.params.id));
});

export const resolveProblem = asyncHandler(async (req, res, next) => {
  const problem = await problemService.getProblem(req.params.id);
  if (!problem) return next(ApiError.notFound('Problem not found'));
  await problemService.resolveProblem(req.params.id, req.body.resolutionNotes, req.user.staffId);
  res.json(await problemService.getProblem(req.params.id));
});
