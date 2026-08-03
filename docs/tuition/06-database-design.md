# Database design

Các aggregate mới:

`tuition_fees`, `tuition_fee_items`, `tuition_adjustments`, `payments`, `payment_refunds`, `receipts`, `tuition_notices`, `tuition_notice_items`, `tuition_notice_deliveries`, `bank_accounts`, `bank_csv_mappings`, `bank_statement_imports`, `bank_statement_transactions`, `bank_statement_match_candidates`, `audit_logs`.

`payments` cần partial unique index:

```sql
CREATE UNIQUE INDEX uq_success_payment_per_tuition_fee
ON payments(tuition_fee_id) WHERE payment_status = 'SUCCESS';
```

Tiền dùng NUMERIC/Prisma Decimal. Các snapshot notice/receipt không phụ thuộc dữ liệu master thay đổi sau khi phát hành.
