# Database design

Các aggregate mới:

`tuition_fees`, `tuition_fee_items`, `tuition_adjustments`, `payments`, `payment_refunds`, `receipts`, `tuition_notices`, `tuition_notice_items`, `tuition_notice_deliveries`, `bank_accounts`, `audit_logs`.

Sao kê CSV và ứng viên đối soát là dữ liệu tạm trong bộ nhớ, không có bảng lưu trữ riêng. Thông tin ngân hàng của giao dịch chỉ được lưu trên payment/payment batch sau khi xác nhận thành công.

`payments` cần partial unique index:

```sql
CREATE UNIQUE INDEX uq_success_payment_per_tuition_fee
ON payments(tuition_fee_id) WHERE payment_status = 'SUCCESS';
```

Tiền dùng NUMERIC/Prisma Decimal. Các snapshot notice/receipt không phụ thuộc dữ liệu master thay đổi sau khi phát hành.
