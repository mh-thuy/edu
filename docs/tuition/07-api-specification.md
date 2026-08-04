# API specification

Root resources:

```text
/api/tuition-fees
/api/payment-batches
/api/receipts
/api/bank-accounts
/api/bank-statement-imports
/api/bank-statement-transactions
/api/bank-reconciliations
```

Thanh toán được tạo qua `POST /api/payment-batches`; backend lấy `finalAmount` của từng khoản học phí và không nhận số tiền tùy ý từ client. Batch chuyển khoản ở trạng thái `PENDING` sẽ được xác nhận qua đối soát ngân hàng hoặc hủy trước khi chuyển sang phương thức thanh toán khác.

`POST /api/tuition-fees` không còn được hỗ trợ. Học phí được tạo trong transaction đăng ký môn tại API enrollment; client không được tự gửi số tiền để tạo fee.

Response giữ `{ success, data }` hoặc `{ success: false, error: { code, message, details } }`.
