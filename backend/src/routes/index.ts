import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as authController from '../controllers/auth';
import * as userController from '../controllers/users';
import * as recordController from '../controllers/records';
import * as accessController from '../controllers/access';
import * as patientAccessController from '../controllers/patientAccess';
import * as auditController from '../controllers/audit';
import { blockchainService } from '../blockchain/service';
import { storageService } from '../storage/service';
import { queryOne } from '../database/connection';
import { config } from '../config';

const router = Router();

// Health check (public)
router.get('/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed system health (public - no auth required)
router.get('/system/health', async (req, res) => {
  try {
    // Database health
    let dbStatus = 'offline';
    let dbError: string | undefined;
    try {
      const dbHealth = await queryOne('SELECT 1 as alive');
      dbStatus = dbHealth ? 'online' : 'offline';
    } catch (e: any) {
      dbStatus = 'offline';
      dbError = e.message;
    }

    // Blockchain health
    let blockchainStatus: any = { status: 'offline' };
    try {
      const blockchainHealth = await blockchainService.healthCheck();
      if (blockchainHealth.connected) {
        blockchainStatus = {
          status: 'online',
          blockNumber: blockchainHealth.blockNumber,
          chainId: blockchainHealth.chainId
        };
      } else {
        blockchainStatus = { status: 'offline' };
      }
    } catch (e: any) {
      blockchainStatus = { status: 'offline', error: e.message };
    }

    // Storage health
    let storageStatus: any = { status: 'offline' };
    try {
      const storageStats = await storageService.getStorageStats();
      storageStatus = {
        status: 'online',
        totalFiles: storageStats.totalFiles,
        totalSizeBytes: storageStats.totalSize
      };
    } catch (e: any) {
      storageStatus = { status: 'offline', error: e.message };
    }

    // Contract addresses
    const contracts = {
      userRegistry: config.blockchain.contracts.userRegistry || 'Not configured',
      medicalRecordRegistry: config.blockchain.contracts.medicalRecordRegistry || 'Not configured',
      consentManager: config.blockchain.contracts.consentManager || 'Not configured',
      auditLog: config.blockchain.contracts.auditLog || 'Not configured'
    };

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbStatus, error: dbError },
        blockchain: blockchainStatus,
        storage: storageStatus
      },
      contracts
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: 'Failed to get system health' });
  }
});

// Auth routes (public)
router.post('/auth/nonce', authController.getNonce);
router.post('/auth/verify', authController.verifyWalletAuth);
router.post('/auth/refresh', authController.refreshToken);

// Protected routes
router.use(authenticateToken);

// Current user
router.get('/auth/me', authController.getCurrentUser);

// User management (Admin only)
router.post('/users/patients', requireRole('ADMIN'), userController.registerPatient);
router.post('/users/doctors', requireRole('ADMIN'), userController.registerDoctor);
router.post('/users/deactivate', requireRole('ADMIN'), userController.deactivateUser);
router.post('/users/reactivate', requireRole('ADMIN'), userController.reactivateUser);
router.get('/users', requireRole('ADMIN'), userController.getUsers);
router.get('/users/patients', requireRole('ADMIN'), userController.getPatients);
router.get('/users/doctors', requireRole('ADMIN'), userController.getDoctors);

// Doctor list (accessible by patients and doctors for discovery) - MUST be before /users/:walletAddress
router.get('/users/doctors/list', requireRole('PATIENT', 'DOCTOR'), userController.getDoctors);

router.get('/users/:walletAddress', requireRole('ADMIN'), userController.getUserByWallet);

// Dashboard stats
router.get('/dashboard/stats', userController.getDashboardStats);

// Medical Records (Patient)
router.post('/records', requireRole('PATIENT'), recordController.uploadMiddleware, recordController.uploadRecord);
router.get('/records', requireRole('PATIENT'), recordController.getMyRecords);
router.get('/records/:recordId', requireRole('PATIENT', 'DOCTOR'), recordController.getRecordById);
router.get('/records/:recordId/download', requireRole('PATIENT', 'DOCTOR'), recordController.downloadRecord);
router.get('/records/:recordId/verify', requireRole('PATIENT', 'DOCTOR', 'ADMIN'), recordController.verifyRecordIntegrity);

// Access Requests
router.post('/access/request', requireRole('DOCTOR'), accessController.requestAccess);
router.get('/access/requests', requireRole('PATIENT', 'DOCTOR'), accessController.getMyAccessRequests);
router.post('/access/requests/:requestId/approve', requireRole('PATIENT'), accessController.approveAccess);
router.post('/access/requests/:requestId/deny', requireRole('PATIENT'), accessController.denyAccess);
router.post('/access/requests/:requestId/revoke', requireRole('PATIENT'), accessController.revokeAccess);
router.get('/access/check', requireRole('DOCTOR'), accessController.checkAccess);
router.get('/access/authorized', requireRole('DOCTOR'), accessController.getAuthorizedRecords);

// Patient-to-Doctor Access Requests (new workflow)
router.post('/patient-access/request', requireRole('PATIENT'), patientAccessController.requestDoctorAccess);
router.get('/patient-access/my-requests', requireRole('PATIENT'), patientAccessController.getMyPatientRequests);
router.get('/patient-access/doctor-requests', requireRole('DOCTOR'), patientAccessController.getDoctorPatientRequests);
router.post('/patient-access/:requestId/accept', requireRole('DOCTOR'), patientAccessController.acceptPatientRequest);
router.post('/patient-access/:requestId/reject', requireRole('DOCTOR'), patientAccessController.rejectPatientRequest);
router.get('/patient-access/authorized-patients', requireRole('DOCTOR'), patientAccessController.getAuthorizedPatients);
router.get('/patient-access/connected-patients', requireRole('DOCTOR'), patientAccessController.getConnectedPatients);
router.get('/patient-access/check/:doctorWallet', requireRole('PATIENT'), patientAccessController.checkPatientAuthorization);

// Audit Logs (authenticated users see own logs, admin sees all)
router.get('/audit/logs', auditController.getAuditLogs);
router.get('/audit/logs/:logId', auditController.getAuditLogById);
router.get('/audit/actor/:walletAddress', auditController.getActorAuditLogs);
router.get('/audit/health', requireRole('ADMIN'), auditController.getSystemHealth);

export default router;