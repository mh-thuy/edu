"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type User = {
  id: string;
  email: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
};
type FormState = {
  email: string;
  fullName: string;
  password: string;
  status: User["status"];
};
const emptyForm: FormState = {
  email: "",
  fullName: "",
  password: "",
  status: "ACTIVE",
};
const statusLabel = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
} as const;

export function UserManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [items, setItems] = useState<User[]>([]);
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
      }>(response);
      setItems(result.items);
      setTotal(result.total);
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
  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
        }}
      >
        <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        gap={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
              <PeopleAltOutlinedIcon />
            </Box>
            <BoxTitle />
          </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Thêm người dùng
        </Button>
        </Stack>
      </Paper>
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}
      {error && !open && <Alert severity="error">{error}</Alert>}
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: { md: 1 } }}>
          <FilterAltOutlinedIcon color="action" fontSize="small" />
          <Typography variant="subtitle2">Bộ lọc</Typography>
        </Stack>
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
        <Button variant="outlined" onClick={() => { setSearch(""); setStatus(""); setPage(0); }} disabled={!search && !status}>Xóa bộ lọc</Button>
        </Stack>
      </Paper>
      <Paper sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 700 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography sx={{ p: 3 }} textAlign="center">
                    Đang tải người dùng...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : !items.length ? (
              <TableRow>
                <TableCell colSpan={4}>
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
        fullScreen={isMobile}
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
        Quản lý tài khoản đăng nhập và trạng thái hoạt động.
      </Typography>
    </Box>
  );
}
