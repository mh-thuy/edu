# Bank reconciliation design

Transaction hash gồm bank account, mã giao dịch hoặc nội dung dòng. Dữ liệu tạm chỉ tồn tại trong response/token của phiên phân tích; payment đã xác nhận lưu transaction hash trong `transaction_reference`.
Đối soát chỉ xét batch `BANK_TRANSFER` đang `PENDING`, đã gắn đúng tài khoản
ngân hàng được import và có số tiền ghi có bằng chính xác tổng đợt thanh toán.
Hệ thống ưu tiên `batchNo` xuất hiện trong nội dung giao dịch. Nếu không có
`batchNo`, giao diện hiển thị các batch hợp lệ cùng số tiền để người dùng chọn
thủ công; backend vẫn xác thực token, phương thức, tài khoản ngân hàng, trạng
thái batch và toàn bộ allocation.

Chỉ cho xác nhận khi tìm được đúng payment batch đang `PENDING` và số tiền khớp. Các trạng thái phân tích tạm thời là `AUTO_MATCHED`, `UNMATCHED`, `DUPLICATED`, `IGNORED`; trạng thái xác nhận cuối cùng nằm ở payment batch `SUCCESS`, các payment phân bổ, receipt và audit log.
