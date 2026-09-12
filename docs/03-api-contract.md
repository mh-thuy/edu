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
    "code": "CONFLICT",
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
200 OK → Delete/soft delete thành công và trả response chuẩn
```

## Lỗi

```text
400 Bad Request → Sai input

401 Unauthorized → Chưa login

404 Not Found → Không tồn tại dữ liệu

409 Conflict → Vi phạm unique/business rule

422 Unprocessable Entity → Validation fail

500 Internal Server Error → Lỗi server
```

Ví dụ:

```text
Student code duplicated → 409

Email invalid → 422

Payment amount khác `finalAmount` → 409
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

Khi cần chỉ hiển thị học viên chưa đăng ký trong một lớp, truyền thêm
`excludeClassId={classId}`. Chỉ enrollment đang `ACTIVE` bị loại khỏi danh sách.

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

```json
{
  "success": true,
  "data": {}
}
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
    "code": "CONFLICT",
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

# 15. Authentication Rules

Mọi API nghiệp vụ yêu cầu user đã đăng nhập. Không có kiểm tra role ở frontend,
backend hoặc API middleware.

Các business rule độc lập với quyền đăng nhập vẫn phải được kiểm tra ở backend.

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
payment_status
```

Backend lấy `finalAmount` từ học phí và không nhận amount thanh toán tùy ý từ
frontend. Mỗi học phí chỉ có tối đa một payment SUCCESS; payment SUCCESS phải
đúng bằng toàn bộ `finalAmount`.

---

# 18. Bulk API Rules

Ví dụ:

```http
POST /api/classes/{classId}/tuition-fees?month=YYYY-MM
```

Request không cần body. `classId` nằm trên path và `month` nằm trên query.

Flow:

```text
Tìm enrollment ACTIVE và môn ACTIVE trong lớp

Tạo hoặc bổ sung tuition_fee và tuition_fee_items cho kỳ được chọn

Không tạo payment batch, QR hoặc PDF ở endpoint này

Commit transaction
```

Response:

```json
{
  "success": true,
  "data": {
    "created": 20,
    "skipped": 3
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
```

Không commit từng bước riêng.

Ví dụ Prisma:

```ts
await prisma.$transaction(async (tx) => {})
```

---

# 19.1 Enrollment và tạo học phí tách rời

## 19.1.1 Đăng ký học viên

```http
POST /api/classes/{classId}/students
```

Body:

```json
{
  "studentId": "uuid",
  "classSubjectIds": ["uuid"]
}
```

API này chỉ tạo hoặc bổ sung enrollment subject. API không tạo `tuition_fee`.

## 19.1.2 Tạo học phí từ enrollment

```http
POST /api/classes/{classId}/students/{studentId}/tuition-fee
```

API yêu cầu user đã đăng nhập, query bắt buộc `month=YYYY-MM`, không cần body. Backend sẽ:

```text
Tìm enrollment của học viên trong lớp
Lấy các môn ACTIVE chưa có tuition fee item
Tạo tuition_fee và tuition_fee_items trong một transaction
Ghi audit log
```

Nếu tất cả môn đã được lập phí, API trả `409 Conflict`. Enrollment không có học phí vẫn hợp lệ và có thể bị xóa theo Enrollment Remove Rules.

## 19.1.3 Quản lý môn và tạm nghỉ

```http
DELETE /api/classes/{classId}/students/{studentId}/subjects/{classSubjectId}
```

Bỏ một môn khỏi enrollment. Nếu kỳ hiện tại đã có học phí, khoản đã phát sinh được giữ nguyên; môn bị bỏ không được tính cho các kỳ sau.

```http
POST /api/classes/{classId}/students/{studentId}/pause
```

Body:

```json
{
  "startMonth": "2026-09",
  "endMonth": "2026-09",
  "reason": "Nghỉ phép"
}
```

Trong khoảng tạm nghỉ, học viên không phát sinh học phí tháng.

## 19.1.4 Tạo học phí tháng theo lớp

```http
POST /api/classes/{classId}/tuition-fees?month=YYYY-MM
```

API chỉ tạo học phí, chưa tạo payment batch và chưa xuất thông báo. Mỗi môn ACTIVE được tính trọn mức `ClassSubject.tuitionFee` của tháng; enrollment được tạm nghỉ trong kỳ sẽ được bỏ qua.

## 19.1.5 Tạo học phí khi tạo thông báo theo lớp

```http
POST /api/classes/{classId}/tuition-notice/pdf
```

Query bắt buộc:

```text
month=YYYY-MM
```

Trước khi tạo payment batch và PDF, backend phải tạo học phí cho toàn bộ enrollment `ACTIVE` trong lớp đối với kỳ đã chọn và các môn chưa có tuition fee item. Phí từng môn được tính trọn theo mức học phí tháng, không phụ thuộc số buổi. Nếu học phí đã tồn tại, chỉ bổ sung môn chưa có item và không tạo trùng item.

---

# 19.2 Refund APIs

Tạo yêu cầu hoàn tiền toàn bộ:

```http
POST /api/payment-refunds
```

```json
{
  "paymentId": "uuid",
  "refundMethod": "CASH",
  "reason": "Thu nhầm học phí"
}
```

Duyệt toàn bộ nhóm refund của payment batch:

```http
POST /api/payment-refunds/{refundId}/approve
```

Hoàn tất refund:

```http
POST /api/payment-refunds/{refundId}/complete
```

Body hoàn tiền mặt có thể rỗng. Hoàn chuyển khoản bắt buộc gửi mã giao dịch:

```json
{
  "refundDate": "2026-09-12T10:00:00.000Z",
  "bankTransactionNo": "RF-TXN-001"
}
```

Các endpoint refund yêu cầu đăng nhập, chỉ hoàn toàn bộ payment hoặc toàn bộ
batch, trả `409 CONFLICT` nếu sai trạng thái và thực hiện thay đổi tài chính
trong transaction.

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

Mã lỗi đang dùng:

```text
VALIDATION_ERROR

UNAUTHORIZED

NOT_FOUND

CONFLICT

INTERNAL_ERROR

BAD_REQUEST
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
