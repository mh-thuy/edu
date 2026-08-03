# CSV import design

Import có file hash, bank account, mapping, encoding (UTF-8/BOM/Windows-1258/Shift-JIS), delimiter comma/semicolon/tab, date/number format, preview và error export.

Trạng thái: `UPLOADED`, `VALIDATING`, `VALIDATED`, `PROCESSING`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`. Chặn file trùng bằng `(bank_account_id, file_hash)` và giao dịch trùng bằng transaction hash. Sanitize formula khi export CSV.
# CSV import implementation

Đã hỗ trợ sao kê ngân hàng dạng `;`, encoding Windows-1252, ngày `dd/MM/yyyy HH:mm`, tiền có hậu tố `VND` và số tiền âm/dương. File được hash SHA-256 để chống import trùng. Giao dịch ghi nợ không tham gia đối soát học phí; giao dịch ghi có tạo candidates theo số tiền, mã học sinh hoặc tên học sinh.

CLI: `npm run bank:import -- "/path/to/sao ke.csv" [bank-account-id]`.

API: `POST /api/bank-statement-imports` với multipart fields `file` và `bankAccountId`; xem kết quả qua `GET /api/bank-statement-transactions`.
