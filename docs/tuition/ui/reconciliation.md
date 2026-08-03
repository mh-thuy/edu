# Reconciliation

Mỗi bank transaction chỉ ghép một tuition fee. Chỉ bật xác nhận khi credit bằng chính xác `finalAmount`, fee chưa PAID/CANCELLED/EXEMPTED và transaction chưa xác nhận. Thiếu/thừa tiền là `AMOUNT_MISMATCH`, không allocation.
