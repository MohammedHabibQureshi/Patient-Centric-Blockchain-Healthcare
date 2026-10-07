import { Request, Response } from 'express';
import multer from 'multer';
import { blockchainService, RecordType, AuditAction, AuditStatus } from '../blockchain/service';
import { storageService } from '../storage/service';
import { query, queryOne } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const RECORD_TYPE_MAP: Record<string, number> = {
  'GENERAL': RecordType.GENERAL,
  'LAB_RESULT': RecordType.LAB_RESULT,
  'IMAGING': RecordType.IMAGING,
  'PRESCRIPTION': RecordType.PRESCRIPTION,
  'DISCHARGE_SUMMARY': RecordType.DISCHARGE_SUMMARY,
  'CONSULTATION': RecordType.CONSULTATION,
  'VACCINATION': RecordType.VACCINATION,
  'OTHER': RecordType.OTHER,
};

const REVERSE_RECORD_TYPE_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(RECORD_TYPE_MAP).map(([k, v]) => [v, k])
);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/dicom',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, TIFF, DICOM, TXT'));
    }
  }
});

export const uploadMiddleware = upload.single('file');

export async function uploadRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    const { recordType, recordName } = req.body;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!recordName) {
      res.status(400).json({ error: 'Record name is required' });
      return;
    }

    // Validate record type
    const type = RECORD_TYPE_MAP[recordType] ?? RecordType.GENERAL;
    const typeString = REVERSE_RECORD_TYPE_MAP[type] || 'GENERAL';
    if (RECORD_TYPE_MAP[recordType] === undefined) {
      res.status(400).json({ error: 'Invalid record type' });
      return;
    }

    // Get patient info
    const patient = await queryOne('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    if (!patient || patient.role !== 'PATIENT') {
      res.status(403).json({ error: 'Only patients can upload records' });
      return;
    }

    // Generate hash (0x-prefixed for bytes32)
    const rawHash = storageService.generateFileHash(file.buffer);
    const fileHash = rawHash.startsWith('0x') ? rawHash : `0x${rawHash}`;

    // Store encrypted file
    const storedFile = await storageService.storeFile(file.buffer, file.originalname, file.mimetype);

    // Register on blockchain
    const blockchainRecordId = await blockchainService.registerRecord(
      patient.wallet_address,
      type,
      recordName,
      fileHash,
      storedFile.cid,
      file.size,
      file.mimetype
    );

    // Save to database (use string record_type for DB CHECK constraint).
    // The DB file_hash column is VARCHAR(64) and integrity checks compare against
    // the raw SHA-256 hex, so we store the 64-char value (no 0x prefix). The
    // 0x-prefixed form is used only for the on-chain bytes32 calls.
    const record = await queryOne(
      `INSERT INTO medical_records (patient_id, record_type, record_name, file_hash, storage_cid, file_size, mime_type, blockchain_record_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [patient.id, typeString, recordName, rawHash, storedFile.cid, file.size, file.mimetype, blockchainRecordId.toString()]
    );

    // Log audit
    await blockchainService.logAudit(
      req.user!.walletAddress,
      'PATIENT',
      AuditAction.RECORD_UPLOADED,
      'MEDICAL_RECORD',
      blockchainRecordId,
      recordName,
      AuditStatus.SUCCESS,
      '',
      { 
        fileName: file.originalname, 
        fileSize: file.size, 
        mimeType: file.mimetype,
        fileHash,
        storageCID: storedFile.cid
      }
    );

    logger.info('Medical record uploaded', { 
      patientId: patient.id, 
      recordName, 
      blockchainRecordId: blockchainRecordId.toString(),
      fileHash 
    });

    res.status(201).json({ 
      record,
      blockchainRecordId: blockchainRecordId.toString(),
      fileHash,
      storageCID: storedFile.cid
    });
  } catch (error) {
    logger.error('Error uploading record', { error });
    res.status(500).json({ error: 'Failed to upload record' });
  }
}

export async function getMyRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const records = await query(
      `SELECT mr.*, u.name as patient_name
       FROM medical_records mr
       JOIN users u ON mr.patient_id = u.id
       WHERE mr.patient_id = $1 AND mr.is_active = true
       ORDER BY mr.uploaded_at DESC`,
      [req.user!.userId]
    );

    // Get blockchain details for each record
    const recordsWithBlockchain = await Promise.all(
      records.map(async (record) => {
        try {
          const blockchainRecord = await blockchainService.getRecord(BigInt(record.blockchain_record_id));
          return { ...record, blockchainRecord };
        } catch (e) {
          return record;
        }
      })
    );

    res.json({ records: recordsWithBlockchain });
  } catch (error) {
    logger.error('Error getting my records', { error });
    res.status(500).json({ error: 'Failed to get records' });
  }
}

export async function getRecordById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { recordId } = req.params;

    const record = await queryOne(
      `SELECT mr.*, u.name as patient_name, u.wallet_address as patient_wallet
       FROM medical_records mr
       JOIN users u ON mr.patient_id = u.id
       WHERE mr.id = $1`,
      [recordId]
    );

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    let blockchainRecord = null;
    try {
      blockchainRecord = await blockchainService.getRecord(BigInt(record.blockchain_record_id));
    } catch (e) {
      // Blockchain query failed, return DB record only
    }

    res.json({ record, blockchainRecord });
  } catch (error) {
    logger.error('Error getting record by ID', { error });
    res.status(500).json({ error: 'Failed to get record' });
  }
}

export async function downloadRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { recordId } = req.params;

    const record = await queryOne(
      `SELECT mr.*, u.wallet_address as patient_wallet
       FROM medical_records mr
       JOIN users u ON mr.patient_id = u.id
       WHERE mr.id = $1 AND mr.is_active = true`,
      [recordId]
    );

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Verify access - patient can always access their own records
    const isOwner = record.patient_id === req.user!.userId;
    let hasAccess = isOwner;

    if (!isOwner) {
      // Doctor must have valid consent
      if (req.user!.role === 'DOCTOR') {
        const doctor = await queryOne('SELECT wallet_address FROM users WHERE id = $1', [req.user!.userId]);
        if (doctor) {
          try {
            const accessCheck = await blockchainService.checkAccess(
              doctor.wallet_address,
              record.patient_wallet,
              BigInt(record.blockchain_record_id)
            );
            hasAccess = accessCheck.hasAccess;
          } catch (e) {
            // Blockchain check failed, fall back to DB-only check
            const consent = await queryOne(
              `SELECT * FROM access_requests 
               WHERE doctor_id = $1 AND patient_id = $2 AND status = 'APPROVED'
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
              [req.user!.userId, record.patient_id]
            );
            hasAccess = !!consent;
          }
          
          if (!hasAccess) {
            res.status(403).json({ error: 'Access denied. No valid consent for this record.' });
            return;
          }
        }
      } else {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    // Retrieve and decrypt file
    const { data, metadata } = await storageService.retrieveFile(record.storage_cid);

    // Verify hash matches
    const computedHash = storageService.generateFileHash(data);
    if (computedHash !== record.file_hash) {
      logger.error('File integrity check failed on download', { recordId, expected: record.file_hash, computed: computedHash });
      res.status(500).json({ error: 'File integrity verification failed' });
      return;
    }

    // Log audit
    await blockchainService.logAudit(
      req.user!.walletAddress,
      req.user!.role,
      AuditAction.RECORD_ACCESSED,
      'MEDICAL_RECORD',
      BigInt(record.blockchain_record_id),
      record.record_name,
      AuditStatus.SUCCESS,
      '',
      { 
        recordId: record.id,
        patientId: record.patient_id,
        isOwner 
      }
    );

    // Set headers for file download
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
    res.setHeader('Content-Length', data.length);
    
    res.send(data);
  } catch (error) {
    logger.error('Error downloading record', { error });
    res.status(500).json({ error: 'Failed to download record' });
  }
}

export async function verifyRecordIntegrity(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { recordId } = req.params;

    const record = await queryOne(
      'SELECT * FROM medical_records WHERE id = $1',
      [recordId]
    );

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    let isValid = false;
    try {
      const providedHash = record.file_hash.startsWith('0x') ? record.file_hash : `0x${record.file_hash}`;
      isValid = await blockchainService.verifyFileIntegrity(
        BigInt(record.blockchain_record_id),
        providedHash
      );
    } catch (e) {
      // Blockchain verification failed
      isValid = false;
    }

    res.json({ 
      recordId,
      fileHash: record.file_hash,
      isValid,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error verifying record integrity', { error });
    res.status(500).json({ error: 'Failed to verify record' });
  }
}