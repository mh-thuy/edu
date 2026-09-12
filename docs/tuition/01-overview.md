# Tuition rewrite overview

Đặc tả này là nguồn sự thật cho module học phí và thanh toán mới. Mục tiêu là một khoản học phí được thanh toán đủ trong đúng một payment SUCCESS; các lần thử FAILED/CANCELLED vẫn được lưu lịch sử.

Phạm vi: tuition, items, adjustments, notices, one-time payments, receipts, refunds, bank accounts, Excel BIDV/Techcombank import, reconciliation, permissions và audit log.

Không hỗ trợ partial payment, installment hoặc credit balance. Một payment batch có thể gom nhiều khoản học phí, nhưng mỗi khoản phải được phân bổ đúng toàn bộ `final_amount`; không có phân bổ một phần hay tiền dư.
