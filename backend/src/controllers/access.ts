import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { blockchainService, AccessLevel, ConsentStatus, AuditAction, AuditStatus } from '../blockchain/service';
import { query, queryOne } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const ACCESS_LEVEL_LABELS: Record<number, string> = {
  [AccessLevel.FULL_RECORD]: 'FULL_RECORD',
  [AccessLevel.SPECIFIC_RECORD]: 'SPECIFIC_RECORD',
  [AccessLevel.RECORD_CATEGORY]: 'RECORD_CATEGORY',
};

export async function requestAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { patientWalletAddress, recordId, accessLevel, reason, purpose, expiresInHours } = req.body;

    // Validation
    if (!patientWalletAddress || !ethers.utils.isAddress(patientWalletAddress)) {
      res.status(400).json({ error: 'Invalid patient wallet address' });
      return;
    }

    if (!reason || !purpose) {
      res.status(400).json({ error: 'Reason and purpose are required' });
      return;
    }

    // Check if doctor is requesting for themselves
    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can request access' });
      return;
    }

    // Get patient from database
    const patient = await queryOne('SELECT * FROM users WHERE wallet_address = $1 AND role = \'PATIENT\'', [patientWalletAddress.toLowerCase()]);
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Get doctor info
    const doctor = await queryOne('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    if (!doctor || doctor.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Doctor not found' });
      return;
    }

    // Check if patient is active
    if (patient.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Patient account is not active' });
      return;
    }

    // Parse expiration
    let expiresAt = 0;
    if (expiresInHours && expiresInHours > 0) {
      expiresAt = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
    }

    // Parse recordId
    let blockchainRecordId = 0n;
    if (recordId) {
      const record = await queryOne('SELECT blockchain_record_id FROM medical_records WHERE id = $1', [recordId]);
      if (record) {
        blockchainRecordId = BigInt(record.blockchain_record_id);
      }
    }

    // Request access on blockchain
    const accessLevelNum = accessLevel || AccessLevel.SPECIFIC_RECORD;
    const accessLevelLabel = ACCESS_LEVEL_LABELS[accessLevelNum] || 'SPECIFIC_RECORD';

    const blockchainRequestId = await blockchainService.requestAccess(
      patientWalletAddress.toLowerCase(),
      blockchainRecordId,
      accessLevelNum,
      reason,
      purpose,
      expiresAt
    );

    // Save to database
    const accessRequest = await queryOne(
      `INSERT INTO access_requests (patient_id, doctor_id, record_id, reason, purpose, access_level, status, blockchain_request_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [patient.id, doctor.id, recordId || null, reason, purpose, accessLevelLabel, 'PENDING', blockchainRequestId.toString(), expiresAt > 0 ? new Date(expiresAt * 1000) : null]
    );

    // Create notification for patient
    await query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [patient.id, 'ACCESS_REQUEST', 'New Access Request', `Dr. ${doctor.name} requested access to your medical records`, 'ACCESS_REQUEST', accessRequest.id]
    );

    // Log audit
    await blockchainService.logAudit(
      req.user!.walletAddress,
      'DOCTOR',
      AuditAction.ACCESS_REQUESTED,
      'ACCESS_REQUEST',
      blockchainRequestId,
      accessRequest.id,
      AuditStatus.SUCCESS,
      '',
      { 
        patientWallet: patientWalletAddress,
        recordId: blockchainRecordId.toString(),
        accessLevel,
        reason,
        expiresAt
      }
    );

    logger.info('Access requested', { 
      doctorId: doctor.id, 
      patientId: patient.id, 
      blockchainRequestId: blockchainRequestId.toString() 
    });

    res.status(201).json({ 
      accessRequest,
      blockchainRequestId: blockchainRequestId.toString()
    });
  } catch (error: any) {
    const detail = error?.reason || error?.shortMessage || error?.message || error?.detail || String(error);
    logger.error('Error requesting access', { error: detail, stack: error?.stack });
    res.status(500).json({ error: 'Failed to request access', detail });
  }
}

export async function getMyAccessRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let requests: any[] = [];

    if (req.user!.role === 'PATIENT') {
      // Patient sees requests for their records
      requests = await query(
        `SELECT ar.*, u.name as doctor_name, u.wallet_address as doctor_wallet, u.identifier as doctor_license,
                mr.record_name, mr.id as record_uuid
         FROM access_requests ar
         JOIN users u ON ar.doctor_id = u.id
         LEFT JOIN medical_records mr ON ar.record_id = mr.id
         WHERE ar.patient_id = $1
         ORDER BY ar.requested_at DESC`,
        [req.user!.userId]
      );
    } else if (req.user!.role === 'DOCTOR') {
      // Doctor sees their own requests
      requests = await query(
        `SELECT ar.*, u.name as patient_name, u.wallet_address as patient_wallet, u.identifier as patient_id,
                mr.record_name, mr.id as record_uuid
         FROM access_requests ar
         JOIN users u ON ar.patient_id = u.id
         LEFT JOIN medical_records mr ON ar.record_id = mr.id
         WHERE ar.doctor_id = $1
         ORDER BY ar.requested_at DESC`,
        [req.user!.userId]
      );
    } else {
      res.status(403).json({ error: 'Invalid role' });
      return;
    }

    // Get blockchain status for each request
    const requestsWithBlockchain = await Promise.all(
      requests.map(async (r) => {
        if (r.blockchain_request_id) {
          try {
            const blockchainRequest = await blockchainService.getRequest(BigInt(r.blockchain_request_id));
            return { ...r, blockchainRequest };
          } catch (e) {
            return r;
          }
        }
        return r;
      })
    );

    res.json({ requests: requestsWithBlockchain });
  } catch (error) {
    logger.error('Error getting access requests', { error });
    res.status(500).json({ error: 'Failed to get access requests' });
  }
}

export async function approveAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;

    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can approve access' });
      return;
    }

    // Get request from database
    const accessRequest = await queryOne(
      `SELECT ar.*, u.wallet_address as doctor_wallet, u.name as doctor_name
       FROM access_requests ar
       JOIN users u ON ar.doctor_id = u.id
       WHERE ar.id = $1 AND ar.patient_id = $2`,
      [requestId, req.user!.userId]
    );

    if (!accessRequest) {
      res.status(404).json({ error: 'Access request not found' });
      return;
    }

    if (accessRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    // Check expiration
    if (accessRequest.expires_at && new Date(accessRequest.expires_at) < new Date()) {
      res.status(400).json({ error: 'Request has expired' });
      return;
    }

    // Approve on blockchain
    let txHash = '';
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : null;
      if (blockchainRequestId !== null) {
        txHash = await blockchainService.approveAccess(
          blockchainRequestId,
          blockchainService.getWallet()
        );
      } else {
        logger.warn('No blockchain_request_id, proceeding with database only', { requestId });
        txHash = 'db-only-' + Date.now();
      }
    } catch (blockchainError: any) {
      logger.warn('Blockchain approval failed, proceeding with database only', { error: blockchainError.message, requestId });
      txHash = 'db-only-' + Date.now();
    }

    // Update database
    try {
      await query(
        `UPDATE access_requests SET status = 'APPROVED', decided_at = CURRENT_TIMESTAMP, tx_hash_decided = $1 WHERE id = $2`,
        [txHash, requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to update access_requests', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
      res.status(500).json({ error: 'Failed to update access request status' });
      return;
    }

    // Create consent record
    try {
      await query(
        `INSERT INTO consents (access_request_id, patient_id, doctor_id, record_id, status, expires_at, blockchain_tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [requestId, accessRequest.patient_id, accessRequest.doctor_id, accessRequest.record_id || null, 'APPROVED', accessRequest.expires_at || null, txHash]
      );
    } catch (dbError: any) {
      logger.error('Failed to insert consent', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
      res.status(500).json({ error: 'Failed to create consent record' });
      return;
    }

    // Create notification for doctor
    try {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accessRequest.doctor_id, 'ACCESS_APPROVED', 'Access Approved', 'Your access request has been approved', 'ACCESS_REQUEST', requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to insert notification', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
      // Notification failure is non-critical — approval already saved
    }

    // Log audit (non-critical — failure must not block the approval)
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : 0n;
      await blockchainService.logAudit(
        req.user!.walletAddress,
        'PATIENT',
        AuditAction.ACCESS_APPROVED,
        'ACCESS_REQUEST',
        blockchainRequestId,
        requestId,
        AuditStatus.SUCCESS,
        txHash,
        { doctorWallet: accessRequest.doctor_wallet }
      );
    } catch (auditError: any) {
      logger.warn('Audit log failed (non-critical)', { error: auditError.message, requestId });
    }

    logger.info('Access approved', { requestId, txHash });

    res.json({ message: 'Access approved successfully', txHash });
  } catch (error: any) {
    logger.error('Error approving access', { error: error?.message || error, stack: error?.stack });
    res.status(500).json({ error: 'Failed to approve access' });
  }
}

export async function denyAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;

    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can deny access' });
      return;
    }

    const accessRequest = await queryOne(
      `SELECT ar.*, u.wallet_address as doctor_wallet
       FROM access_requests ar
       JOIN users u ON ar.doctor_id = u.id
       WHERE ar.id = $1 AND ar.patient_id = $2`,
      [requestId, req.user!.userId]
    );

    if (!accessRequest) {
      res.status(404).json({ error: 'Access request not found' });
      return;
    }

    if (accessRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    let txHash = '';
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : null;
      if (blockchainRequestId !== null) {
        txHash = await blockchainService.denyAccess(
          blockchainRequestId,
          blockchainService.getWallet()
        );
      } else {
        txHash = 'db-only-' + Date.now();
      }
    } catch (blockchainError: any) {
      logger.warn('Blockchain deny failed, proceeding with database only', { error: blockchainError.message, requestId });
      txHash = 'db-only-' + Date.now();
    }

    try {
      await query(
        `UPDATE access_requests SET status = 'DENIED', decided_at = CURRENT_TIMESTAMP, tx_hash_decided = $1 WHERE id = $2`,
        [txHash, requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to update access_requests (deny)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
      res.status(500).json({ error: 'Failed to update access request status' });
      return;
    }

    try {
      await query(
        `INSERT INTO consents (access_request_id, patient_id, doctor_id, record_id, status, blockchain_tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [requestId, accessRequest.patient_id, accessRequest.doctor_id, accessRequest.record_id || null, 'DENIED', txHash]
      );
    } catch (dbError: any) {
      logger.error('Failed to insert consent (deny)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
    }

    try {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accessRequest.doctor_id, 'ACCESS_DENIED', 'Access Denied', 'Your access request has been denied', 'ACCESS_REQUEST', requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to insert notification (deny)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
    }

    // Log audit (non-critical — failure must not block the denial)
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : 0n;
      await blockchainService.logAudit(
        req.user!.walletAddress,
        'PATIENT',
        AuditAction.ACCESS_DENIED,
        'ACCESS_REQUEST',
        blockchainRequestId,
        requestId,
        AuditStatus.SUCCESS,
        txHash,
        { doctorWallet: accessRequest.doctor_wallet }
      );
    } catch (auditError: any) {
      logger.warn('Audit log failed (non-critical)', { error: auditError.message, requestId });
    }

    logger.info('Access denied', { requestId, txHash });

    res.json({ message: 'Access denied', txHash });
  } catch (error: any) {
    logger.error('Error denying access', { error: error?.message || error, stack: error?.stack });
    res.status(500).json({ error: 'Failed to deny access' });
  }
}

export async function revokeAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;

    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can revoke access' });
      return;
    }

    const accessRequest = await queryOne(
      `SELECT ar.*, u.wallet_address as doctor_wallet
       FROM access_requests ar
       JOIN users u ON ar.doctor_id = u.id
       WHERE ar.id = $1 AND ar.patient_id = $2`,
      [requestId, req.user!.userId]
    );

    if (!accessRequest) {
      res.status(404).json({ error: 'Access request not found' });
      return;
    }

    if (accessRequest.status !== 'APPROVED') {
      res.status(400).json({ error: 'Access is not currently approved' });
      return;
    }

    let txHash = '';
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : null;
      if (blockchainRequestId !== null) {
        txHash = await blockchainService.revokeAccess(
          blockchainRequestId,
          blockchainService.getWallet()
        );
      } else {
        txHash = 'db-only-' + Date.now();
      }
    } catch (blockchainError: any) {
      logger.warn('Blockchain revoke failed, proceeding with database only', { error: blockchainError.message, requestId });
      txHash = 'db-only-' + Date.now();
    }

    try {
      await query(
        `UPDATE access_requests SET status = 'REVOKED', decided_at = CURRENT_TIMESTAMP, tx_hash_decided = $1 WHERE id = $2`,
        [txHash, requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to update access_requests (revoke)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
      res.status(500).json({ error: 'Failed to update access request status' });
      return;
    }

    try {
      await query(
        `UPDATE consents SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE access_request_id = $1`,
        [requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to update consents (revoke)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
    }

    try {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accessRequest.doctor_id, 'ACCESS_REVOKED', 'Access Revoked', 'Your access has been revoked by the patient', 'ACCESS_REQUEST', requestId]
      );
    } catch (dbError: any) {
      logger.error('Failed to insert notification (revoke)', { error: dbError?.message, detail: dbError?.detail, code: dbError?.code, requestId });
    }

    // Log audit (non-critical — failure must not block the revocation)
    try {
      const blockchainRequestId = accessRequest.blockchain_request_id
        ? BigInt(accessRequest.blockchain_request_id)
        : 0n;
      await blockchainService.logAudit(
        req.user!.walletAddress,
        'PATIENT',
        AuditAction.ACCESS_REVOKED,
        'ACCESS_REQUEST',
        blockchainRequestId,
        requestId,
        AuditStatus.SUCCESS,
        txHash,
        { doctorWallet: accessRequest.doctor_wallet }
      );
    } catch (auditError: any) {
      logger.warn('Audit log failed (non-critical)', { error: auditError.message, requestId });
    }

    logger.info('Access revoked', { requestId, txHash });

    res.json({ message: 'Access revoked successfully', txHash });
  } catch (error: any) {
    logger.error('Error revoking access', { error: error?.message || error, stack: error?.stack });
    res.status(500).json({ error: 'Failed to revoke access' });
  }
}

export async function checkAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const patientWalletAddress = req.query.patientWalletAddress as string;
    const recordId = req.query.recordId as string | undefined;

    if (!patientWalletAddress || !ethers.utils.isAddress(patientWalletAddress)) {
      res.status(400).json({ error: 'Invalid patient wallet address' });
      return;
    }

    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can check access' });
      return;
    }

    const doctor = await queryOne('SELECT wallet_address FROM users WHERE id = $1', [req.user!.userId]);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    let blockchainRecordId = 0n;
    if (recordId) {
      const record = await queryOne('SELECT blockchain_record_id FROM medical_records WHERE id = $1', [recordId as string]);
      if (record) {
        blockchainRecordId = BigInt(record.blockchain_record_id);
      }
    }

    const accessCheck = await blockchainService.checkAccess(
      doctor.wallet_address,
      patientWalletAddress.toLowerCase(),
      blockchainRecordId
    );

    res.json({ 
      hasAccess: accessCheck.hasAccess,
      status: accessCheck.status,
      expiresAt: accessCheck.expiresAt.toString()
    });
  } catch (error) {
    logger.error('Error checking access', { error });
    res.status(500).json({ error: 'Failed to check access' });
  }
}

export async function getAuthorizedRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can view authorized records' });
      return;
    }

    // Get all approved access requests for this doctor
    const requests = await query(
      `SELECT ar.*, u.name as patient_name, u.wallet_address as patient_wallet,
              mr.record_name, mr.storage_cid, mr.mime_type, mr.file_hash, mr.id as record_uuid
       FROM access_requests ar
       JOIN users u ON ar.patient_id = u.id
       LEFT JOIN medical_records mr ON ar.record_id = mr.id
       WHERE ar.doctor_id = $1 AND ar.status = 'APPROVED'
       ORDER BY ar.decided_at DESC`,
      [req.user!.userId]
    );

    // Filter by current blockchain status (check expiration/revocation)
    const authorizedRecords = [];
    for (const r of requests) {
      if (r.blockchain_request_id) {
        try {
          const blockchainRequest = await blockchainService.getRequest(BigInt(r.blockchain_request_id));
          if (blockchainRequest && blockchainRequest.status === 1) { // APPROVED
            // Check expiration
            if (blockchainRequest.expiresAt === 0n || blockchainRequest.expiresAt > BigInt(Math.floor(Date.now() / 1000))) {
              authorizedRecords.push({ ...r, blockchainRequest });
            }
          }
        } catch (e) {
          // If blockchain query fails, include based on DB status
          authorizedRecords.push(r);
        }
      } else {
        authorizedRecords.push(r);
      }
    }

    res.json({ records: authorizedRecords });
  } catch (error) {
    logger.error('Error getting authorized records', { error });
    res.status(500).json({ error: 'Failed to get authorized records' });
  }
}