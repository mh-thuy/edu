# Business requirements

- Tạo học phí từ enrollment hoặc thao tác quản trị.
- Học phí có các item TUITION, MATERIAL, UNIFORM, EXAM_FEE, OTHER_FEE, DISCOUNT, SCHOLARSHIP.
- `final_amount = original_amount - discount_amount + additional_amount`, backend tự tính.
- Hỗ trợ điều chỉnh, miễn, hủy, phát hành lại notice, thanh toán CASH/BANK_TRANSFER/OTHER; BANK_TRANSFER có thể tạo QR VietQR, receipt, refund, import CSV và reconciliation.
- Học phí chỉ có UNPAID, PAID, OVERDUE, EXEMPTED, CANCELLED.
- Payment chỉ SUCCESS khi amount chính xác bằng final_amount.
