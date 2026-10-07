import { Response } from 'express';
import { query, queryOne } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Patient sends access request to a doctor
 * POST /api/patient-access/request
 */
export async function requestDoctorAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { doctorWalletAddress, reason, purpose } = req.body;

    // Validation
    if (!doctorWalletAddress) {
      res.status(400).json({ error: 'Doctor wallet address is required' });
      return;
    }

    if (!reason || !purpose) {
      res.status(400).json({ error: 'Reason and purpose are required' });
      return;
    }

    // Only patients can send requests
    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can send access requests to doctors' });
      return;
    }

    // Get patient from database
    const patient = await queryOne(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [req.user!.userId, 'PATIENT']
    );
    if (!patient || patient.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Patient account is not active' });
      return;
    }

    // Get doctor from database
    const doctor = await queryOne(
      'SELECT * FROM users WHERE wallet_address = $1 AND role = $2',
      [doctorWalletAddress.toLowerCase(), 'DOCTOR']
    );
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    if (doctor.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Doctor account is not active' });
      return;
    }

    // Check for existing pending request
    const existingRequest = await queryOne(
      `SELECT id FROM patient_access_requests 
       WHERE patient_id = $1 AND doctor_id = $2 AND status = 'PENDING'`,
      [patient.id, doctor.id]
    );
    if (existingRequest) {
      res.status(409).json({ error: 'A request to this doctor is already pending' });
      return;
    }

    // Check if already accepted
    const existingAccepted = await queryOne(
      `SELECT id FROM patient_access_requests 
       WHERE patient_id = $1 AND doctor_id = $2 AND status = 'ACCEPTED'`,
      [patient.id, doctor.id]
    );
    if (existingAccepted) {
      res.status(409).json({ error: 'You are already connected with this doctor' });
      return;
    }

    // Create the request
    const accessRequest = await queryOne(
      `INSERT INTO patient_access_requests (patient_id, doctor_id, reason, purpose, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [patient.id, doctor.id, reason, purpose]
    );

    // Create notification for doctor
    await query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doctor.id,
        'PATIENT_ACCESS_REQUEST',
        'New Patient Access Request',
        `Patient ${patient.name} is requesting access to your services`,
        'PATIENT_ACCESS_REQUEST',
        accessRequest.id
      ]
    );

    logger.info('Patient access request created', {
      patientId: patient.id,
      doctorId: doctor.id,
      requestId: accessRequest.id
    });

    res.status(201).json({
      message: 'Access request sent successfully',
      request: accessRequest
    });
  } catch (error: any) {
    const detail = error?.message || error?.detail || error?.code || 'unknown';
    logger.error('Error requesting doctor access', { error: detail, stack: error?.stack });
    res.status(500).json({ error: `Failed to send access request: ${detail}` });
  }
}

/**
 * Get patient's own requests
 * GET /api/patient-access/my-requests
 */
export async function getMyPatientRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can view their requests' });
      return;
    }

    const requests = await query(
      `SELECT par.*, u.name as doctor_name, u.wallet_address as doctor_wallet,
              u.email as doctor_email, u.identifier as doctor_license
       FROM patient_access_requests par
       JOIN users u ON par.doctor_id = u.id
       WHERE par.patient_id = $1
       ORDER BY par.requested_at DESC`,
      [req.user!.userId]
    );

    res.json({ requests });
  } catch (error) {
    logger.error('Error getting patient requests', { error });
    res.status(500).json({ error: 'Failed to get requests' });
  }
}

/**
 * Get requests sent to a doctor
 * GET /api/patient-access/doctor-requests
 */
export async function getDoctorPatientRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can view incoming requests' });
      return;
    }

    const requests = await query(
      `SELECT par.*, u.name as patient_name, u.wallet_address as patient_wallet,
              u.email as patient_email, u.identifier as patient_id
       FROM patient_access_requests par
       JOIN users u ON par.patient_id = u.id
       WHERE par.doctor_id = $1
       ORDER BY par.requested_at DESC`,
      [req.user!.userId]
    );

    res.json({ requests });
  } catch (error) {
    logger.error('Error getting doctor patient requests', { error });
    res.status(500).json({ error: 'Failed to get requests' });
  }
}

/**
 * Doctor accepts a patient request
 * POST /api/patient-access/:requestId/accept
 */
export async function acceptPatientRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;

    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can accept requests' });
      return;
    }

    // Get the request
    const accessRequest = await queryOne(
      `SELECT par.*, p.wallet_address as patient_wallet, p.name as patient_name
       FROM patient_access_requests par
       JOIN users u ON par.doctor_id = u.id
       JOIN users p ON par.patient_id = p.id
       WHERE par.id = $1 AND par.doctor_id = $2`,
      [requestId, req.user!.userId]
    );

    if (!accessRequest) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (accessRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    // Update request status
    await query(
      `UPDATE patient_access_requests 
       SET status = 'ACCEPTED', decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Create notification for patient
    await query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        accessRequest.patient_id,
        'PATIENT_ACCESS_ACCEPTED',
        'Access Request Accepted',
        `Dr. ${req.user!.walletAddress.slice(0, 10)}... has accepted your access request`,
        'PATIENT_ACCESS_REQUEST',
        requestId
      ]
    );

    logger.info('Patient access request accepted', {
      requestId,
      doctorId: req.user!.userId,
      patientId: accessRequest.patient_id
    });

    res.json({ message: 'Request accepted successfully' });
  } catch (error) {
    logger.error('Error accepting patient request', { error });
    res.status(500).json({ error: 'Failed to accept request' });
  }
}

/**
 * Doctor rejects a patient request
 * POST /api/patient-access/:requestId/reject
 */
export async function rejectPatientRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;

    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can reject requests' });
      return;
    }

    // Get the request
    const accessRequest = await queryOne(
      `SELECT par.*
       FROM patient_access_requests par
       JOIN users u ON par.doctor_id = u.id
       WHERE par.id = $1 AND par.doctor_id = $2`,
      [requestId, req.user!.userId]
    );

    if (!accessRequest) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (accessRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    // Update request status
    await query(
      `UPDATE patient_access_requests 
       SET status = 'REJECTED', decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Create notification for patient
    await query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        accessRequest.patient_id,
        'PATIENT_ACCESS_REJECTED',
        'Access Request Rejected',
        `Your access request has been rejected`,
        'PATIENT_ACCESS_REQUEST',
        requestId
      ]
    );

    logger.info('Patient access request rejected', {
      requestId,
      doctorId: req.user!.userId,
      patientId: accessRequest.patient_id
    });

    res.json({ message: 'Request rejected' });
  } catch (error) {
    logger.error('Error rejecting patient request', { error });
    res.status(500).json({ error: 'Failed to reject request' });
  }
}

/**
 * Get authorized patients for a doctor (patients who have accepted requests)
 * GET /api/patient-access/authorized-patients
 */
export async function getAuthorizedPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can view authorized patients' });
      return;
    }

    const patients = await query(
      `SELECT DISTINCT u.id, u.name, u.wallet_address, u.email, u.identifier, u.status
       FROM patient_access_requests par
       JOIN users u ON par.patient_id = u.id
       WHERE par.doctor_id = $1 AND par.status = 'ACCEPTED'
       ORDER BY u.name`,
      [req.user!.userId]
    );

    res.json({ patients });
  } catch (error) {
    logger.error('Error getting authorized patients', { error });
    res.status(500).json({ error: 'Failed to get authorized patients' });
  }
}

/**
 * Get connected patients with their record-access status
 * GET /api/patient-access/connected-patients
 * Returns patients with ACCEPTED connection + their record-access request status
 */
export async function getConnectedPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'DOCTOR') {
      res.status(403).json({ error: 'Only doctors can view connected patients' });
      return;
    }

    // Get patients with accepted connection + latest record-access request status
    const patients = await query(
      `SELECT DISTINCT u.id, u.name, u.wallet_address, u.email, u.identifier, u.status,
              ar.id as record_access_request_id,
              ar.status as record_access_status,
              ar.record_id as record_access_record_id,
              ar.access_level as record_access_level,
              ar.requested_at as record_access_requested_at,
              ar.decided_at as record_access_decided_at,
              ar.expires_at as record_access_expires_at
       FROM patient_access_requests par
       JOIN users u ON par.patient_id = u.id
       LEFT JOIN access_requests ar
         ON ar.doctor_id = par.doctor_id
         AND ar.patient_id = par.patient_id
         AND ar.id = (
           SELECT id FROM access_requests
           WHERE doctor_id = par.doctor_id AND patient_id = par.patient_id
           ORDER BY requested_at DESC LIMIT 1
         )
       WHERE par.doctor_id = $1 AND par.status = 'ACCEPTED'
       ORDER BY u.name`,
      [req.user!.userId]
    );

    res.json({ patients });
  } catch (error) {
    logger.error('Error getting connected patients', { error });
    res.status(500).json({ error: 'Failed to get connected patients' });
  }
}

/**
 * Check if patient is authorized for a doctor
 * GET /api/patient-access/check/:doctorWallet
 */
export async function checkPatientAuthorization(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { doctorWallet } = req.params;

    if (req.user!.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can check authorization' });
      return;
    }

    const doctor = await queryOne(
      'SELECT id FROM users WHERE wallet_address = $1 AND role = $2',
      [doctorWallet.toLowerCase(), 'DOCTOR']
    );

    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    const authorization = await queryOne(
      `SELECT status FROM patient_access_requests 
       WHERE patient_id = $1 AND doctor_id = $2`,
      [req.user!.userId, doctor.id]
    );

    res.json({
      isAuthorized: authorization?.status === 'ACCEPTED',
      status: authorization?.status || 'NONE'
    });
  } catch (error) {
    logger.error('Error checking patient authorization', { error });
    res.status(500).json({ error: 'Failed to check authorization' });
  }
}
