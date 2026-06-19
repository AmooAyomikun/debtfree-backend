import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getEmergencyPot,
  fundEmergencyPot,
  requestEmergencyLoan,
  approveEmergencyLoan
} from '../controllers/emergencyController.js';

const router = Router();
router.use(authenticate);

router.get('/:groupId', getEmergencyPot);
router.post('/:groupId/fund', fundEmergencyPot);
router.post('/:groupId/request', requestEmergencyLoan);
router.post('/:groupId/approve/:loanId', approveEmergencyLoan);

export default router;
