# User flows

## Tuition

Enrollment -> tạo items -> tính final amount -> issue notice -> print/send -> payment.

## Cash/bank/VietQR payment

Mở fee -> backend lấy final_amount -> tạo payment attempt PENDING -> nhận/xác nhận -> lock fee -> kiểm tra amount/status/idempotency -> SUCCESS -> fee PAID -> receipt -> audit.

## Refund

Chọn payment SUCCESS -> tạo refund PENDING -> approve -> complete toàn bộ -> payment REFUNDED -> fee UNPAID/OVERDUE -> xử lý receipt/audit.

## CSV reconciliation

Upload -> hash/deduplicate -> map/validate -> import transactions -> candidates -> auto/manual match -> exact amount validation -> confirm payment transactionally.
