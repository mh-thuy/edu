# Bank reconciliation design

Transaction hash gồm bank account, mã giao dịch hoặc nội dung dòng. Dữ liệu tạm chỉ tồn tại trong response/token của phiên phân tích; payment đã xác nhận lưu transaction hash trong `transaction_reference`.
Candidate match theo fee amount, student code, name và payment batch reference.

Chỉ cho xác nhận khi có candidate, fee chưa PAID/CANCELLED/EXEMPTED và credit amount bằng final_amount. Các trạng thái phân tích tạm thời là `AUTO_MATCHED`, `UNMATCHED`, `AMBIGUOUS`, `DUPLICATED`, `IGNORED`; trạng thái xác nhận cuối cùng nằm ở payment/payment batch `SUCCESS` và audit log.
