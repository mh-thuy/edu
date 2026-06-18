# API Contract - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Quy định chuẩn request/response cho toàn bộ API.

Nếu coding-rules.md và file này mâu thuẫn, ưu tiên file này cho API layer.

---

# 1. Nguyên tắc chung

Mọi API phải tuân thủ:

```text
Response format thống nhất

Không trả dữ liệu raw từ database

Không expose internal error

HTTP status code đúng chuẩn

Pagination thống nhất toàn hệ thống

Validation ở backend là bắt buộc
```

Không được:

```text
Mỗi API trả một kiểu response khác nhau

Frontend phải tự đoán API shape
```

---

# 2. Response chuẩn

Mọi API thành công:

```json
{
  "success": true,
  "data": {}
}
```

Ví dụ:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Nguyễn Văn A"
  }
}
```

---

# 3. Error Response chuẩn

Format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông báo lỗi"
  }
}
```

Ví dụ:

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

# 4. HTTP Status Code

## Thành công

```text
200 OK → Query thành công
201 Created → Tạo mới
204 No Content → Delete thành công không trả body
```

## Lỗi

```text
400 Bad Request → Sai input

401 Unauthorized → Chưa login

403 Forbidden → Không đủ quyền

404 Not Found → Không tồn tại dữ liệu

409 Conflict → Vi phạm unique/business rule

422 Unprocessable Entity → Validation fail

500 Internal Server Error → Lỗi server
```

Ví dụ:

```text
Student code duplicated → 409

Email invalid → 422

Payment > outstanding amount → 409
```

---

# 5. Pagination chuẩn

Toàn hệ thống dùng:

```text
page
pageSize
```

Không dùng:

```text
offset
limit
startRow
endRow
cursor
```

Request:

```http
GET /api/students?page=1&pageSize=20
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 120,
      "totalPages": 6
    }
  }
}
```

---

# 6. Search Query chuẩn

Danh sách dùng query param.

Ví dụ:

```http
GET /api/students?search=nguyen&status=ACTIVE&page=1&pageSize=20
```

Rule:

```text
search = full text search đơn giản

status = filter exact match

page mặc định = 1

pageSize mặc định = 20

pageSize max = 100
```

---

# 7. CRUD Pattern chuẩn

Pattern:

```text
GET /api/resource

GET /api/resource/:id

POST /api/resource

PATCH /api/resource/:id

DELETE /api/resource/:id
```

Không dùng:

```text
POST /createStudent

POST /updateStudent
```

---

# 8. Create API Rules

Ví dụ:

```http
POST /api/students
```

Body:

```json
{
  "code": "ST001",
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid"
  }
}
```

Validation:

```text
Zod schema bắt buộc
```

---

# 9. Update API Rules

Ví dụ:

```http
PATCH /api/students/uuid
```

Không dùng PUT.

Rule:

```text
Chỉ update field thay đổi

Phải check record tồn tại
```

Response:

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

# 10. Delete API Rules

Ví dụ:

```http
DELETE /api/students/uuid
```

Response:

```http
204 No Content
```

Rule:

```text
Không hard delete dữ liệu tài chính
```

Nếu business không cho xóa:

```json
{
  "success": false,
  "error": {
    "code": "DELETE_NOT_ALLOWED",
    "message": "Không thể xóa vì đã phát sinh giao dịch"
  }
}
```

---

# 11. Validation Rules

Validation dùng:

```text
Zod
```

Không validate thủ công kiểu:

```ts
if (!email) {
  ...
}
```

Ví dụ:

```ts
const studentSchema = z.object({
  code: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
});
```

---

# 12. API Structure

Cấu trúc:

```text
src/app/api/students/route.ts

src/modules/student/
  services/
  schemas/
  types/
```

Không viết toàn bộ logic trong route.

Route chỉ làm:

```text
read request

validate

call service

return response
```

---

# 13. Service Layer Rules

Service chịu trách nhiệm:

```text
Business validation

Prisma query

Transaction

Mapping response
```

Ví dụ:

```ts
export async function createStudent(data: StudentCreateInput) {}
```

Không query Prisma trong route.

Sai:

```ts
export async function POST() {
  await prisma.student.create(...)
}
```

---

# 14. Auth Rules

API private phải check auth.

Rule:

```text
Không API nội bộ nào được public nếu không có lý do rõ ràng
```

Middleware check:

```text
JWT

Session

Token
```

---

# 15. Permission Rules

Role:

```text
ADMIN
STAFF
TEACHER
```

Ví dụ:

```text
TEACHER không được create payment

TEACHER không được delete student

STAFF không được approve payroll
```

Backend bắt buộc check.

Không chỉ check frontend.

---

# 16. Date Format Rules

Frontend gửi:

```json
{
  "birthday": "2026-06-18"
}
```

Không gửi:

```json
{
  "birthday": "18/06/2026"
}
```

Backend convert.

Datetime:

```text
ISO format
```

Ví dụ:

```text
2026-06-18T10:30:00Z
```

---

# 17. Money Rules

Không dùng float JS để tính tiền.

Dùng:

```text
Decimal trong database

number chỉ để hiển thị
```

Backend tự tính:

```text
actual_amount

outstanding_amount

payment_status
```

Không tin giá trị frontend gửi lên.

---

# 18. Bulk API Rules

Ví dụ:

```http
POST /api/student-fees/bulk-create
```

Body:

```json
{
  "classId": "uuid",
  "month": "2026-06"
}
```

Flow:

```text
Create student_fee

Generate QR

Generate bill

Commit transaction
```

Response:

```json
{
  "success": true,
  "data": {
    "createdCount": 20
  }
}
```

Nếu fail 1 record:

```text
Rollback toàn bộ
```

---

# 19. Transaction API Rules

Các API bắt buộc transaction:

```text
Create student fee + QR + bill

Create payment + update fee status + receipt

Approve payroll + payroll items
```

Không commit từng bước riêng.

Ví dụ Prisma:

```ts
await prisma.$transaction(async (tx) => {})
```

---

# 20. API Naming Rules

Database:

```text
snake_case
```

TypeScript:

```text
camelCase
```

JSON response:

```text
camelCase
```

Ví dụ:

```json
{
  "fullName": "Nguyễn Văn A",
  "createdAt": "..."
}
```

Không trả:

```json
{
  "full_name": "...",
  "created_at": "..."
}
```

---

# 21. Error Code chuẩn

Danh sách:

```text
VALIDATION_ERROR

UNAUTHORIZED

FORBIDDEN

NOT_FOUND

DUPLICATE_DATA

BUSINESS_RULE_ERROR

DELETE_NOT_ALLOWED

PAYMENT_EXCEEDED

SCHEDULE_CONFLICT

ROOM_CONFLICT

TEACHER_CONFLICT

INTERNAL_ERROR
```

Không tự tạo error code lung tung.

---

# 22. API Performance Rules

Không query N+1.

Sai:

```text
Load classes

For each class

Query teacher
```

Đúng:

```ts
include: {
  teacher: true
}
```

Pagination bắt buộc cho list API.

Không trả:

```text
10000 records
```

---

# 23. Logging Rules

Log:

```text
request id

user id

action

execution time
```

Không log:

```text
password

token

bank account full number
```

---

# 24. API Test Rules

Test cases tối thiểu:

```text
Create success

Create duplicate

Update success

Delete success

Delete fail

Validation fail

Permission fail

Business rule fail
```

---

# 25. Rules for AI Coding Agent

AI không được:

```text
Đổi API response structure

Trả raw prisma error

Bypass validation

Không dùng pagination

Hard-code response shape khác chuẩn
```

AI bắt buộc:

```text
Đọc api-contract.md trước khi code

Giữ nguyên response format

Giữ nguyên error format

Nếu API mới phải theo cùng contract
```
