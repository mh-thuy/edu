# Screen specification

- Tuition list/detail/adjustment/exemption/cancellation: snapshot tiền, item, due date, status, history và quyền. Không có màn hình create thủ công.
- Payment create/detail/attempt history: chọn một fee, amount mặc định final_amount và read-only; không có partial amount.
- Payment workspace: chọn fee từ chi tiết học phí, số tiền mặc định theo số còn nợ và read-only theo nghiệp vụ.
- Receipt preview/print/cancel: một receipt cho payment, immutable snapshot.
- Refund create/detail: full refund, approval/status.
- Bank account, CSV mapping, import preview/result, reconciliation list/detail/manual match.

Mọi màn hình cần loading, empty, error, permission, confirmation, chống double submit và pagination stable.
