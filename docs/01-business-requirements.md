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

Field:

```text
id
email
password_hash
full_name
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
billing_year
billing_month
enrollment_id
amount
discount
final_amount
due_date
status
note
created_at
updated_at
```

Status:

```text
UNPAID
PAID
OVERDUE
EXEMPTED
CANCELLED
```

Rule:

```text
(student_id,class_id,billing_year,billing_month) unique cho học phí MONTHLY

final_amount = amount - discount

Mỗi học phí chỉ được thanh toán một lần.

Payment SUCCESS phải có số tiền đúng bằng final_amount.

Không cho thanh toán thiếu, thừa hoặc tạo payment SUCCESS thứ hai.
```

Học phí theo tháng được tính trọn tháng theo từng môn:

```text
phí môn = phí tháng chuẩn
```

Enrollment có khoảng tạm nghỉ bao phủ tháng không phát sinh học phí; enrollment còn `ACTIVE` phát sinh đủ phí tháng dù học viên vắng, đăng ký giữa tháng hoặc không có điểm danh.

---

# 11. Payment batch

Thanh toán bắt đầu từ một hoặc nhiều khoản học phí của cùng một học viên.
Các khoản được gom vào một `payment_batch`; mỗi allocation phải bằng toàn bộ
`final_amount` của khoản học phí tương ứng.

Các bảng hiện hành:

```text
payment_batches
payment_allocations
tuition_payments
tuition_receipts
payment_batch_receipts
```

Phương thức duy nhất:

```text
CASH
BANK_TRANSFER
```

Rule:

```text
Không hỗ trợ thanh toán từng phần.
Một tuition fee chỉ có tối đa một payment SUCCESS.
Payment SUCCESS phải có amount đúng bằng final_amount.
CASH hoàn tất ngay trong transaction.
BANK_TRANSFER tạo batch PENDING và chỉ hoàn tất sau đối soát.
```

---

# 12. QR thanh toán động

QR được sinh động từ payment batch và tài khoản ngân hàng đang hoạt động:

```text
AMOUNT = payment_batch.total_amount
CONTENT = payment_batch.batch_no
```

Không tạo bảng hoặc lưu lịch sử QR. QR chỉ có hiệu lực khi batch còn `PENDING`,
phương thức là `BANK_TRANSFER` và batch đã gắn tài khoản nhận tiền.

---

# 13. Thông báo và biên lai

PDF thông báo học phí và biên lai được sinh động từ dữ liệu hiện tại/snapshot
của payment batch. Không có luồng gửi email/SMS tự động trong phiên bản này.

Rule:

```text
Batch SUCCESS sinh payment, receipt theo từng tuition fee và receipt tổng hợp.
Receipt đã phát hành không bị xóa; nếu hủy phải có lý do và audit log.
Receipt CANCELLED không được xuất lại PDF. Nếu receipt thuộc payment batch đã
thành công, thao tác hủy sẽ hoàn tác toàn bộ batch atomically: hủy các payment
và receipt liên quan, mở lại học phí về `UNPAID`/`OVERDUE`, chuyển batch sang
`CANCELLED` và ghi audit log.
```

---

# 14. Import và đối soát sao kê ngân hàng

Sao kê chỉ được phân tích tạm trong response/token của phiên làm việc; không
lưu lịch sử dòng sao kê. Chỉ giao dịch ghi có mới được đối soát.

Luồng:

```text
Import sao kê
      ↓
Tìm batch PENDING cùng tài khoản ngân hàng và đúng số tiền
      ↓
Ưu tiên batch_no trong nội dung giao dịch
      ↓
Nếu không có batch_no: người dùng chọn một candidate cùng số tiền
      ↓
Backend xác thực token, tài khoản, phương thức, trạng thái và số tiền
      ↓
Hoàn tất payment batch atomically
```

Không đối soát được batch `CASH`, batch khác tài khoản, batch không `PENDING`
hoặc giao dịch có số tiền không khớp tuyệt đối.

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

# 21. Luồng phát sinh học phí hiện hành

```text
1. Nhân viên chọn học viên và các môn muốn đăng ký trong lớp.
2. Backend kiểm tra học viên chưa đăng ký các môn đó.
3. Tạo enrollment subject cho từng môn hợp lệ.
4. Hoàn tất đăng ký; chưa tạo học phí ở bước này.
5. Nhân viên chọn `Tạo thanh toán và xuất thông báo` cho lớp.
6. Backend tạo tuition fee và các tuition fee item cho những môn chưa được lập phí, sau đó tạo payment batch.
7. Người dùng mở chi tiết học phí hoặc thông báo để thanh toán/in chứng từ.

Không tạo học phí độc lập ngoài enrollment; mọi khoản học phí phải truy được về lớp, học viên và môn học. Đăng ký và tạo học phí là hai thao tác độc lập.
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
2. Tìm payment batch BANK_TRANSFER đang PENDING, cùng tài khoản và đúng số tiền
3. Ưu tiên match batch_no trong nội dung giao dịch
4. Nếu không có batch_no, nhân viên chọn batch hợp lệ cùng số tiền
5. Backend xác thực token và hoàn tất batch trong một transaction
6. Tạo tuition payment SUCCESS, cập nhật tuition fee PAID
7. Sinh receipt theo khoản và receipt tổng hợp
8. In hoặc xuất chứng từ
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
