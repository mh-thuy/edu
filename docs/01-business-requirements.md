# Tài liệu nghiệp vụ hệ thống quản lý trung tâm đào tạo

Version: 3.0
Status: Draft
Updated: 2026-06-19

---

# 1. Tổng quan hệ thống

Hệ thống phục vụ quản lý vận hành trung tâm đào tạo.

Các module chính:

- Quản lý người dùng
- Quản lý giáo viên
- Quản lý học viên
- Quản lý phòng học
- Quản lý lớp học
- Đăng ký học viên
- Quản lý lịch học
- Điểm danh học viên
- Quản lý học phí
- Tạo yêu cầu thanh toán
- Sinh VietQR thanh toán
- Sinh phiếu báo học phí
- Import sao kê ngân hàng
- Đối soát giao dịch
- Quản lý thanh toán
- Quản lý biên lai
- Quản lý chia lương giáo viên
- Quản lý bảng lương
- Audit log hệ thống

Luồng tổng quát:

```text
Student
    ↓
Enroll Class
    ↓
Generate Tuition Fee
    ↓
Create Payment Request
    ↓
Generate VietQR
    ↓
Generate Payment Notice
    ↓
Send Parent Notice
    ↓
Parent Payment
    ↓
Import Bank Statement
    ↓
Auto Reconciliation
    ↓
Create Payment
    ↓
Generate Receipt
    ↓
Teacher Payroll
```

---

# 2. Quản lý tài khoản người dùng

Mục đích:

Quản lý tài khoản đăng nhập hệ thống.

Bảng:

```text
users
```

Role:

```text
ADMIN
STAFF
TEACHER
```

Field:

```text
id
email
password_hash
full_name
role
is_active
created_at
updated_at
```

Rule:

```text
email unique
1 email = 1 account
inactive account cannot login
```

---

# 3. Quản lý giáo viên

Mục đích:

Quản lý hồ sơ giáo viên.

Bảng:

```text
teachers
users
```

Thiết kế:

```text
Teacher có thể có hoặc không có account login

teachers.user_id nullable
```

Field:

```text
id
code
user_id nullable
email nullable
phone
bank_account
specialty
status
```

Status:

```text
ACTIVE
INACTIVE
ON_LEAVE
```

Rule:

```text
teacher.code unique

Nếu user_id != null:
    email lấy từ users
    teacher không sửa email riêng

Nếu user_id == null:
    teacher.email hoạt động độc lập
```

---

# 4. Quản lý học viên

Bảng:

```text
students
```

Field:

```text
id
code
full_name
email
phone
birthday
parent_name
address
status
```

Status:

```text
ACTIVE
INACTIVE
```

Rule:

```text
student.code unique
email optional unique
```

---

# 5. Quản lý phòng học

Bảng:

```text
rooms
```

Field:

```text
id
code
name
capacity
floor
location
status
```

Status:

```text
AVAILABLE
MAINTENANCE
UNAVAILABLE
```

Rule:

```text
room.code unique
Không được chọn phòng inactive
```

---

# 6. Quản lý lớp học

Bảng:

```text
classes
```

Field:

```text
id
code
name
teacher_id
room_id
tuition_fee
total_sessions
max_students
start_date
end_date
status
```

Status:

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

Rule:

```text
class.code unique
student_count <= max_students
Không cho xóa nếu đã phát sinh học phí
```

---

# 7. Đăng ký học viên vào lớp

Bảng:

```text
class_students
```

Field:

```text
class_id
student_id
enrolled_at
status
```

Status:

```text
ACTIVE
DROPPED
COMPLETED
```

Rule:

```text
(class_id,student_id) unique

Không vượt max_students
```

---

# 8. Quản lý lịch học

Bảng:

```text
class_schedules
```

Field:

```text
id
class_id
teacher_id
room_id
day_of_week
start_time
end_time
```

Rule:

```text
day_of_week = 1..7

start_time < end_time

Không trùng phòng

Không trùng giáo viên
```

---

# 9. Điểm danh học viên

Bảng:

```text
attendances
```

Field:

```text
id
class_id
student_id
schedule_id
attendance_date
status
note
```

Status:

```text
PRESENT
ABSENT
MAKEUP
```

Rule:

```text
1 student chỉ có 1 attendance cho mỗi buổi học
```

---

# 10. Quản lý học phí

Bảng:

```text
student_fees
```

Field:

```text
id
student_id
class_id
month
amount
discount
final_amount
paid_amount
remaining_amount
due_date
status
note
created_at
updated_at
```

Status:

```text
UNPAID
PARTIAL
PAID
CANCELLED
```

Rule:

```text
(student_id,class_id,month) unique

final_amount = amount - discount

remaining_amount = final_amount - paid_amount

Không cho overpayment
```

---

# 11. Tạo yêu cầu thanh toán

Mỗi lần gửi phụ huynh sẽ tạo payment request riêng.

Bảng:

```text
payment_requests
```

Field:

```text
id
student_fee_id
payment_code
requested_amount
expired_at
status
created_at
```

Status:

```text
ACTIVE
EXPIRED
PAID
CANCELLED
```

Rule:

```text
payment_code unique

1 student_fee có thể có nhiều payment request
```

---

# 12. Sinh VietQR thanh toán

Bảng:

```text
payment_qr_codes
```

Field:

```text
id
payment_request_id
qr_payload
created_at
```

Ví dụ payload:

```text
BANK:VCB
ACCOUNT:0123456789
AMOUNT:3000000
CONTENT:HP202606001
```

Rule:

```text
Không lưu qr image

Frontend hoặc backend generate QR từ payload
```

---

# 13. Phiếu báo học phí

Bảng:

```text
payment_notices
```

Field:

```text
id
payment_request_id
notice_number
version
pdf_url
sent_at
printed_at
status
created_at
```

Status:

```text
DRAFT
SENT
PRINTED
CANCELLED
```

Rule:

```text
Có thể generate nhiều version

Ví dụ:

HP001-v1

HP001-v2
```

---

# 14. Import sao kê ngân hàng

Bảng:

```text
bank_transactions
```

Field:

```text
id
bank_code
transaction_id
amount
transaction_date
description
reference_code
raw_data
matched
matched_at
created_at
```

Rule:

```text
transaction_id unique

Parse payment_code từ description
```

Ví dụ:

```text
Noi dung CK:

HP202606001
```

---

# 15. Đối soát giao dịch

Luồng:

```text
Import bank transaction
      ↓
Parse payment_code
      ↓
Find payment_request
      ↓
Auto match
      ↓
Create payment
```

Rule:

```text
Nếu match thành công:

matched=true
```

---

# 16. Thanh toán

Bảng:

```text
payments
```

Field:

```text
id
student_fee_id
bank_transaction_id nullable
amount
method
payment_date
status
notes
created_at
```

Method:

```text
cash
transfer
wallet
```

Status:

```text
PENDING
CONFIRMED
FAILED
CANCELLED
REFUNDED
```

Rule:

```text
1 student_fee có thể có nhiều payment

Không cho overpayment

Chỉ payment CONFIRMED mới cập nhật student_fee
```

---

# 17. Biên lai chính thức

Bảng:

```text
receipts
```

Field:

```text
id
payment_id
receipt_number
issue_date
printed_at
created_at
```

Rule:

```text
1 payment = 1 receipt

receipt_number unique

Chỉ sinh receipt khi payment = CONFIRMED
```

---

# 18. Quy tắc chia lương giáo viên

Bảng:

```text
class_salary_rules
```

Field:

```text
id
class_id
teacher_share_percentage
created_at
```

Ví dụ:

```text
Revenue = 10,000,000

teacher_share = 70%

Teacher salary = 7,000,000

Center revenue = 3,000,000
```

Rule:

```text
1 class có 1 salary rule
```

---

# 19. Bảng lương giáo viên

Bảng:

```text
teacher_payrolls

teacher_payroll_items
```

teacher_payrolls:

```text
id
teacher_id
month
total_revenue
center_fee
salary_amount
status
approved_at
paid_at
```

teacher_payroll_items:

```text
id
payroll_id
class_id
revenue
salary
```

Status:

```text
DRAFT
APPROVED
PAID
```

Rule:

```text
(teacher_id,month) unique

Revenue chỉ tính payment CONFIRMED
```

---

# 20. Audit log

Bảng:

```text
audit_logs
```

Field:

```text
id
entity_type
entity_id
action
old_data
new_data
created_by
created_at
```

Ví dụ:

```text
PAYMENT_CREATED

PAYMENT_CONFIRMED

RECEIPT_PRINTED

FEE_CANCELLED
```

---

# 21. Luồng tạo học phí

```text
1. Chọn tháng

2. Lấy học viên đang học

3. Generate student_fee

4. Create payment_request

5. Generate VietQR

6. Generate payment notice

7. Export PDF

8. Send parent
```

---

# 22. Luồng thanh toán

```text
Parent chuyển khoản QR

hoặc

Staff thu tiền mặt
```

---

# 23. Luồng xác nhận thanh toán

```text
1. Import bank statement

2. Parse payment_code

3. Match payment_request

4. Create payment (PENDING)

5. Staff confirm payment

6. Payment = CONFIRMED

7. Update student_fee

8. Generate receipt

9. Print receipt
```

---

# 24. Luồng tính lương giáo viên

```text
1. Tổng hợp payment CONFIRMED theo lớp

2. Group theo teacher

3. Áp dụng salary rule

4. Generate payroll

5. Approve payroll

6. Mark paid
```

---
