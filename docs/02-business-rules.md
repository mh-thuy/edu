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

## 2.3 Access

Mọi user đã đăng nhập dùng chung một quyền truy cập. Hệ thống không tạo,
gán hoặc kiểm tra role.

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

## 3.2 Teacher Profile

Teacher là hồ sơ nghiệp vụ độc lập:

```text
Không liên kết user
Không sử dụng email
```

Thông tin sử dụng:

```text
full_name
phone
bank_account
specialty
commission_percent
```

---

## 3.3 Teacher Commission

Rule:

```text
0 <= commission_percent <= 100
```

Tỷ lệ này chỉ dùng trong báo cáo thu học phí theo lớp và môn học để tính phần
doanh thu còn lại sau tỷ lệ trích. Hệ thống không tạo kỳ lương, phiếu lương hoặc
bảng lương giáo viên.

---

## 3.4 Teacher Delete

Không hard delete teacher. Thao tác xóa trên UI chỉ chuyển teacher sang
`INACTIVE` và lưu `deleted_at` để bảo toàn lịch sử. Teacher đang được gán cho
lớp không bị xóa khỏi dữ liệu; không được dùng teacher `INACTIVE` cho lịch hoặc
phân công mới.

---

# 4. Student Rules

## 4.1 Student Code

Rule:

```text
student.code UNIQUE
```

---

## 4.2 Student Contact

Rule:

```text
Học viên không sử dụng email
Thông tin liên hệ gồm số điện thoại và thông tin phụ huynh
```

---

## 4.3 Student Delete

Không hard delete student. Thao tác xóa trên UI chỉ chuyển student sang
`INACTIVE` và lưu `deleted_at` để bảo toàn enrollment, học phí, payment và
receipt. Student `INACTIVE` không được đăng ký mới vào lớp.

---

# 5. Class Rules

## 5.1 Class Code

Rule:

```text
class.code UNIQUE
```

---

## 5.2 Subject Capacity

Rule:

```text
active_enrollment_subject_count <= class_subject.max_students
```

Giới hạn được áp dụng riêng cho từng môn trong lớp. `max_students = null` nghĩa
là môn không giới hạn sĩ số. Không cho đăng ký môn nếu môn đó đã đủ giới hạn.

Ví dụ:

```text
class_subject.max_students = 20

đã có 20

=> không cho thêm học viên thứ 21
```

---

## 5.3 Class Delete

Không cho xóa nếu đã phát sinh:

```text
student fee
payment
receipt
```

Với lớp chưa có dữ liệu liên quan, thao tác xóa chỉ chuyển lớp sang `CANCELLED`
và lưu `deleted_at`; không hard delete bản ghi lớp.

---

## 5.4 Class Status

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

# 6. Enrollment Rules

## 6.1 Duplicate Enrollment

Không cho:

```text
1 student đăng ký 2 lần cùng 1 lớp
```

Unique:

```text
(student_id,class_id)
```

---

## 6.2 Enrollment Capacity

Trước khi đăng ký từng môn phải check:

```text
active_enrollment_subject_count < class_subject.max_students
```

---

## 6.3 Enrollment Remove

Không cho remove học viên nếu:

```text
Đã phát sinh student_fee
```

Trừ khi người dùng đã đăng nhập gửi `force = true` và nhập lý do.

Với bỏ một môn:

```text
Nếu môn đã có học phí:
    chỉ cho force cancel có lý do
    khoản học phí đã phát sinh vẫn được giữ nguyên
    các kỳ sau không tạo thêm phí cho môn đó
```

Remove enrollment không hard-delete bản ghi. Hệ thống đánh dấu enrollment `LEFT` và các môn `DROPPED`; chỉ enrollment `LEFT` mới có thể được kích hoạt lại khi đăng ký lại môn phù hợp. Enrollment `COMPLETED` hoặc `SUSPENDED` không được tự động mở lại.

## 6.4 Enrollment và Student Fee độc lập

Đăng ký học viên vào lớp hoặc môn học không tự động tạo `student_fee`.

Học phí chỉ được tạo bởi thao tác riêng sau khi enrollment đã tồn tại. Một thao tác tạo học phí phải:

```text
Chỉ lấy các môn đang ACTIVE của enrollment
Không tạo trùng tuition_fee_item cho cùng môn
Ghi audit log
Thực hiện trong transaction
```

Nếu học viên đăng ký thêm môn sau khi đã tạo học phí, thao tác tạo học phí lần tiếp theo chỉ tạo phí cho các môn mới chưa được lập phí.

---

# 7. Schedule Rules

`day_of_week` dùng miền `0..6`, trong đó `0` là Chủ nhật và `6` là Thứ bảy.

## 7.1 Time Validation

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

## 7.2 Teacher Conflict

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

# 8. Student Fee Rules

## 8.1 Duplicate Monthly Fee

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

## 8.2 Amount Validation

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

## 8.3 Discount Validation

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

## 8.4 Actual Amount

Công thức:

```text
actual_amount = amount - discount
```

Không cho lưu:

```text
actual_amount < 0
```

## 8.5 Student Fee Generation

Không tự động tạo học phí khi enrollment được tạo hoặc đăng ký thêm môn.

Học phí được tạo qua thao tác riêng và phải tham chiếu đến enrollment hiện có. Enrollment không có học phí vẫn là enrollment hợp lệ.

## 8.6 Monthly Full-Month Tuition

Mức `ClassSubject.tuitionFee` là học phí chuẩn của một tháng. Khi tạo phí tháng, backend tính trọn mức phí cho từng môn đang đăng ký; không chia theo số buổi, số ngày hoặc ngày đăng ký.

```text
phí môn = phí tháng chuẩn
```

Quy tắc nghỉ:

```text
Enrollment ACTIVE nhưng không đi học -> vẫn tính đủ tháng
Enrollment có khoảng tạm nghỉ bao phủ tháng -> không tạo phí
Đăng ký giữa tháng -> vẫn tính đủ tháng
```

---

# 9. QR Payment Rules

## 9.1 QR Generation

QR được tạo động theo `payment_batch` đang `PENDING`, sử dụng tài khoản ngân hàng
đã gắn với batch, tổng `final_amount` và `batchNo` làm nội dung chuyển khoản.

```text
1 payment_batch = 1 QR động tại thời điểm xem/in
```

Không lưu ảnh QR hoặc bản ghi QR riêng trong database.

## 9.2 QR Validity

QR chỉ được tạo khi batch còn `PENDING` và tài khoản nhận tiền còn hoạt động.
Batch `SUCCESS` hoặc `CANCELLED` không được tạo QR mới.

---

# 10. Payment Notice Rules (Bill tạm)

## 10.1 Payment Notice Meaning

Bill tạm:

```text
Không phải biên lai
```

Bill tạm chỉ dùng:

```text
Thông báo khoản cần thanh toán
```

---

## 10.2 Payment Notice Regeneration

Nếu thay đổi:

```text
amount
discount
due_date
```

Thì batch đang chờ phải được hủy hoặc thay thế trước khi tạo batch mới. PDF notice
được tạo lại theo batch hiện hành và không lưu lịch sử bản PDF trong database.

---

## 10.3 Bill History

Cho phép xuất/in lại nhiều lần khi batch còn `PENDING`; hệ thống hiện chưa gửi
email/SMS và chưa lưu lịch sử số lần xuất/in.

---

# 11. Payment Rules

## 11.1 Payment Amount

Hệ thống chỉ hỗ trợ thanh toán đủ một lần cho từng học phí.

```text
payment.amount = tuition_fee.final_amount
```

Không cho thanh toán thiếu, thừa hoặc nhập số tiền tùy ý từ frontend.

Nếu số tiền không khớp `final_amount`, trả lỗi `PAYMENT_AMOUNT_MISMATCH`.

---

## 11.2 Payment Methods

Cho phép:

```text
cash
transfer
```

Không cho method khác.

---

## 11.3 Payment Uniqueness

```text
1 student_fee chỉ có tối đa một payment SUCCESS
```

Payment `FAILED` hoặc `CANCELLED` vẫn được lưu để tra cứu lịch sử, nhưng không
được tính là đã thanh toán và không được tạo receipt.

---

## 11.4 Payment Status Update

Trạng thái học phí chỉ có hai trạng thái thanh toán chính:

```text
Chưa có payment SUCCESS -> UNPAID hoặc OVERDUE
Có payment SUCCESS đúng final_amount -> PAID
```

Sau khi đã `PAID`, không cho tạo thêm payment SUCCESS.

---

# 12. Receipt Rules

## 12.1 Receipt Creation

Receipt chỉ tạo khi:

```text
payment đã tồn tại
```

Không cho tạo trực tiếp.

---

## 12.2 Receipt Number

Rule:

```text
receipt_number UNIQUE
```

Ví dụ:

```text
RC2026060001
```

---

## 12.3 Receipt Edit

Không cho sửa:

```text
amount
payment_id
```

Sau khi receipt đã phát hành.

---

## 12.4 Receipt Delete

Không cho xóa receipt.

Cho phép:

```text
cancel receipt
```

Khi hủy một receipt thuộc payment batch đã thành công, hệ thống hoàn tác toàn bộ
batch trong một transaction: các payment chuyển `CANCELLED`, các receipt liên
quan bị hủy, học phí được mở lại thành `UNPAID` hoặc `OVERDUE`, batch chuyển
`CANCELLED` và ghi audit log. Không cho xuất lại receipt tổng đã hoàn tác.

---

# 13. Delete Policy

Nguyên tắc:

```text
Không hard delete dữ liệu tài chính
```

Không xóa:

```text
student_fee
payment
receipt
```

Chỉ:

```text
soft delete
inactive
cancel
```

---

# 14. Audit Log Rules

Bắt buộc lưu audit log cho:

```text
Payment created
Payment updated
Receipt created
Student fee generated
QR generated dynamically
Bill generated dynamically
```

Đăng ký học viên và tạo học phí là hai audit event riêng biệt.

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

# 15. API Rules

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

# 16. Transaction Rules

Các thao tác sau phải dùng database transaction.

```text
Create student fee + QR + bill

Create payment + update fee status + create receipt

```

Không được commit từng bước riêng lẻ.

---

# 17. Security Rules

Không cho:

```text
Frontend quyết định permission

Client gửi amount đã tính sẵn rồi backend tin tưởng
```

Backend phải tự tính lại:

```text
actual_amount
payment_status
```

Payment SUCCESS luôn có số tiền bằng `actual_amount`; không phát sinh
`outstanding_amount` do hệ thống không hỗ trợ thanh toán từng phần.

---

# 18. Rules for AI Coding Agent

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
