# Business rules

1. Không hard-delete financial records.
2. Một tuition fee tối đa một payment SUCCESS.
3. Payment SUCCESS phải có amount bằng final_amount; thiếu/thừa trả `PAYMENT_AMOUNT_MISMATCH`.
4. Không thanh toán PAID, CANCELLED hoặc EXEMPTED.
5. Payment FAILED/CANCELLED có thể tạo lại; không tạo payment SUCCESS thứ hai.
6. Mọi confirm payment chạy transaction, khóa tuition fee, kiểm tra idempotency/version và tạo receipt/audit atomically.
7. Không sửa snapshot của notice/receipt đã phát hành; thay bằng version/cancel/reissue.
8. Refund mặc định toàn bộ payment SUCCESS, không sửa payment gốc.
9. Bank transaction chỉ ghép một tuition fee và chỉ confirm nếu credit amount khớp tuyệt đối.
