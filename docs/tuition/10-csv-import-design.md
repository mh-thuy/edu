# Excel bank statement import design

Import xử lý file trong bộ nhớ, không lưu file, import record hoặc transaction tạm vào database. Kết quả phân tích được trả về giao diện cùng token đối soát có chữ ký và thời hạn.

Hiện hỗ trợ file Excel `.xlsx` theo format BIDV và Techcombank. BIDV hỗ trợ bảng cột `Ngày giao dịch`, `Nội dung giao dịch`, `Số tiền`, `Số dư`, `Mã giao dịch`. Techcombank hỗ trợ bảng `NGAY`, `DIEN GIAI`, `CHI TIET`, `NO`, `CO`, `SO DU`. Mỗi ngân hàng có parser riêng; các ngân hàng chưa có parser sẽ bị từ chối. Giao dịch ghi nợ bị bỏ qua; giao dịch ghi có chỉ được đối soát khi nội dung chứa đúng mã đợt thanh toán và số tiền bằng tổng đợt.

Chống trùng dựa trên transaction hash/mã giao dịch của các payment hoặc payment batch đã xác nhận. Chỉ khi người dùng xác nhận, hệ thống mới tạo payment, receipt và audit log.

CLI: `npm run bank:import -- "/path/to/sao ke.xlsx" [bank-account-id]` (hiện hỗ trợ BIDV và Techcombank).

API: `POST /api/bank-statement-imports` với multipart fields `file` và `bankAccountId`; xác nhận qua `POST /api/bank-reconciliations`.
