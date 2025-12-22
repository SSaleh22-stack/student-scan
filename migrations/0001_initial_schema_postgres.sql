-- PostgreSQL schema for Student Scanner
-- Converted from SQLite to PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN', 'SCANNER')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_open BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Session assignments table
CREATE TABLE IF NOT EXISTS session_assignments (
  session_id UUID NOT NULL,
  scanner_user_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, scanner_user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (scanner_user_id) REFERENCES users(id)
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  scanned_student_number VARCHAR(255) NOT NULL,
  scanned_by_user_id UUID NOT NULL,
  scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, scanned_student_number),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (scanned_by_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_session ON scans(session_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_by ON scans(scanned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_scanner ON session_assignments(scanner_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);

-- Create admin user (password: admin123)
-- Password hash: d67161498d0f584f06ed550c1dab1573:238070fc380913b6113923c54dc56767a6b1ce2654f135353be5ca35d5355841
INSERT INTO users (id, username, password_hash, role, is_active) 
VALUES (
  '4ce45c31-c207-4a4a-a315-b9fff0d407e0'::uuid,
  'admin',
  'd67161498d0f584f06ed550c1dab1573:238070fc380913b6113923c54dc56767a6b1ce2654f135353be5ca35d5355841',
  'ADMIN',
  true
) ON CONFLICT (id) DO UPDATE SET is_active = true;

