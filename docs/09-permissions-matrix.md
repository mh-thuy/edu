# Permissions Matrix

Version: 1.0
Priority: HIGH

## Role definitions

```text
ADMIN
STAFF
TEACHER
```

Ý nghĩa:

```text
Y = Full access
R = Read only
N = No access
```

---

## Matrix

| Module          | ADMIN | STAFF | TEACHER |
| --------------- | ----- | ----- | ------- |
| Dashboard       | Y     | Y     | Y       |
| Users           | Y     | N     | N       |
| Roles           | Y     | N     | N       |
| Teachers        | Y     | Y     | R       |
| Students        | Y     | Y     | N       |
| Rooms           | Y     | Y     | R       |
| Classes         | Y     | Y     | R       |
| Enrollment      | Y     | Y     | N       |
| Schedule        | Y     | Y     | R       |
| Student Fees    | Y     | Y     | N       |
| Payment QR      | Y     | Y     | N       |
| Payment Notice  | Y     | Y     | N       |
| Payments        | Y     | Y     | N       |
| Receipts        | Y     | Y     | N       |
| Salary Rules    | Y     | N     | N       |
| Payroll         | Y     | R     | R       |
| Payroll Approve | Y     | N     | N       |
| Reports         | Y     | Y     | R       |
| System Config   | Y     | N     | N       |

---

## Action Level Permissions

### TEACHER

Cho phép:

```text
Xem lớp của mình
Xem lịch dạy của mình
Xem bảng lương của mình
Xem dashboard cá nhân
```

Không cho:

```text
Create payment
Delete student
Delete class
Approve payroll
Create receipt
Generate student fee
```

---

### STAFF

Cho phép:

```text
CRUD student
CRUD teacher
CRUD class
CRUD schedule
Create student fee
Generate QR
Generate payment notice
Create payment
Create receipt
```

Không cho:

```text
Manage users
Manage roles
Approve payroll
Change system config
Delete payroll
```

---

### ADMIN

Cho phép toàn quyền.

---

## Backend Rule

Không chỉ ẩn UI.

Backend bắt buộc check permission.

Ví dụ:

```text
TEACHER call POST /api/payments

→ 403 Forbidden
```

---

## AI Rules

AI không được:

```text
Cho TEACHER create payment
Cho STAFF approve payroll
Cho STAFF create admin user
```

Permission check phải có:

```text
Frontend
Backend
API middleware
```
