# Phân tích UI hiện tại

## Phạm vi

Đã rà soát các route `/admin/receipts`, `/admin/bank-reconciliation`, `/admin/reports`, API tuition/payment/receipt/bank, Sidebar, `PaymentForm`, `ReceiptList`, `BankReconciliationPanel`, `CurrencyInput` và service/schema tương ứng.

| Thành phần | Route/API/component | Đánh giá |
|---|---|---|
| Danh sách học phí | `/admin/tuition-fees`, `/api/tuition-fees`, `TuitionList` | REWRITE |
| Thanh toán | `/api/payments`, `PaymentForm` | Dùng trong Tuition list/detail |
| Lịch sử payment | Receipts, Reports, Bank reconciliation | Theo dõi qua các màn hình nghiệp vụ tương ứng |
| Biên lai | `/admin/receipts`, `ReceiptList` | REFACTOR |
| Import/đối soát sao kê | `/admin/bank-reconciliation`, `BankReconciliationPanel` | REFACTOR |
| Báo cáo doanh thu/công nợ | `/admin/reports`, `ReportingDashboard` | REFACTOR |
| Input tiền | `CurrencyInput` | KEEP |
| Menu cũ student-fees/debt-tracking | route/page/menu legacy | DELETE |

## Vấn đề đã xác định

- `PaymentForm` cho chọn nhiều học phí trong một request, trái quy tắc một payment thuộc một tuition fee.
- Nút xác nhận còn mơ hồ và thiếu dialog xác nhận nghiệp vụ.
- UI cũ chưa có danh sách học phí độc lập với bộ lọc trạng thái chuẩn.
- Trạng thái được hiển thị trực tiếp bằng mã máy, chưa có nhãn và màu/ý nghĩa nhất quán.
- Import/đối soát hiện là panel một bước; cần tiếp tục tách wizard/preview/validation.

## Logic không còn sử dụng

Không giữ UI chia kỳ, thanh toán một phần, nhập số tiền tùy ý, payment allocation, tiền dư hoặc `PARTIALLY_PAID`. Các route/module legacy đã bị xóa trong đợt cutover database.
