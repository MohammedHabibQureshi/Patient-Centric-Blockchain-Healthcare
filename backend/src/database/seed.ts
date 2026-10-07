import { pool } from './connection';
import { logger } from '../utils/logger';
import crypto from 'crypto';

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    logger.info('Seeding database with test data...');
    
    // Clear existing data (in correct order due to foreign keys)
    await client.query('TRUNCATE TABLE notifications, consents, access_requests, medical_records, audit_logs, users RESTART IDENTITY CASCADE');
    
    // Insert admin user (matches Ganache account 0)
    const adminResult = await client.query(
      `INSERT INTO users (name, wallet_address, role, email, identifier, status, blockchain_user_id, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      ['System Administrator', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'ADMIN', 'admin@healthcare.local', 'ADMIN-001', 'ACTIVE', 1, null]
    );
    const adminId = adminResult.rows[0].id;
    logger.info('Created admin user', { id: adminId });

    // NOTE: No patients or doctors are seeded. Ganache development accounts
    // (accounts 1-19) are NOT application users. Only users explicitly
    // registered by the Admin appear on the Patients/Doctors pages.
    
    // Insert system settings
    await client.query(
      `INSERT INTO system_settings (key, value, description, updated_by)
       VALUES 
         ('system_name', '"Patient Healthcare Blockchain"', 'System display name', $1),
         ('max_file_size_mb', '50', 'Maximum file upload size in MB', $1),
         ('allowed_file_types', '["application/pdf","image/jpeg","image/png","image/tiff","application/dicom","text/plain"]', 'Allowed MIME types', $1),
         ('default_access_expiry_hours', '24', 'Default access request expiry in hours', $1)
       ON CONFLICT (key) DO NOTHING`,
      [adminId]
    );
    
    logger.info('Database seeding completed successfully');
    
  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed failed', { error });
      process.exit(1);
    });
}

export { seedDatabase };