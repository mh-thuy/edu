# Screen specification

- Tuition list/detail/create/adjustment/exemption/cancellation: snapshot tiền, item, due date, status, history và quyền.
- Payment create/detail/attempt history: chọn một fee, amount mặc định final_amount và read-only; không có partial amount.
- Notice preview/history/delivery: snapshot, issue/reissue/print/send.
- Receipt preview/print/cancel: một receipt cho payment, immutable snapshot.
- Refund create/detail: full refund, approval/status.
- Bank account, CSV mapping, import preview/result, reconciliation list/detail/manual match.

Mọi màn hình cần loading, empty, error, permission, confirmation, chống double submit và pagination stable.
