# Business Rules - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Đây là tập luật nghiệp vụ bắt buộc hệ thống phải tuân theo.

Nếu business-requirements.md và file này mâu thuẫn, ưu tiên file này.

---

# 1. Quy tắc chung

1. Không được xóa dữ liệu đã phát sinh giao dịch tài chính.
2. Không được hard delete, ưu tiên soft delete.
3. Không được bypass validation ở frontend hoặc backend.
4. Backend luôn là nơi xác thực nghiệp vụ cuối cùng.
5. UI chỉ hỗ trợ thao tác, không quyết định nghiệp vụ.
6. Mọi thao tác tài chính phải có audit log.

---

# 2. User Rules

## 2.1 Email

Rule:

```text
Mỗi email chỉ tồn tại một lần trong bảng users
```

Không cho phép:

```text
admin@test.com
admin@test.com
```

Constraint:

```text
users.email UNIQUE
```

---

## 2.2 Login

Rule:

```text
Nếu is_active = false thì không được đăng nhập
```

Backend bắt buộc check.

---

## 2.3 Role

Role hợp lệ:

```text
ADMIN
STAFF
TEACHER
```

Không cho tạo role khác.

---

# 3. Teacher Rules

## 3.1 Teacher Code

Rule:

```text
teacher.code phải unique
```

Ví dụ:

```text
GV001
GV002
```

Không cho phép:

```text
GV001
GV001
```

---

## 3.2 Teacher Account

Teacher có thể:

```text
Có account
Không có account
```

Cho phép:

```text
teacher.user_id = null
```

---

## 3.3 Teacher Email

Rule:

Nếu teacher liên kết với user:

```text
teacher.user_id != null
```

Thì:

```text
teacher.email không được sửa riêng
email lấy từ users.email
```

Nếu teacher không có user:

```text
teacher.email hoạt động độc lập
```

---

## 3.4 Teacher Delete

Không cho xóa teacher nếu teacher đang:

```text
Được gán cho lớp học
Hoặc có payroll
```

---

# 4. Student Rules

## 4.1 Student Code

Rule:

```text
student.code UNIQUE
```

---

## 4.2 Student Email

Rule:

```text
Email không bắt buộc
```

Nhưng nếu nhập:

```text
Email phải unique
Email đúng format
```

---

## 4.3 Student Delete

Không cho xóa học viên nếu đã có:

```text
class enrollment
student fee
payment
receipt
```

Chỉ cho:

```text
inactive
```

---

# 5. Room Rules

## 5.1 Room Code

Rule:

```text
room.code UNIQUE
```

---

## 5.2 Room Availability

Không cho chọn phòng nếu:

```text
status = MAINTENANCE
status = UNAVAILABLE
```

Khi tạo:

```text
class
schedule
```

---

## 5.3 Room Delete

Không cho xóa nếu phòng đã:

```text
Có class
Có schedule
```

---

# 6. Class Rules

## 6.1 Class Code

Rule:

```text
class.code UNIQUE
```

---

## 6.2 Max Students

Rule:

```text
student_count <= max_students
```

Không cho enroll nếu vượt quá giới hạn.

Ví dụ:

```text
max_students = 20

đã có 20

=> không cho thêm học viên thứ 21
```

---

## 6.3 Class Delete

Không cho xóa nếu đã phát sinh:

```text
student fee
payment
receipt
```

---

## 6.4 Class Status

Status hợp lệ:

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

Không cho:

```text
DRAFT -> COMPLETED trực tiếp nếu chưa ACTIVE
```

Flow hợp lệ:

```text
DRAFT
→ ACTIVE
→ COMPLETED
```

Hoặc:

```text
DRAFT
→ CANCELLED
```

---

# 7. Enrollment Rules

## 7.1 Duplicate Enrollment

Không cho:

```text
1 student đăng ký 2 lần cùng 1 lớp
```

Unique:

```text
(student_id,class_id)
```

---

## 7.2 Enrollment Capacity

Trước khi enroll phải check:

```text
student_count < max_students
```

---

## 7.3 Enrollment Remove

Không cho remove học viên nếu:

```text
Đã phát sinh student_fee
```

Trừ khi:

```text
ADMIN force cancel
```

---

# 8. Schedule Rules

## 8.1 Time Validation

Rule:

```text
start_time < end_time
```

Không cho:

```text
18:00 → 18:00
20:00 → 18:00
```

---

## 8.2 Room Conflict

Không cho trùng phòng.

Ví dụ:

```text
Room R001

Monday 18:00 - 20:00

ENG001 đang dùng
```

Không cho tạo:

```text
JP001

Monday 19:00 - 21:00
```

---

## 8.3 Teacher Conflict

Không cho giáo viên dạy trùng giờ.

Ví dụ:

```text
Teacher GV001

Monday 18:00 - 20:00
```

Không cho tạo:

```text
Monday 19:00 - 21:00
```

---

# 9. Student Fee Rules

## 9.1 Duplicate Monthly Fee

Không cho tạo trùng:

```text
(student_id,class_id,month)
```

Ví dụ:

```text
ST001

ENG001

2026-06
```

Chỉ được tồn tại một lần.

---

## 9.2 Amount Validation

Rule:

```text
amount > 0
```

Không cho:

```text
0
âm
```

---

## 9.3 Discount Validation

Rule:

```text
discount >= 0
discount <= amount
```

Không cho:

```text
amount = 1000000

discount = 1200000
```

---

## 9.4 Actual Amount

Công thức:

```text
actual_amount = amount - discount
```

Không cho lưu:

```text
actual_amount < 0
```

---

# 10. QR Payment Rules

## 10.1 QR Generation

Mỗi student fee có một QR riêng.

```text
1 student_fee = 1 active QR
```

---

## 10.2 QR Regeneration

Nếu thay đổi:

```text
amount
discount
actual_amount
```

Thì:

```text
QR cũ phải inactive
QR mới phải tạo lại
```

---

## 10.3 QR Expiration

Nếu QR có hạn:

```text
expired_at < now()
```

Thì:

```text
Không cho thanh toán bằng QR cũ
```

---

# 11. Payment Notice Rules (Bill tạm)

## 11.1 Payment Notice Meaning

Bill tạm:

```text
Không phải biên lai
```

Bill tạm chỉ dùng:

```text
Thông báo khoản cần thanh toán
```

---

## 11.2 Payment Notice Regeneration

Nếu thay đổi:

```text
amount
discount
due_date
```

Thì:

```text
Bill cũ invalid
Phải tạo bill mới
```

---

## 11.3 Bill History

Cho phép:

```text
In lại nhiều lần
Gửi lại nhiều lần
```

Phải lưu:

```text
printed_at
sent_at
```

---

# 12. Payment Rules

## 12.1 Payment Amount

Không cho:

```text
payment > outstanding amount
```

Ví dụ:

```text
Need pay = 3000000

Already paid = 2500000
```

Không cho:

```text
Payment = 600000
```

Chỉ tối đa:

```text
500000
```

---

## 12.2 Payment Methods

Cho phép:

```text
cash
transfer
wallet
```

Không cho method khác.

---

## 12.3 Multiple Payments

Cho phép:

```text
1 student_fee có nhiều payment
```

Ví dụ:

```text
1000000
1000000
1000000
```

---

## 12.4 Payment Status Update

Sau mỗi payment phải tính lại.

Nếu:

```text
total_paid = 0
```

Status:

```text
UNPAID
```

Nếu:

```text
0 < total_paid < actual_amount
```

Status:

```text
PARTIAL
```

Nếu:

```text
total_paid >= actual_amount
```

Status:

```text
PAID
```

---

# 13. Receipt Rules

## 13.1 Receipt Creation

Receipt chỉ tạo khi:

```text
payment đã tồn tại
```

Không cho tạo trực tiếp.

---

## 13.2 Receipt Number

Rule:

```text
receipt_number UNIQUE
```

Ví dụ:

```text
RC2026060001
```

---

## 13.3 Receipt Edit

Không cho sửa:

```text
amount
payment_id
```

Sau khi receipt đã phát hành.

---

## 13.4 Receipt Delete

Không cho xóa receipt.

Cho phép:

```text
cancel receipt
```

Nếu cần nghiệp vụ hủy.

---

# 14. Payroll Rules

## 14.1 Monthly Payroll

Rule:

```text
1 teacher + 1 month = 1 payroll
```

Unique:

```text
(teacher_id,month)
```

---

## 14.2 Salary Formula

Công thức:

```text
center_fee = revenue × commission / 100

salary = revenue - center_fee
```

---

## 14.3 Payroll Status

Status:

```text
DRAFT
APPROVED
PAID
```

Flow:

```text
DRAFT
→ APPROVED
→ PAID
```

Không cho:

```text
DRAFT → PAID trực tiếp
```

---

## 14.4 Payroll Edit Restriction

Không cho sửa nếu:

```text
status = PAID
```

---

# 15. Delete Policy

Nguyên tắc:

```text
Không hard delete dữ liệu tài chính
```

Không xóa:

```text
student_fee
payment
receipt
payroll
```

Chỉ:

```text
soft delete
inactive
cancel
```

---

# 16. Audit Log Rules

Bắt buộc lưu audit log cho:

```text
Payment created
Payment updated
Receipt created
Payroll approved
Payroll paid
Student fee generated
QR regenerated
Bill regenerated
```

Thông tin cần lưu:

```text
user_id
action
table_name
record_id
old_data
new_data
created_at
```

---

# 17. API Rules

Mọi API phải validate backend.

Không tin tưởng frontend.

Bắt buộc check:

```text
Permission

Business validation

Database constraints
```

Response chuẩn:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_ERROR",
    "message": "Không thể thanh toán vượt số tiền còn nợ"
  }
}
```

---

# 18. Transaction Rules

Các thao tác sau phải dùng database transaction.

```text
Create student fee + QR + bill

Create payment + update fee status + create receipt

Approve payroll + create payroll items
```

Không được commit từng bước riêng lẻ.

---

# 19. Security Rules

Không cho:

```text
Frontend quyết định permission

Client gửi amount đã tính sẵn rồi backend tin tưởng
```

Backend phải tự tính lại:

```text
actual_amount

outstanding_amount

payment_status
```

---

# 20. Rules for AI Coding Agent

AI không được:

```text
Tự thay đổi business logic

Bỏ validation để code nhanh hơn

Cho phép delete dữ liệu tài chính

Tạo receipt khi chưa có payment

Cho phép payment vượt số tiền còn nợ
```

AI bắt buộc:

```text
Đọc business-rules.md trước khi code

Ưu tiên business-rules hơn UI

Nếu chưa rõ nghiệp vụ phải thêm TODO
```
