# Trạng thái hệ thống hiện hành

Tài liệu này là bản tóm tắt triển khai thực tế sau refactor theo mô hình lớp có nhiều môn học.

## Phạm vi sản phẩm

- Không quản lý phòng học và không kiểm tra trùng phòng.
- Không quản lý điểm danh.
- Không quản lý kỳ lương, phiếu lương hoặc bảng lương giáo viên.
- Báo cáo thu học phí theo lớp/môn vẫn tính phần doanh thu còn lại từ
  `Teacher.commissionPercent`; đây là chỉ tiêu báo cáo thu, không phải bảng lương.

## Lớp học và môn học

- `Class` chỉ chứa thông tin chung của lớp: mã, tên, thời gian và trạng thái.
- `ClassSubject` là nơi lưu môn học thuộc lớp, giáo viên phụ trách, học phí, số buổi và giới hạn học viên.
- Giới hạn học viên được kiểm tra riêng trên từng `ClassSubject`; lớp không có
  một giới hạn sĩ số dùng chung.
- Một học viên có thể đăng ký một hoặc nhiều `ClassSubject` trong cùng lớp; không bắt buộc học toàn bộ môn.
- Lịch học phải gắn với môn học và lấy giáo viên theo môn đã phân công.
- Thứ trong tuần của lịch học dùng `0..6` (`0` là Chủ nhật).
- Giáo viên xem lớp thông qua các môn được phân công, không qua giáo viên cấp lớp.

## Học phí

- Đăng ký môn và tạo học phí là hai thao tác độc lập.
- Khi đăng ký môn, hệ thống chỉ tạo enrollment subject; chưa tạo học phí.
- Chi tiết lớp chỉ hiển thị tổng quan; nghiệp vụ học viên nằm ở `/admin/classes/{classId}/students` và học phí nằm ở `/admin/classes/{classId}/tuition`.
- Trang học phí nhận một kỳ `YYYY-MM`; `Tạo học phí tháng` tạo phí riêng, còn `Tạo thanh toán & xuất thông báo` tạo payment batch và PDF.
- Không tạo học phí độc lập ngoài enrollment.
- Enrollment `ACTIVE` và môn `ACTIVE` vẫn tính đủ học phí tháng, không phụ thuộc mức độ tham gia thực tế; enrollment có khoảng tạm nghỉ trong kỳ không phát sinh phí.
- Không tạo học phí trước tháng đăng ký/tái đăng ký hoặc ngoài thời gian của lớp.
- Tái đăng ký giữ lịch sử enrollment cũ và dùng `currentPeriodStart` cho giai
  đoạn hiện tại; lớp đã kết thúc/hủy chỉ cho xem enrollment.
- Bỏ một môn chỉ ảnh hưởng các kỳ sau; khoản đã phát sinh không tự xóa.
- Không cho tạo học phí cho lớp `COMPLETED` hoặc `CANCELLED`; không cho tạm nghỉ trong khoảng đã phát sinh học phí.
- Xóa học viên/giáo viên/lớp/lịch chỉ là soft delete hoặc chuyển trạng thái; không hard delete bản ghi.
- Thanh toán bắt đầu từ chi tiết học phí bằng nút `Thanh toán học phí`.
- Thông báo thanh toán, biên lai tổng hợp và phiếu thu đều hiển thị các môn đã đăng ký của học viên.

## Thanh toán và đối soát

- Chỉ có hai phương thức: `CASH` và `BANK_TRANSFER`; không hỗ trợ thanh toán từng phần.
- Batch `BANK_TRANSFER` bắt buộc gắn đúng một tài khoản ngân hàng nhận tiền.
- Đối soát chỉ chọn batch `BANK_TRANSFER` đang `PENDING`, cùng tài khoản và đúng tổng tiền.
- QR được sinh động theo payment batch, không lưu lịch sử QR.
- Hủy receipt của payment batch thành công sẽ hoàn tác toàn bộ batch, mở lại các khoản học phí và ghi audit log.
- Hoàn tiền chỉ hỗ trợ toàn bộ payment hoặc toàn bộ batch, theo luồng
  `PENDING -> APPROVED -> COMPLETED`; khi hoàn tất, payment chuyển `REFUNDED`,
  receipt bị hủy, học phí được mở lại và batch chuyển `CANCELLED`.

## Người dùng

- Quản lý người dùng tại `/admin/users`.
- CRUD gồm email, họ tên, mật khẩu và trạng thái.
- Mọi người dùng đã đăng nhập dùng chung một quyền truy cập; không còn role hoặc màn hình phân quyền.
- Xóa người dùng là khóa mềm tài khoản; không xóa vật lý.
- API `/api/users` yêu cầu đăng nhập và không bao giờ trả về `passwordHash`.

## Giáo viên và học viên

- Giáo viên là hồ sơ độc lập, không liên kết tài khoản `User` và không sử dụng email.
- Trạng thái giáo viên chỉ gồm `ACTIVE` và `INACTIVE`.
- Giáo viên có tỷ lệ trích `0..100%` phục vụ báo cáo thu học phí theo lớp/môn.
- Học viên không sử dụng email; thông tin liên hệ gồm số điện thoại và phụ huynh.

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
