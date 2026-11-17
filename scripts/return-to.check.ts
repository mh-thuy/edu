import assert from "node:assert/strict";
import { resolveReturnTo, withReturnTo } from "../src/lib/return-to";

const P = ["/admin/tuition-fees"] as const;
const FB = "/admin/tuition-fees";

assert.equal(resolveReturnTo(null, P, FB), FB);
assert.equal(resolveReturnTo(undefined, P, FB), FB);
assert.equal(resolveReturnTo("/admin/tuition-fees?status=UNPAID&page=2", P, FB), "/admin/tuition-fees?status=UNPAID&page=2");
assert.equal(resolveReturnTo("/admin/tuition-fees/abc", P, FB), "/admin/tuition-fees/abc");
assert.equal(resolveReturnTo("https://evil.example", P, FB), FB);
assert.equal(resolveReturnTo("//evil.example", P, FB), FB);
assert.equal(resolveReturnTo("/admin/classes/1", P, FB), FB);
assert.equal(resolveReturnTo("/admin/tuition-fees-x", P, FB), FB);
assert.equal(resolveReturnTo("admin/tuition-fees", P, FB), FB);
// Đường dẫn lùi thư mục không được chấp nhận
assert.equal(resolveReturnTo("/admin/tuition-fees/../../admin/users", P, FB), FB);
assert.equal(resolveReturnTo("/admin/tuition-fees/..", P, FB), FB);
// Hai dấu chấm trong tham số tìm kiếm không được làm mất bộ lọc
assert.equal(resolveReturnTo("/admin/tuition-fees?transactionCode=868..abc&status=PENDING", P, FB), "/admin/tuition-fees?transactionCode=868..abc&status=PENDING");
// ?returnTo=a&returnTo=b làm Next truyền vào mảng: không được ném lỗi
assert.equal(resolveReturnTo(["/admin/tuition-fees/1", "/admin/tuition-fees/2"] as unknown as string, P, FB), FB);

assert.equal(withReturnTo("/admin/tuition-fees/1", "/admin/tuition-fees?page=2"), "/admin/tuition-fees/1?returnTo=%2Fadmin%2Ftuition-fees%3Fpage%3D2");
assert.equal(withReturnTo("/admin/x?a=1", "/b"), "/admin/x?a=1&returnTo=%2Fb");

console.log("return-to: OK");
