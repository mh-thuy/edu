-- ============================================================
-- Education Center Management System
-- Optimized database schema - create from scratch
-- Target DB: PostgreSQL
-- Version: 3.0
-- Generated: 2026-06-18
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'TEACHER');
CREATE TYPE teacher_status AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');
CREATE TYPE student_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE room_status AS ENUM ('AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE');
CREATE TYPE class_status AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE fee_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE payment_method AS ENUM ('CASH', 'TRANSFER', 'WALLET');
CREATE TYPE qr_code_status AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE notice_status AS ENUM ('DRAFT', 'GENERATED', 'PRINTED', 'SENT', 'CANCELLED');
CREATE TYPE receipt_status AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE payroll_status AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- ============================================================
-- users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE TRIGGER trg_users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- teachers
-- ============================================================
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  user_id UUID NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  bank_account VARCHAR(100) NULL,
  specialty VARCHAR(255) NULL,
  status teacher_status NOT NULL DEFAULT 'ACTIVE',
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_teachers_code UNIQUE (code),
  CONSTRAINT uq_teachers_user_id UNIQUE (user_id),
  CONSTRAINT uq_teachers_email UNIQUE (email),
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE TRIGGER trg_teachers_set_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- students
-- ============================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  birthday DATE NULL,
  parent_name VARCHAR(255) NULL,
  address TEXT NULL,
  status student_status NOT NULL DEFAULT 'ACTIVE',
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_students_code UNIQUE (code),
  CONSTRAINT uq_students_email UNIQUE (email)
);
CREATE TRIGGER trg_students_set_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- rooms
-- ============================================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  floor VARCHAR(50) NULL,
  location VARCHAR(255) NULL,
  status room_status NOT NULL DEFAULT 'AVAILABLE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_rooms_code UNIQUE (code),
  CONSTRAINT ck_rooms_capacity_non_negative CHECK (capacity >= 0)
);
CREATE TRIGGER trg_rooms_set_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- classes
-- ============================================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  teacher_id UUID NULL,
  room_id UUID NULL,
  tuition_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  max_students INTEGER NOT NULL DEFAULT 0,
  start_date DATE NULL,
  end_date DATE NULL,
  status class_status NOT NULL DEFAULT 'DRAFT',
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_classes_code UNIQUE (code),
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_classes_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT ck_classes_tuition_fee_non_negative CHECK (tuition_fee >= 0),
  CONSTRAINT ck_classes_total_sessions_non_negative CHECK (total_sessions >= 0),
  CONSTRAINT ck_classes_max_students_non_negative CHECK (max_students >= 0),
  CONSTRAINT ck_classes_date_range CHECK (end_date IS NULL OR start_date IS NULL OR start_date <= end_date)
);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_room_id ON classes(room_id);
CREATE INDEX idx_classes_status ON classes(status);
CREATE TRIGGER trg_classes_set_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- class_students
-- ============================================================
CREATE TABLE class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_class_students_class_student UNIQUE (class_id, student_id),
  CONSTRAINT fk_class_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_class_students_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_class_students_date_range CHECK (left_at IS NULL OR enrolled_at <= left_at)
);
CREATE INDEX idx_class_students_class_id ON class_students(class_id);
CREATE INDEX idx_class_students_student_id ON class_students(student_id);
CREATE TRIGGER trg_class_students_set_updated_at BEFORE UPDATE ON class_students FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- class_schedules
-- ============================================================
CREATE TABLE class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  room_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_class_schedules_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_class_schedules_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_class_schedules_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_class_schedules_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT ck_class_schedules_time_range CHECK (start_time < end_time)
);
CREATE INDEX idx_class_schedules_class_id ON class_schedules(class_id);
CREATE INDEX idx_class_schedules_room_day ON class_schedules(room_id, day_of_week);
CREATE INDEX idx_class_schedules_teacher_day ON class_schedules(teacher_id, day_of_week);
CREATE TRIGGER trg_class_schedules_set_updated_at BEFORE UPDATE ON class_schedules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- student_fees
-- ============================================================
CREATE TABLE student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  class_id UUID NOT NULL,
  month CHAR(7) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  status fee_status NOT NULL DEFAULT 'UNPAID',
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_student_fees_student_class_month UNIQUE (student_id, class_id, month),
  CONSTRAINT fk_student_fees_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_student_fees_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_student_fees_month_format CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT ck_student_fees_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT ck_student_fees_discount_non_negative CHECK (discount >= 0),
  CONSTRAINT ck_student_fees_discount_not_greater_amount CHECK (discount <= amount),
  CONSTRAINT ck_student_fees_final_amount CHECK (final_amount = amount - discount)
);
CREATE INDEX idx_student_fees_student_id ON student_fees(student_id);
CREATE INDEX idx_student_fees_class_id ON student_fees(class_id);
CREATE INDEX idx_student_fees_month ON student_fees(month);
CREATE INDEX idx_student_fees_status ON student_fees(status);
CREATE INDEX idx_student_fees_student_month ON student_fees(student_id, month);
CREATE TRIGGER trg_student_fees_set_updated_at BEFORE UPDATE ON student_fees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- payment_accounts
-- ============================================================
CREATE TABLE payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  bank_code VARCHAR(50) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_payment_accounts_code UNIQUE (code),
  CONSTRAINT uq_payment_accounts_bank_account UNIQUE (bank_code, account_number)
);
CREATE UNIQUE INDEX uq_payment_accounts_one_default ON payment_accounts(is_default) WHERE is_default = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_payment_accounts_active ON payment_accounts(is_active);
CREATE TRIGGER trg_payment_accounts_set_updated_at BEFORE UPDATE ON payment_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- payment_qr_codes
-- ============================================================
CREATE TABLE payment_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL,
  payment_account_id UUID NOT NULL,
  payment_code VARCHAR(100) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  transfer_content VARCHAR(255) NOT NULL,
  qr_payload TEXT NOT NULL,
  qr_image_url TEXT NULL,
  expired_at TIMESTAMPTZ NULL,
  status qr_code_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_payment_qr_codes_payment_code UNIQUE (payment_code),
  CONSTRAINT fk_payment_qr_codes_student_fee FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_qr_codes_payment_account FOREIGN KEY (payment_account_id) REFERENCES payment_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_payment_qr_codes_amount_positive CHECK (amount > 0)
);
CREATE INDEX idx_payment_qr_codes_student_fee_id ON payment_qr_codes(student_fee_id);
CREATE INDEX idx_payment_qr_codes_payment_account_id ON payment_qr_codes(payment_account_id);
CREATE INDEX idx_payment_qr_codes_status ON payment_qr_codes(status);
CREATE UNIQUE INDEX uq_payment_qr_codes_active_per_fee ON payment_qr_codes(student_fee_id) WHERE status = 'ACTIVE';
CREATE TRIGGER trg_payment_qr_codes_set_updated_at BEFORE UPDATE ON payment_qr_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- payment_notices
-- ============================================================
CREATE TABLE payment_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL,
  notice_number VARCHAR(100) NOT NULL,
  qr_code_id UUID NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NULL,
  pdf_url TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  printed_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  send_method VARCHAR(50) NULL,
  status notice_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_payment_notices_notice_number UNIQUE (notice_number),
  CONSTRAINT fk_payment_notices_student_fee FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_notices_qr_code FOREIGN KEY (qr_code_id) REFERENCES payment_qr_codes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT ck_payment_notices_amount_positive CHECK (amount > 0),
  CONSTRAINT ck_payment_notices_version_positive CHECK (version > 0)
);
CREATE INDEX idx_payment_notices_student_fee_id ON payment_notices(student_fee_id);
CREATE INDEX idx_payment_notices_qr_code_id ON payment_notices(qr_code_id);
CREATE INDEX idx_payment_notices_status ON payment_notices(status);
CREATE UNIQUE INDEX uq_payment_notices_latest_per_fee ON payment_notices(student_fee_id) WHERE is_latest = TRUE;
CREATE UNIQUE INDEX uq_payment_notices_fee_version ON payment_notices(student_fee_id, version);
CREATE TRIGGER trg_payment_notices_set_updated_at BEFORE UPDATE ON payment_notices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL,
  payment_qr_id UUID NULL,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  external_transaction_id VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  cancel_reason TEXT NULL,
  CONSTRAINT fk_payments_student_fee FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_payment_qr FOREIGN KEY (payment_qr_id) REFERENCES payment_qr_codes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT ck_payments_amount_positive CHECK (amount > 0)
);
CREATE INDEX idx_payments_student_fee_id ON payments(student_fee_id);
CREATE INDEX idx_payments_student_fee_date ON payments(student_fee_id, payment_date);
CREATE INDEX idx_payments_payment_qr_id ON payments(payment_qr_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_external_transaction_id ON payments(external_transaction_id);
CREATE TRIGGER trg_payments_set_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- receipts
-- ============================================================
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  receipt_number VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  printed_at TIMESTAMPTZ NULL,
  status receipt_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  cancel_reason TEXT NULL,
  CONSTRAINT uq_receipts_payment_id UNIQUE (payment_id),
  CONSTRAINT uq_receipts_receipt_number UNIQUE (receipt_number),
  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_receipts_issue_date ON receipts(issue_date);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE TRIGGER trg_receipts_set_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- class_salary_rules
-- ============================================================
CREATE TABLE class_salary_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_class_salary_rules_class_id UNIQUE (class_id),
  CONSTRAINT fk_class_salary_rules_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_class_salary_rules_commission_range CHECK (commission_percentage >= 0 AND commission_percentage <= 100)
);
CREATE TRIGGER trg_class_salary_rules_set_updated_at BEFORE UPDATE ON class_salary_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- teacher_payrolls
-- ============================================================
CREATE TABLE teacher_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  month CHAR(7) NOT NULL,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  center_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status payroll_status NOT NULL DEFAULT 'DRAFT',
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL,
  paid_at TIMESTAMPTZ NULL,
  paid_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_teacher_payrolls_teacher_month UNIQUE (teacher_id, month),
  CONSTRAINT fk_teacher_payrolls_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_payrolls_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_teacher_payrolls_paid_by FOREIGN KEY (paid_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT ck_teacher_payrolls_month_format CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT ck_teacher_payrolls_amounts_non_negative CHECK (total_revenue >= 0 AND center_fee >= 0 AND salary_amount >= 0)
);
CREATE INDEX idx_teacher_payrolls_teacher_id ON teacher_payrolls(teacher_id);
CREATE INDEX idx_teacher_payrolls_month ON teacher_payrolls(month);
CREATE INDEX idx_teacher_payrolls_status ON teacher_payrolls(status);
CREATE TRIGGER trg_teacher_payrolls_set_updated_at BEFORE UPDATE ON teacher_payrolls FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- teacher_payroll_items
-- ============================================================
CREATE TABLE teacher_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL,
  class_id UUID NOT NULL,
  class_code VARCHAR(50) NOT NULL,
  student_count INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_payroll_items_payroll_class UNIQUE (payroll_id, class_id),
  CONSTRAINT fk_teacher_payroll_items_payroll FOREIGN KEY (payroll_id) REFERENCES teacher_payrolls(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_payroll_items_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_teacher_payroll_items_student_count_non_negative CHECK (student_count >= 0),
  CONSTRAINT ck_teacher_payroll_items_amounts_non_negative CHECK (revenue >= 0 AND fee >= 0 AND salary >= 0)
);
CREATE INDEX idx_teacher_payroll_items_payroll_id ON teacher_payroll_items(payroll_id);
CREATE INDEX idx_teacher_payroll_items_class_id ON teacher_payroll_items(class_id);
CREATE TRIGGER trg_teacher_payroll_items_set_updated_at BEFORE UPDATE ON teacher_payroll_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NULL,
  old_data JSONB NULL,
  new_data JSONB NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- Helper view
-- ============================================================
CREATE VIEW v_student_fee_payment_summary AS
SELECT
  sf.id AS student_fee_id,
  sf.student_id,
  sf.class_id,
  sf.month,
  sf.amount,
  sf.discount,
  sf.final_amount,
  COALESCE(SUM(CASE WHEN p.cancelled_at IS NULL THEN p.amount ELSE 0 END), 0) AS paid_amount,
  (sf.final_amount - COALESCE(SUM(CASE WHEN p.cancelled_at IS NULL THEN p.amount ELSE 0 END), 0)) AS outstanding_amount,
  sf.status
FROM student_fees sf
LEFT JOIN payments p ON p.student_fee_id = sf.id
GROUP BY sf.id, sf.student_id, sf.class_id, sf.month, sf.amount, sf.discount, sf.final_amount, sf.status;

-- ============================================================
-- Payment status recalculation
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_student_fee_status(p_student_fee_id UUID)
RETURNS VOID AS $$
DECLARE
  v_final_amount NUMERIC(12,2);
  v_paid_amount NUMERIC(12,2);
BEGIN
  SELECT final_amount INTO v_final_amount FROM student_fees WHERE id = p_student_fee_id;

  IF v_final_amount IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid_amount
  FROM payments
  WHERE student_fee_id = p_student_fee_id
    AND cancelled_at IS NULL;

  UPDATE student_fees
  SET status =
    CASE
      WHEN v_paid_amount <= 0 THEN 'UNPAID'::fee_status
      WHEN v_paid_amount < v_final_amount THEN 'PARTIAL'::fee_status
      ELSE 'PAID'::fee_status
    END
  WHERE id = p_student_fee_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_recalculate_student_fee_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_student_fee_status(OLD.student_fee_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_student_fee_status(NEW.student_fee_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_after_insert_update_delete
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_student_fee_status();

-- ============================================================
-- Notes
-- ============================================================
-- 1. payment_notices is only for payment notification, not official receipt.
-- 2. receipts should be created only after an actual payment.
-- 3. Application layer must validate overpayment inside transaction.
-- 4. Application layer must validate schedule conflicts and max students.
-- 5. Application layer should write audit_logs for critical operations.
