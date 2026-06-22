# Hướng dẫn UI - Hệ thống quản lý trung tâm đào tạo

Version: 2.0
Style: Admin Dashboard
Ngôn ngữ giao diện: Tiếng Việt
Tech stack: Next.js + React + TypeScript + MUI + React Hook Form + Zod

---

# 1. Mục tiêu UI

Giao diện được thiết kế cho nhân viên trung tâm sử dụng hằng ngày để quản lý:

- Học viên
- Giáo viên
- Phòng học
- Lớp học
- Lịch học
- Học phí
- QR thanh toán
- Bill tạm
- Thanh toán
- Biên lai
- Bảng lương giáo viên
- Báo cáo

Nguyên tắc chính:

- Dễ hiểu
- Ít thao tác
- Dữ liệu rõ ràng
- Trạng thái dễ nhận biết
- Không làm người dùng phải đoán
- Không hiển thị thuật ngữ kỹ thuật cho người dùng cuối

---

# 2. Phong cách giao diện

Dùng phong cách **Admin Dashboard**.

Bố cục tổng thể:

```text
+------------------------------------------------------+
| Topbar                                               |
+----------------------+-------------------------------+
| Sidebar              | Main Content                  |
|                      |                               |
| Dashboard            | Page title                    |
| Học viên             | Search / Filter               |
| Giáo viên            | Action buttons                |
| Lớp học              | Table / Form / Detail         |
| Học phí              | Pagination                    |
| Thanh toán           |                               |
| Báo cáo              |                               |
+----------------------+-------------------------------+
```

---

# 3. Layout chính

## 3.1 Sidebar

Sidebar nằm bên trái.

Menu gợi ý:

```text
Tổng quan

Quản lý đào tạo
- Học viên
- Giáo viên
- Phòng học
- Lớp học
- Đăng ký lớp
- Lịch học

Tài chính
- Học phí
- Bill tạm
- Thanh toán
- Biên lai
- Công nợ

Lương giáo viên
- Quy tắc chia lương
- Bảng lương

Hệ thống
- Người dùng
- Phân quyền
- Cấu hình
```

Rule:

- Menu đang chọn phải được highlight.
- Menu có icon.
- Sidebar có thể thu gọn.
- Khi thu gọn chỉ hiển thị icon.
- Không dùng tên tiếng Anh cho menu.

## 3.2 Topbar

Topbar hiển thị:

- Tên hệ thống
- Nút mở/đóng sidebar
- Tên user đang đăng nhập
- Role user
- Nút đăng xuất

Ví dụ:

```text
Trung tâm đào tạo ABC                      Nguyễn Văn A - STAFF
```

## 3.3 Main content

Mỗi màn hình gồm:

```text
Page Header
Search / Filter Area
Primary Actions
Data Table
Pagination
```

---

# 4. Quy chuẩn page header

Mỗi page phải có:

- Tiêu đề tiếng Việt
- Mô tả ngắn nếu cần
- Nút thao tác chính nằm bên phải

Ví dụ:

```text
Quản lý học viên
Theo dõi hồ sơ và trạng thái học viên

                                      [+ Thêm học viên]
```

Không dùng title chung chung như:

```text
List
Management
Data
```

---

# 5. Quy chuẩn danh sách

## 5.1 Cấu trúc màn hình list

Màn hình list chuẩn:

```text
[Tiêu đề màn hình]                         [Nút thêm mới]

[Khối tìm kiếm / bộ lọc]

[Bảng dữ liệu]

[Phân trang]
```

## 5.2 Search / Filter

Khối tìm kiếm nên đặt trong `Paper` hoặc `Card`.

Rule:

- Có input tìm kiếm chính.
- Có filter trạng thái nếu module có status.
- Có nút `Tìm kiếm`.
- Có nút `Làm mới`.
- Nhấn Enter trong ô tìm kiếm phải thực hiện tìm kiếm.
- Khi search mới phải reset page về 1.
- Không gọi API liên tục theo từng ký tự nếu chưa debounce.

Ví dụ:

```text
[Tìm theo mã, tên, số điện thoại...] [Trạng thái] [Tìm kiếm] [Làm mới]
```

## 5.3 Table

Rule:

- Có loading state.
- Có empty state.
- Có pagination.
- Cột thao tác nằm cuối bảng.
- Status dùng Chip.
- Tiền phải format VND.
- Ngày phải format dd/MM/yyyy.
- Không hiển thị UUID nếu không cần.

Empty state:

```text
Không có dữ liệu
```

Nếu đang search:

```text
Không tìm thấy dữ liệu phù hợp
```

Loading state:

- Dùng Skeleton hoặc loading của Table/DataGrid.
- Không để màn hình trắng.

---

# 6. Quy chuẩn form

## 6.1 Công nghệ form

Tất cả form phải dùng:

```text
React Hook Form + Zod
```

Không tự quản lý từng field bằng nhiều `useState` nếu không cần.

## 6.2 Validation

Lỗi field hiển thị ngay dưới field bằng helper text.

Ví dụ:

```text
Mã học viên là bắt buộc
Email không đúng định dạng
Số tiền phải lớn hơn 0
Ngày kết thúc phải lớn hơn ngày bắt đầu
```

Không dùng alert chung cho lỗi từng field.

## 6.3 Submit

Rule:

- Disable nút lưu khi đang submit.
- Hiển thị loading trên nút lưu.
- Lưu thành công thì đóng dialog hoặc quay lại list.
- Hiển thị snackbar thành công.
- Lỗi thì giữ nguyên form và hiển thị lỗi.

Nhãn nút:

```text
Lưu
Hủy
Cập nhật
Tạo mới
Xóa
Đóng
```

Không dùng:

```text
Submit
OK
Cancel
```

---

# 7. Dialog

Dùng dialog cho:

- Thêm mới
- Chỉnh sửa
- Xác nhận xóa
- Chọn học viên
- Chọn giáo viên
- Chọn lớp
- Chọn phòng
- In bill tạm
- Ghi nhận thanh toán

Rule:

- Title rõ ràng.
- Button chính nằm bên phải.
- Button hủy nằm trước button chính.
- Không đóng dialog khi submit lỗi.
- Form dài dùng `maxWidth="md"` hoặc `maxWidth="lg"`.
- Dialog xác nhận phải có nội dung mô tả hậu quả.

Ví dụ confirm:

```text
Bạn có chắc muốn xóa học viên này?
Dữ liệu đã phát sinh học phí hoặc thanh toán sẽ không được phép xóa.
```

---

# 8. Không dùng select dài

Không dùng Select cho dữ liệu lớn như:

- Học viên
- Giáo viên
- Lớp học
- Phòng học nếu danh sách nhiều
- Khoản học phí

Thay bằng:

```text
TextField readonly + Button chọn
```

Ví dụ:

```text
[ST001 - Nguyễn Văn A] [Chọn học viên]
```

Khi bấm `Chọn học viên`, mở dialog chọn.

---

# 9. Dialog chọn dữ liệu

Áp dụng cho:

- StudentSelectDialog
- TeacherSelectDialog
- ClassSelectDialog
- RoomSelectDialog
- StudentFeeSelectDialog

Cấu trúc:

```text
Title
Search input
Table
Pagination
Cancel
```

Khi chọn record:

- Trả về `id`
- Hiển thị `code + name`
- Không chỉ hiển thị UUID

Ví dụ:

```text
ST001 - Nguyễn Văn A
GV001 - Trần Thị B
ENG001 - English Beginner
R001 - Phòng 1
```

---

# 10. Format dữ liệu

## 10.1 Tiền tệ

Tất cả tiền hiển thị dạng VND:

```text
3.000.000 ₫
```

Không hiển thị:

```text
3000000
```

Input tiền:

- Canh phải
- Không cho số âm nếu nghiệp vụ không cho phép
- Có thể hiển thị separator hàng nghìn

## 10.2 Ngày giờ

Ngày:

```text
dd/MM/yyyy
```

Tháng học phí:

```text
yyyy-MM
```

Giờ:

```text
HH:mm
```

Không hiển thị ISO raw:

```text
2026-06-18T10:00:00.000Z
```

---

# 11. Status Chip

Status phải hiển thị bằng Chip tiếng Việt.

Ví dụ:

```text
ACTIVE    -> Đang hoạt động
INACTIVE  -> Ngừng hoạt động
ON_LEAVE  -> Tạm nghỉ

DRAFT     -> Nháp
COMPLETED -> Hoàn thành
CANCELLED -> Đã hủy

UNPAID    -> Chưa thanh toán
PARTIAL   -> Thanh toán một phần
PAID      -> Đã thanh toán

SENT      -> Đã gửi
PRINTED   -> Đã in
```

Không hiển thị enum raw nếu người dùng không hiểu.

---

# 12. Dashboard

Dashboard là màn hình đầu tiên sau khi đăng nhập.

Nên hiển thị các card thống kê:

```text
Tổng số học viên
Lớp đang học
Học phí chưa thu
Thanh toán hôm nay
Lương giáo viên chờ duyệt
```

Các khu vực gợi ý:

```text
1. Thống kê nhanh
2. Công nợ học phí
3. Lịch học hôm nay
4. Thanh toán gần đây
5. Cảnh báo cần xử lý
```

Ví dụ cảnh báo:

```text
- 12 học viên chưa đóng học phí tháng 2026-06
- 3 lớp chưa có lịch học
- 2 bảng lương đang chờ duyệt
```

---

# 13. Module Người dùng

## 13.1 List columns

```text
Email
Họ tên
Vai trò
Trạng thái
Ngày tạo
Thao tác
```

## 13.2 Form fields

```text
Email
Họ tên
Mật khẩu
Vai trò
Trạng thái
```

## 13.3 UI rules

- Password chỉ bắt buộc khi tạo mới.
- Khi chỉnh sửa user, không hiển thị password trực tiếp.
- Nếu cần đổi mật khẩu, dùng action riêng `Đổi mật khẩu`.
- Role hiển thị tiếng Việt:
  - ADMIN -> Quản trị
  - STAFF -> Nhân viên
  - TEACHER -> Giáo viên

---

# 14. Module Giáo viên

## 14.1 List columns

```text
Mã GV
Họ tên / Email
Số điện thoại
Chuyên môn
Có tài khoản
Trạng thái
Thao tác
```

## 14.2 Form fields

```text
Mã giáo viên
Tài khoản liên kết
Email
Số điện thoại
Số tài khoản ngân hàng
Chuyên môn
Trạng thái
```

## 14.3 UI rules

- Giáo viên có thể có hoặc không có tài khoản đăng nhập.
- Nếu chọn `user_id`, email lấy từ user và readonly.
- Nếu không chọn `user_id`, cho phép nhập email riêng.
- Hiển thị rõ giáo viên có tài khoản login hay không.
- Không cho người dùng nhập trùng mã giáo viên.

---

# 15. Module Học viên

## 15.1 List columns

```text
Mã HV
Họ tên
Số điện thoại
Email
Phụ huynh
Trạng thái
Thao tác
```

## 15.2 Form fields

```text
Mã học viên
Họ tên
Email
Số điện thoại
Ngày sinh
Tên phụ huynh
Địa chỉ
Trạng thái
```

## 15.3 UI rules

- Mã học viên bắt buộc.
- Họ tên bắt buộc.
- Email không bắt buộc nhưng nếu nhập phải đúng định dạng.
- Trạng thái mặc định là `Đang học`.

---

# 16. Module Phòng học

## 16.1 List columns

```text
Mã phòng
Tên phòng
Sức chứa
Tầng
Vị trí
Trạng thái
Thao tác
```

## 16.2 Form fields

```text
Mã phòng
Tên phòng
Sức chứa
Tầng
Vị trí
Trạng thái
Ghi chú
```

## 16.3 UI rules

- Không cho chọn phòng đang bảo trì hoặc không sử dụng khi tạo lịch học mới.
- Sức chứa phải lớn hơn 0.

---

# 17. Module Lớp học

## 17.1 List columns

```text
Mã lớp
Tên lớp
Giáo viên
Phòng
Học phí
Số học viên
Trạng thái
Thao tác
```

## 17.2 Form fields

```text
Mã lớp
Tên lớp
Giáo viên phụ trách
Phòng mặc định
Học phí
Tổng số buổi
Số học viên tối đa
Ngày bắt đầu
Ngày kết thúc
Trạng thái
```

## 17.3 UI rules

- Giáo viên chọn qua TeacherSelectDialog.
- Phòng chọn qua RoomSelectDialog.
- Không dùng select dài.
- Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.
- Không cho xóa lớp nếu đã phát sinh học phí hoặc thanh toán.

---

# 18. Module Đăng ký học viên vào lớp

Màn hình nên có:

```text
Chọn lớp
Thông tin lớp
Danh sách học viên trong lớp
Nút thêm học viên
Nút xóa học viên khỏi lớp
```

Rule:

- Chọn học viên qua StudentSelectDialog.
- Không cho thêm trùng học viên.
- Cảnh báo nếu lớp đã đủ số lượng.
- Hiển thị số lượng hiện tại / tối đa.

Ví dụ:

```text
Sĩ số: 12 / 15
```

---

# 19. Module Lịch học

## 19.1 List columns

```text
Lớp
Giáo viên
Phòng
Thứ
Giờ bắt đầu
Giờ kết thúc
Thao tác
```

## 19.2 Form fields

```text
Lớp
Giáo viên
Phòng
Thứ trong tuần
Giờ bắt đầu
Giờ kết thúc
```

## 19.3 UI rules

- Khi chọn lớp, tự gợi ý giáo viên/phòng mặc định.
- Khi đổi giờ/phòng/giáo viên, gọi API check conflict.
- Nếu conflict, hiển thị lỗi rõ ràng.
- Không cho lưu nếu start_time >= end_time.

Ví dụ lỗi:

```text
Phòng R001 đã có lớp ENG001 từ 18:00 đến 20:00.
```

---

# 20. Module Học phí

## 20.1 List columns

```text
Mã học viên
Tên học viên
Lớp
Tháng
Số tiền
Đã thu
Còn nợ
Trạng thái
Thao tác
```

## 20.2 Actions

```text
Xem chi tiết
In bill tạm
Ghi nhận thanh toán
```

## 20.3 Form tạo học phí

```text
Tháng
Lớp
Học viên
Số tiền
Giảm giá
Hạn đóng
Ghi chú
```

## 20.4 Bulk create

Màn hình tạo học phí hàng loạt:

```text
Chọn tháng
Chọn lớp
Preview danh sách học viên
Tạo học phí
Sinh QR
Sinh bill tạm
```

Confirm trước khi tạo:

```text
Bạn có chắc muốn tạo học phí tháng 2026-06 cho lớp ENG001?
Hệ thống sẽ sinh học phí, QR code và bill tạm cho toàn bộ học viên trong lớp.
```

Rule:

- Không tạo học phí trùng student + class + month.
- Sau khi tạo học phí thành công, hiển thị in bill tạm.

---

# 21. Module QR thanh toán

QR dialog hiển thị:

```text
Tên học viên
Lớp
Tháng học phí
Số tiền cần thanh toán
Nội dung chuyển khoản
QR Code
```

Actions:

```text
Tải QR
Copy nội dung chuyển khoản
In bill tạm
```

Rule:

- QR hết hạn phải hiển thị cảnh báo.
- Nếu học phí đổi số tiền, yêu cầu tạo lại QR.
- Không hiển thị QR nếu học phí đã thanh toán đủ, trừ khi xem lịch sử.

---

# 22. Module Bill tạm / Phiếu báo học phí

Bill tạm phải ghi rõ:

```text
PHIẾU BÁO HỌC PHÍ
Không phải biên lai thu tiền
```

Nội dung bill:

```text
Mã phiếu
Ngày tạo
Học viên
Lớp
Tháng học phí
Học phí
Giảm giá
Số tiền cần thanh toán
Hạn thanh toán
QR Code
Thông tin chuyển khoản
```

Actions:

```text
In PDF
Gửi email/Zalo
Đánh dấu đã gửi
```

Rule:

- Bill tạm không phải receipt.
- Có thể in lại nhiều lần.
- Có thể gửi lại nhiều lần.
- Khi đã thanh toán đủ, bill tạm chỉ xem lịch sử.

---

# 23. Module Thanh toán

## 23.1 List columns

```text
Mã học phí
Học viên
Lớp
Số tiền thanh toán
Phương thức
Ngày thanh toán
Thao tác
```

## 23.2 Form fields

```text
Khoản học phí
Số tiền còn nợ
Số tiền thanh toán
Phương thức
Ngày thanh toán
Ghi chú
```

## 23.3 UI rules

- Không cho nhập số tiền lớn hơn còn nợ.
- Nếu thanh toán đủ, preview trạng thái mới là `Đã thanh toán`.
- Nếu thanh toán một phần, preview trạng thái mới là `Thanh toán một phần`.
- Sau khi lưu payment thành công, gợi ý in biên lai.

---

# 24. Module Biên lai

## 24.1 List columns

```text
Số biên lai
Học viên
Lớp
Số tiền
Ngày phát hành
Ngày in
Thao tác
```

## 24.2 UI rules

- Receipt chỉ có sau payment.
- Không tạo receipt trực tiếp nếu chưa có payment.
- Cho phép in lại.
- Không cho sửa số tiền receipt nếu payment đã cố định.

Phân biệt rõ:

```text
Bill tạm: thông báo cần thanh toán
Biên lai: xác nhận đã thu tiền
```

---

# 25. Module Quy tắc chia lương

List columns:

```text
Lớp
Tỷ lệ trung tâm giữ lại
Ngày tạo
Thao tác
```

Form fields:

```text
Lớp
Tỷ lệ trung tâm giữ lại (%)
```

Rule:

- Mỗi lớp chỉ có một quy tắc chia lương.
- Tỷ lệ phải từ 0 đến 100.

---

# 26. Module Bảng lương giáo viên

## 26.1 List columns

```text
Giáo viên
Tháng
Doanh thu
Phí trung tâm
Lương giáo viên
Trạng thái
Thao tác
```

## 26.2 Actions

```text
Tính lương
Xem chi tiết
Duyệt
Đánh dấu đã trả
```

## 26.3 UI rules

- Không cho sửa bảng lương khi status = PAID.
- Chi tiết payroll hiển thị theo từng lớp.
- Trước khi duyệt phải confirm.
- Trước khi đánh dấu đã trả phải confirm.

---

# 27. Snackbar / Toast

Thông báo thành công:

```text
Đã lưu thành công
Đã xóa thành công
Đã tạo học phí thành công
Đã ghi nhận thanh toán
Đã in bill tạm
Đã tạo biên lai
```

Thông báo lỗi:

```text
Không thể lưu dữ liệu
Dữ liệu đã tồn tại
Có lỗi xảy ra, vui lòng thử lại
Không thể thanh toán vượt số tiền còn nợ
Không thể tạo học phí trùng tháng
```

Không hiển thị lỗi kỹ thuật raw cho người dùng cuối.

---

# 28. Confirm Dialog

Các action bắt buộc confirm:

- Xóa dữ liệu
- Hủy lớp
- Tạo học phí hàng loạt
- Ghi nhận thanh toán
- Tạo biên lai
- Duyệt bảng lương
- Đánh dấu đã trả lương

Ví dụ:

```text
Bạn có chắc muốn ghi nhận thanh toán này?
Sau khi ghi nhận, trạng thái học phí sẽ được cập nhật.
```

---

# 29. Phân quyền UI

Role:

```text
ADMIN
STAFF
TEACHER
```

Gợi ý:

```text
ADMIN:
- Toàn quyền

STAFF:
- Quản lý học viên, lớp, lịch học, học phí, thanh toán, biên lai

TEACHER:
- Xem lớp của mình
- Xem lịch dạy của mình
- Xem bảng lương của mình
```

Rule:

- Ẩn hoặc disable action theo quyền.
- API vẫn phải kiểm tra quyền, không chỉ dựa vào UI.

---

# 30. Responsive

Ưu tiên desktop.

Nhưng tablet/mobile phải dùng được cơ bản:

- Table có horizontal scroll.
- Dialog không vượt màn hình.
- Button không bị tràn.
- Form field fullWidth trên mobile.
- Sidebar có thể collapse.

---

# 31. Accessibility

Rule:

- Input phải có label.
- Button phải có text rõ ràng.
- Icon button phải có tooltip.
- Không dùng màu làm thông tin duy nhất.
- Error message phải đọc được.
- Tab order hợp lý.

---

# 32. Code organization

Khuyến nghị cấu trúc:

```text
src/
  app/
  components/
  layouts/
  modules/
    students/
      components/
      hooks/
      services/
      schemas/
      types/
    teachers/
    classes/
    student-fees/
    payments/
  utils/
  constants/
```

Mỗi module nên có:

```text
components
hooks
services
schemas
types
```

Không để một page quá dài.

---

# 33. Quy tắc code UI

Không dùng:

```text
any
eslint-disable
document.querySelector
hard-code API response
hard-code business status text nhiều nơi
```

Nên dùng:

```text
TypeScript type rõ ràng
Zod schema
Service layer gọi API
Constants cho status labels
Helper format tiền/ngày
Reusable components
```

---

# 34. Checklist sau khi implement mỗi module

Phải kiểm tra:

```bash
npm run lint
npm run typecheck
npm run build
```

Test thủ công:

```text
List
Search
Pagination
Create
Edit
Delete
Validation
Empty state
Loading state
Error state
Permission
```

---

# 35. Quy tắc dành cho Codex / AI coding agent

Khi implement UI:

1. Đọc file business-requirements.md trước.
2. Đọc business-rules.md nếu có.
3. Đọc api-contract.md nếu có.
4. Không tự ý thay đổi nghiệp vụ.
5. Không đổi tên field nếu không cập nhật toàn bộ stack.
6. Không thêm thư viện mới nếu chưa cần.
7. Ưu tiên component tái sử dụng.
8. Sau khi sửa phải chạy lint/typecheck/build.
9. Nếu API chưa có, tạo service interface rõ ràng.
10. Nếu rule nghiệp vụ chưa rõ, thêm TODO rõ ràng thay vì tự suy diễn.
