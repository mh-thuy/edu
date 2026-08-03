# Bank reconciliation design

Transaction hash gồm bank account, bank transaction no, date, credit/debit, description và sender account. Candidate match theo notice no, fee no, student code, reference, phone, name và exact amount.

Chỉ auto-confirm khi có đúng một candidate, transaction chưa xử lý, fee chưa PAID/CANCELLED/EXEMPTED và credit amount bằng final_amount. Trạng thái: `IMPORTED`, `AUTO_MATCHED`, `MANUAL_MATCHED`, `CONFIRMED`, `UNMATCHED`, `AMBIGUOUS`, `DUPLICATED`, `AMOUNT_MISMATCH`, `IGNORED`, `REVERSED`, `ERROR`.
