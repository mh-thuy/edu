# User flows

## Tuition

Chọn lớp -> chọn các môn -> đăng ký enrollment subject -> tự động tạo tuition fee items -> tính final amount -> mở chi tiết học phí -> thanh toán.

## Cash/bank/VietQR payment

Mở fee -> backend lấy final_amount -> tạo payment attempt PENDING -> nhận/xác nhận -> lock fee -> kiểm tra amount/status/idempotency -> SUCCESS -> fee PAID -> receipt -> audit.

## Refund

Chọn payment SUCCESS -> tạo refund PENDING -> approve -> complete toàn bộ -> payment REFUNDED -> fee UNPAID/OVERDUE -> xử lý receipt/audit.

## CSV reconciliation

Upload -> hash/deduplicate -> map/validate -> import transactions -> candidates -> auto/manual match -> exact amount validation -> confirm payment transactionally.
