# Business requirements hiện hành

- Học phí được tạo tự động khi học viên đăng ký một hoặc nhiều môn trong lớp.
- Không có luồng tạo học phí thủ công hoặc tạo học phí hàng loạt từ màn hình quản trị.
- Một lần đăng ký có thể bổ sung các môn còn thiếu khi kỳ học phí chưa có payment `SUCCESS` hoặc batch `PENDING`; hệ thống chỉ tạo item học phí cho môn chưa được lập phí. Sau khi đã thanh toán thành công, thành phần item của kỳ được khóa để bảo toàn báo cáo và snapshot chứng từ.
- Học phí có các item TUITION, MATERIAL, UNIFORM, EXAM_FEE, OTHER_FEE, DISCOUNT, SCHOLARSHIP.
- `final_amount = original_amount - discount_amount + additional_amount`, backend tự tính.
- Hỗ trợ điều chỉnh, miễn, hủy, thanh toán CASH/BANK_TRANSFER; BANK_TRANSFER hỗ trợ QR VietQR, receipt, import Excel BIDV/Techcombank và reconciliation.
- Học phí chỉ có UNPAID, PAID, OVERDUE, EXEMPTED, CANCELLED.
- Một khoản học phí có thể có nhiều payment `SUCCESS`; mỗi payment phải lớn hơn 0 và không vượt số dư còn lại, tổng các payment `SUCCESS` không vượt `final_amount`.
