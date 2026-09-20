# API specification

Root resources:

```text
/api/tuition-fees
/api/payment-batches
/api/receipts
/api/bank-accounts
/api/bank-statement-imports
/api/bank-reconciliations
```

Thanh toán được tạo qua `POST /api/payment-batches`; backend tự tính số dư còn lại từ `finalAmount` và tổng payment `SUCCESS`, sau đó kiểm tra số tiền của lần thu không vượt số dư. Request có thể gửi amount theo từng khoản học phí để hỗ trợ thanh toán nhiều lần. Phương thức `CASH` hoặc `BANK_TRANSFER` được chọn tại màn hình thu học phí. Riêng thao tác chủ động tạo thông báo chuyển khoản theo lớp mới tạo các batch `BANK_TRANSFER` `PENDING`; không tạo batch khi chỉ bấm `Tạo học phí tháng`. Batch chuyển khoản ở trạng thái `PENDING` sẽ được xác nhận qua đối soát ngân hàng hoặc hủy trước khi chuyển sang phương thức thanh toán khác.

Khôi phục khoản học phí đã hủy:

```http
POST /api/tuition-fees/{tuitionFeeId}/restore
```

Body:

```json
{
  "reason": "Hủy nhầm khoản học phí",
  "version": 1
}
```

API chỉ khôi phục `CANCELLED` về `UNPAID`, giữ nguyên bản ghi và ghi audit log. Nếu hạn thanh toán đã qua, trạng thái trả về được hiển thị là `OVERDUE`. API từ chối khi khoản phí đã có payment `SUCCESS`, đang thuộc batch `PENDING`, hoặc lớp đã `COMPLETED`/`CANCELLED`.

`POST /api/tuition-fees` không còn được hỗ trợ. Học phí được tạo trong transaction đăng ký môn tại API enrollment; client không được tự gửi số tiền để tạo fee.

`POST /api/bank-statement-imports` chỉ parse và trả kết quả tạm thời; không lưu file hoặc transaction sao kê. `POST /api/bank-reconciliations` nhận token xác nhận và chỉ tạo payment/receipt sau khi backend kiểm tra lại toàn bộ điều kiện nghiệp vụ.

Response giữ `{ success, data }` hoặc `{ success: false, error: { code, message, details } }`.
