# Navigation flow

```mermaid
flowchart TD
  A[Danh sách học phí] --> B[Chi tiết học phí]
  B --> C[Thanh toán toàn bộ một lần]
  C --> D[Xác nhận]
  D --> E[PAID và phát hành biên lai]
  F[Import sao kê] --> G[Preview và validation]
  G --> H[Đối soát một giao dịch - một học phí]
  H --> E
  E --> I[Receipt PDF]
```

Routes chính: `/admin/classes`, `/admin/tuition-fees`, `/admin/receipts`, `/admin/bank-reconciliation`. Thao tác thanh toán thực hiện từ danh sách hoặc chi tiết học phí; lịch sử thu xem tại Biên lai, Báo cáo và Đối soát ngân hàng. Quản lý lịch học nằm trong `/admin/classes/:id` → tab `Lịch học`; không còn màn hình CRUD lịch học độc lập cho ADMIN/STAFF.
