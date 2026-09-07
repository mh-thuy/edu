# User flows

## Tuition

Chọn lớp -> chọn các môn -> đăng ký enrollment subject -> tự động tạo tuition fee items -> tính final amount -> mở chi tiết học phí -> thanh toán.

## Cash/bank/VietQR payment

Mở fee -> backend lấy final_amount -> tạo payment attempt PENDING -> nhận/xác nhận -> lock fee -> kiểm tra amount/status/idempotency -> SUCCESS -> fee PAID -> receipt -> audit.

## Refund

Chọn payment SUCCESS -> tạo refund PENDING -> approve -> complete toàn bộ -> payment REFUNDED -> fee UNPAID/OVERDUE -> xử lý receipt/audit.

## Excel bank reconciliation

Upload -> parse trong bộ nhớ -> loại trùng với payment đã xác nhận -> tìm `batchNo` trong nội dung và kiểm tra tổng tiền -> xác nhận payment batch transactionally. Chỉ payment/payment batch, receipt và audit sau xác nhận được lưu.
