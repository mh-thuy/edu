"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};
type User = {
  id: string;
  email: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  roles: Array<{ role: Role }>;
};
type FormState = {
  email: string;
  fullName: string;
  password: string;
  status: User["status"];
  roleIds: string[];
};
const emptyForm: FormState = {
  email: "",
  fullName: "",
  password: "",
  status: "ACTIVE",
  roleIds: [],
};
const statusLabel = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
} as const;

export function UserManagement() {
  const [items, setItems] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetch(`/api/users?${params}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải người dùng"),
        );
      const result = await unwrapApiResponse<{
        items: User[];
        total: number;
        roles: Role[];
      }>(response);
      setItems(result.items);
      setTotal(result.total);
      setRoles(result.roles);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tải người dùng",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError("");
    setOpen(true);
  };
  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      email: user.email,
      fullName: user.fullName,
      password: "",
      status: user.status,
      roleIds: user.roles.map(({ role }) => role.id),
    });
    setError("");
    setOpen(true);
  };
  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/users/${editing.id}` : "/api/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            ...(editing && !form.password ? { password: undefined } : {}),
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể lưu người dùng"),
        );
      setMessage(editing ? "Đã cập nhật người dùng" : "Đã tạo người dùng");
      setOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu người dùng",
      );
    } finally {
      setLoading(false);
    }
  };
  const deactivate = async (user: User) => {
    if (!window.confirm(`Khóa tài khoản ${user.email}?`)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể khóa người dùng"),
        );
      setMessage("Đã khóa người dùng");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể khóa người dùng",
      );
    } finally {
      setLoading(false);
    }
  };
  const roleText = useMemo(
    () => (user: User) => user.roles.map(({ role }) => role.name).join(", "),
    [],
  );
  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        gap={2}
      >
        <BoxTitle />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Thêm người dùng
        </Button>
      </Stack>
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}
      {error && !open && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <TextField
          size="small"
          label="Tìm email hoặc họ tên"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <Select
          size="small"
          displayEmpty
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
        >
          <MenuItem value="">Tất cả trạng thái</MenuItem>
          {Object.entries(statusLabel).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </Select>
        <Button variant="text" onClick={() => { setSearch(""); setStatus(""); setPage(0); }} disabled={!search && !status}>Xóa bộ lọc</Button>
      </Stack>
      <Paper sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 700 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography sx={{ p: 3 }} textAlign="center">
                    Đang tải người dùng...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : !items.length ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    sx={{ p: 3 }}
                    textAlign="center"
                    color="text.secondary"
                  >
                    Không có người dùng phù hợp
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{roleText(user)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabel[user.status]}
                      color={user.status === "ACTIVE" ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => openEdit(user)}>
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => void deactivate(user)}
                      disabled={user.status === "INACTIVE" || loading}
                    >
                      Khóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        onPageChange={(_, value) => setPage(value)}
        onRowsPerPageChange={(event) => {
          setPageSize(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50]}
      />
      <Dialog
        open={open}
        onClose={() => !loading && setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? "Sửa người dùng" : "Thêm người dùng"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Họ tên"
              required
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
            <TextField
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
            <TextField
              label={
                editing ? "Mật khẩu mới (bỏ trống nếu không đổi)" : "Mật khẩu"
              }
              required={!editing}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <FormControl>
              <InputLabel>Trạng thái</InputLabel>
              <Select
                label="Trạng thái"
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as FormState["status"],
                  })
                }
              >
                {Object.entries(statusLabel).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="subtitle2">Phân quyền</Typography>
            <FormGroup>
              {roles.map((role) => (
                <FormControlLabel
                  key={role.id}
                  control={
                    <Checkbox
                      checked={form.roleIds.includes(role.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          roleIds: event.target.checked
                            ? [...form.roleIds, role.id]
                            : form.roleIds.filter((id) => id !== role.id),
                        })
                      }
                    />
                  }
                  label={`${role.code} — ${role.name}`}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function BoxTitle() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        Quản lý người dùng
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Quản lý tài khoản đăng nhập, trạng thái và phân quyền hệ thống.
      </Typography>
    </Box>
  );
}
