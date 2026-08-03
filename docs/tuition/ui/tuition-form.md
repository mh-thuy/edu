# Tuition form

Form tạo/sửa dùng MasterSelectField cho học viên/lớp, item fee, discount, scholarship và surcharge; mã học phí được backend tự sinh khi đăng ký, không cho nhập thủ công. API `POST /api/classes/:id/students` cũng tự tạo tuition fee theo `Class.tuitionFee`. Tổng tiền hiển thị tự động theo `original - discount + additional`. Backend tính lại và khóa sửa sau payment SUCCESS.
