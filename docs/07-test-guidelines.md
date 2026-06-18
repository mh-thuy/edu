# Test Guidelines - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Quy định cách kiểm tra sau mỗi lần chỉnh sửa code.

---

# 1. Nguyên tắc chung

Sau mỗi chỉnh sửa, không được báo “đã xong” nếu chưa kiểm tra tối thiểu.

Mỗi thay đổi phải trả lời được:

```text
Đã sửa gì?
Đã ảnh hưởng module nào?
Đã test bằng cách nào?
Có lỗi còn lại không?
```

Không được chỉ nói:

```text
Done
Fixed
OK
```

---

# 2. Test level bắt buộc

Tùy loại chỉnh sửa, phải chạy các mức test tương ứng.

## 2.1 Sửa UI nhỏ

Ví dụ:

```text
Canh giữa text
Đổi label
Đổi màu Chip
Sửa layout button
```

Phải chạy:

```bash
npm run typecheck
npm run lint
```

Nếu có thể:

```bash
npm run build
```

Manual test:

```text
Mở màn hình liên quan
Kiểm tra layout không vỡ
Kiểm tra responsive cơ bản
```

---

## 2.2 Sửa form

Ví dụ:

```text
StudentForm
TeacherForm
PaymentForm
ClassForm
```

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Manual test:

```text
Create success
Edit success
Validation required
Validation format
Submit loading
Submit error
Reset/cancel
```

---

## 2.3 Sửa API

Ví dụ:

```text
/api/students
/api/payments
/api/student-fees
```

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

API test:

```text
Success case
Validation error
Not found
Duplicate data
Permission fail nếu có
Business rule fail
```

---

## 2.4 Sửa database / Prisma

Ví dụ:

```text
schema.prisma
migration
seed
relationship
enum
```

Phải chạy:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run build
```

Nếu có DB local:

```bash
npx prisma migrate reset
npm run seed
```

Kiểm tra:

```text
Prisma Studio mở được
Seed data tạo đúng
Relation load được
```

---

## 2.5 Sửa nghiệp vụ tài chính

Ví dụ:

```text
student_fees
payment
receipt
QR
bill tạm
payroll
```

Bắt buộc test kỹ hơn.

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Business test:

```text
Không tạo học phí trùng tháng
Tạo học phí sinh QR
Tạo học phí sinh bill tạm
Không thanh toán vượt số tiền còn nợ
Thanh toán một phần -> PARTIAL
Thanh toán đủ -> PAID
Payment tạo receipt
Receipt không tạo nếu chưa có payment
```

---

# 3. Static checks

Luôn ưu tiên chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Ý nghĩa:

```text
typecheck -> lỗi TypeScript

lint -> lỗi coding style

build -> lỗi runtime/build Next.js
```

Không được bỏ qua build nếu sửa:

```text
route
page
layout
schema
Prisma
API
```

---

# 4. Unit test

Nếu project có unit test:

```bash
npm run test
```

Nên test các hàm:

```text
formatCurrency
formatDate
calculateOutstandingAmount
calculateStudentFeeStatus
checkScheduleConflict
calculateTeacherPayroll
```

---

# 5. API test checklist

Mỗi API CRUD nên test:

```text
GET list
GET detail
POST create
PATCH update
DELETE delete
Search
Pagination
Validation error
Duplicate error
Not found
Business rule error
```

Response phải đúng:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi phải đúng:

```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_ERROR",
    "message": "..."
  }
}
```

---

# 6. UI manual test checklist

Mỗi màn hình CRUD phải test:

```text
Mở màn hình
Danh sách load được
Search hoạt động
Pagination hoạt động
Create thành công
Edit thành công
Delete có confirm
Validation hiển thị đúng
Snackbar thành công/lỗi
Loading state
Empty state
```

---

# 7. Form test checklist

Mỗi form phải test:

```text
Field bắt buộc
Email format
Number min/max
Money không âm
Date hợp lệ
Start date <= end date
Submit thành công
Submit lỗi backend
Cancel
Reset
```

---

# 8. Payment flow test

Khi sửa payment/học phí, bắt buộc test flow:

```text
1. Tạo học phí tháng
2. Sinh QR
3. Sinh bill tạm
4. Ghi nhận thanh toán một phần
5. Kiểm tra trạng thái PARTIAL
6. Ghi nhận thanh toán phần còn lại
7. Kiểm tra trạng thái PAID
8. Kiểm tra receipt được tạo
9. Không cho thanh toán thêm
```

---

# 9. Schedule conflict test

Khi sửa lịch học, bắt buộc test:

```text
Tạo lịch hợp lệ

Tạo lịch trùng phòng

Tạo lịch trùng giáo viên

Tạo lịch start_time >= end_time

Đổi phòng

Đổi giáo viên

Đổi giờ
```

---

# 10. Payroll test

Khi sửa payroll, bắt buộc test:

```text
Tính doanh thu theo lớp

Tính center_fee

Tính salary_amount

Không tạo trùng payroll teacher + month

DRAFT -> APPROVED

APPROVED -> PAID

Không sửa payroll PAID
```

---

# 11. Regression checklist

Sau khi sửa module A, kiểm tra module liên quan.

Ví dụ:

## Sửa Student

Kiểm tra thêm:

```text
Enrollment
Student Fees
Payment
```

## Sửa Class

Kiểm tra thêm:

```text
Schedule
Enrollment
Student Fees
Salary Rule
Payroll
```

## Sửa Payment

Kiểm tra thêm:

```text
Student Fee status
Receipt
Dashboard revenue
Debt report
```

---

# 12. Báo cáo kết quả test

Sau khi hoàn thành, AI/dev phải báo theo format:

```text
Đã sửa:
- ...

Đã test:
- npm run typecheck: pass
- npm run lint: pass
- npm run build: pass
- Manual test: create/edit/delete student pass

Chưa test được:
- ...
Lý do:
- ...
```

Không được ghi chung chung:

```text
Đã test xong
```

---

# 13. Rules for AI Coding Agent

AI bắt buộc:

```text
Sau mỗi chỉnh sửa phải chạy hoặc đề xuất test tương ứng

Không được báo hoàn thành nếu chưa nêu test đã chạy

Nếu không chạy được test phải nói rõ lý do

Nếu sửa nghiệp vụ tài chính phải test business flow

Nếu sửa DB phải chạy prisma validate/generate
```

AI không được:

```text
Bỏ qua test vì sửa nhỏ

Chỉ kiểm tra bằng mắt nếu có thay đổi API/DB

Nói pass khi chưa chạy
```
