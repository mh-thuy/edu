# Trạng thái hệ thống hiện hành

Tài liệu này là bản tóm tắt triển khai thực tế sau refactor theo mô hình lớp có nhiều môn học.

## Lớp học và môn học

- `Class` chỉ chứa thông tin chung của lớp: mã, tên, thời gian và trạng thái.
- `ClassSubject` là nơi lưu môn học thuộc lớp, giáo viên phụ trách, học phí, số buổi và giới hạn học viên.
- Một học viên có thể đăng ký một hoặc nhiều `ClassSubject` trong cùng lớp; không bắt buộc học toàn bộ môn.
- Lịch học phải gắn với môn học và lấy giáo viên theo môn đã phân công.
- Giáo viên xem lớp thông qua các môn được phân công, không qua giáo viên cấp lớp.

## Học phí

- Đăng ký môn là điểm phát sinh học phí duy nhất.
- Khi đăng ký bổ sung môn, hệ thống chỉ tạo item học phí cho môn chưa được lập phí.
- Không còn API, trang hoặc component tạo học phí thủ công.
- Thanh toán bắt đầu từ chi tiết học phí bằng nút `Thanh toán học phí`.
- Thông báo thanh toán, biên lai tổng hợp và phiếu thu đều hiển thị các môn đã đăng ký của học viên.

## Người dùng

- Admin quản lý người dùng tại `/admin/users`.
- CRUD gồm email, họ tên, mật khẩu, trạng thái và nhiều role.
- Xóa người dùng là khóa mềm tài khoản; không xóa vật lý.
- API `/api/users` chỉ cho role `ADMIN` và không bao giờ trả về `passwordHash`.

## Prisma và dữ liệu cũ

- Các bảng/enum đã không còn được sử dụng đã được loại khỏi schema và migration cleanup.
- Các thuộc tính cấp lớp cũ `teacherId`, `tuitionFee`, `totalSessions` đã bị loại bỏ; dữ liệu tương ứng nằm ở `ClassSubject`.
- Dữ liệu phát triển có thể reset và seed lại bằng quy trình Prisma của dự án.

## Kiểm tra bắt buộc

```bash
npm run typecheck
npm run lint
npm run build
```
