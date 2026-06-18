# Tài liệu nghiệp vụ hệ thống quản lý trung tâm đào tạo

Version: 2.0
Status: Draft
Updated: 2026-06-18

---

# 1. Tổng quan hệ thống

Hệ thống dùng để quản lý vận hành trung tâm đào tạo.

Các chức năng chính:

* Quản lý tài khoản người dùng
* Quản lý giáo viên
* Quản lý học viên
* Quản lý phòng học
* Quản lý lớp học
* Đăng ký học viên vào lớp
* Quản lý lịch học
* Quản lý học phí
* Sinh QR Code thanh toán
* In bill tạm thông báo học phí
* Quản lý thanh toán
* Quản lý biên lai
* Quản lý chia lương giáo viên
* Quản lý bảng lương giáo viên

Luồng tổng quát:

```text
Student
    ↓
Enroll Class
    ↓
Generate Tuition Fee
    ↓
Generate Payment QR
    ↓
Generate Temporary Invoice
    ↓
Send Payment Notice
    ↓
Payment
    ↓
Receipt
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
Teacher có thể có hoặc không có tài khoản login
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
```

Rule:

```text
1 student chỉ đăng ký 1 lần trong cùng lớp
Kiểm tra số lượng tối đa
```

---

# 8. Quản lý lịch học

Bảng:

```text
class_schedules
```

Field:

```text
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

Không được trùng phòng

Không được trùng giáo viên
```

---

# 9. Quản lý học phí

Mục đích:

Quản lý khoản tiền học viên phải đóng.

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
due_date
status
note
```

Status:

```text
UNPAID
PARTIAL
PAID
```

Rule:

```text
(student_id,class_id,month) unique

actual_amount = amount - discount
```

---

# 10. Sinh QR Code thanh toán

Mục đích:

Sinh QR code chuyển khoản khi tạo học phí.

Bảng:

```text
payment_qr_codes
```

Field:

```text
id
student_fee_id
payment_code
qr_payload
qr_image_url
expired_at
status
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
payment_code unique

Mỗi student_fee có QR riêng

Nếu amount thay đổi phải tạo QR mới
```

---

# 11. Bill tạm / Phiếu báo học phí

Mục đích:

Thông báo cho phụ huynh trước khi thanh toán.

Không phải biên lai.

Bảng:

```text
payment_notices
```

Field:

```text
id
student_fee_id
notice_number
pdf_url
sent_at
printed_at
status
created_at
```

Bill hiển thị:

```text
Tên học viên

Tên lớp

Tháng học phí

Số tiền cần đóng

Ngày hết hạn

QR Code thanh toán

Thông tin chuyển khoản
```

Rule:

```text
Có thể in nhiều lần

Có thể gửi email hoặc zalo

Không phải biên lai chính thức
```

---

# 12. Thanh toán

Mục đích:

Ghi nhận việc trung tâm đã nhận tiền.

Bảng:

```text
payments
```

Field:

```text
id
student_fee_id
amount
method
payment_date
notes
```

Method:

```text
cash
transfer
wallet
```

Rule:

```text
1 student_fee có thể thanh toán nhiều lần

Không cho overpayment

Sau payment phải update status học phí
```

---

# 13. Biên lai chính thức

Mục đích:

Xác nhận đã nhận tiền.

Chỉ sinh sau payment.

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
```

Rule:

```text
1 payment = 1 receipt

receipt_number unique
```

Phân biệt:

```text
Bill tạm → thông báo thanh toán

Receipt → xác nhận đã thu tiền
```

---

# 14. Quy tắc chia lương giáo viên

Bảng:

```text
class_salary_rules
```

Field:

```text
id
class_id
commission_percentage
```

Ví dụ:

```text
commission = 15%
revenue = 10000000

center_fee = 1500000

salary = 8500000
```

Rule:

```text
1 class chỉ có 1 salary rule
```

---

# 15. Bảng lương giáo viên

Bảng:

```text
teacher_payrolls
teacher_payroll_items
```

Field:

```text
teacher_id
month
total_revenue
center_fee
salary_amount
status
approved_at
paid_at
```

Status:

```text
DRAFT
APPROVED
PAID
```

Rule:

```text
1 teacher + 1 month unique
```

---

# 16. Luồng tạo học phí

```text
1. Chọn tháng

2. Lấy học viên đang học

3. Sinh student_fee

4. Sinh payment_code

5. Sinh QR Code

6. Sinh bill tạm

7. Xuất PDF bill

8. Gửi phụ huynh
```

---

# 17. Luồng thanh toán

```text
Phụ huynh chuyển khoản qua QR

hoặc

Thanh toán tiền mặt
```

---

# 18. Luồng xác nhận thanh toán

```text
1. Staff kiểm tra giao dịch

2. Tạo payment

3. Update trạng thái student_fee

4. Sinh receipt

5. In biên lai chính thức
```