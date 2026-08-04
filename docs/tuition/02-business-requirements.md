# Business requirements hiện hành

- Học phí được tạo tự động khi học viên đăng ký một hoặc nhiều môn trong lớp.
- Không có luồng tạo học phí thủ công hoặc tạo học phí hàng loạt từ màn hình quản trị.
- Một lần đăng ký có thể bổ sung các môn còn thiếu; hệ thống chỉ tạo item học phí cho môn chưa được lập phí.
- Học phí có các item TUITION, MATERIAL, UNIFORM, EXAM_FEE, OTHER_FEE, DISCOUNT, SCHOLARSHIP.
- `final_amount = original_amount - discount_amount + additional_amount`, backend tự tính.
- Hỗ trợ điều chỉnh, miễn, hủy, thanh toán CASH/BANK_TRANSFER/OTHER; BANK_TRANSFER hỗ trợ QR VietQR, receipt, import CSV và reconciliation.
- Học phí chỉ có UNPAID, PAID, OVERDUE, EXEMPTED, CANCELLED.
- Payment chỉ SUCCESS khi amount chính xác bằng final_amount.
