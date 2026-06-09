import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import {
  getGroups,
  createGroup,
  getGroupDetail,
  getGroupDetailsByInviteCode,
  joinGroupByInviteCode,
  deleteGroup,
  addExpense,
  deleteExpense,
  addSettlement,
  inviteMember
} from '../controllers/groupController.js';

const router = Router();

// Public route: fetch invite details before logging in/joining if needed
router.get('/invite/:inviteCode', generalLimiter, getGroupDetailsByInviteCode);

// Authenticated routes
router.use(authenticate);

router.get('/', generalLimiter, getGroups);
router.post('/', generalLimiter, createGroup);
router.post('/join', generalLimiter, joinGroupByInviteCode);
router.get('/:id', generalLimiter, getGroupDetail);
router.delete('/:id', generalLimiter, deleteGroup);
router.post('/:id/invite', generalLimiter, inviteMember);

// Expenses
router.post('/:id/expenses', generalLimiter, addExpense);
router.delete('/:id/expenses/:expenseId', generalLimiter, deleteExpense);

// Settlements
router.post('/:id/settlements', generalLimiter, addSettlement);

export default router;
