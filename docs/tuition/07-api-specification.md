# API specification

Root resources:

```text
/api/tuition-fees
/api/payments
/api/payment-refunds
/api/tuition-notices
/api/receipts
/api/bank-accounts
/api/bank-statement-imports
/api/bank-statement-transactions
/api/bank-reconciliations
```

Payment confirm request tối thiểu gồm `tuitionFeeId`, `paymentMethod`, `paymentDate`, `payerName`, `note`, `idempotencyKey`. Backend lấy final_amount; nếu client gửi amount thì chỉ dùng để kiểm tra exact match.

Response giữ `{ success, data }` hoặc `{ success: false, error: { code, message, details } }`.
