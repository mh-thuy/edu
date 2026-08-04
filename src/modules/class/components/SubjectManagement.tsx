"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Subject = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

export function SubjectManagement() {
  const [items, setItems] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Subject["status"]>("ACTIVE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/subjects?includeInactive=true${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    );
    if (response.ok) setItems(await unwrapApiResponse<Subject[]>(response));
    else
      setError(
        await extractApiErrorMessage(
          response,
          "Không thể tải danh sách môn học",
        ),
      );
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setCode("");
    setName("");
    setStatus("ACTIVE");
    setError("");
    setDialogOpen(true);
  }
  function openEdit(item: Subject) {
    setEditing(item);
    setCode(item.code);
    setName(item.name);
    setStatus(item.status);
    setError("");
    setDialogOpen(true);
  }

  async function save() {
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/subjects/${editing.id}` : "/api/subjects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? { code, name, status } : { code, name },
          ),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể lưu môn học"),
        );
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu môn học",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
        >
          <TextField
            size="small"
            label="Tìm theo tên môn"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 280 }}
          />
          <Button variant="text" onClick={() => setSearch("")} disabled={!search}>Xóa tìm kiếm</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Thêm môn học
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ overflow: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mã môn</TableCell>
              <TableCell>Tên môn học</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={
                      item.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Ngừng hoạt động"
                    }
                    color={item.status === "ACTIVE" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => openEdit(item)}
                  >
                    Sửa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography
                    sx={{ p: 3 }}
                    textAlign="center"
                    color="text.secondary"
                  >
                    Chưa có môn học
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "Sửa môn học" : "Thêm môn học"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Mã môn"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              disabled={saving}
            />
            <TextField
              label="Tên môn học"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={saving}
            />
            {editing && (
              <TextField
                select
                SelectProps={{ native: true }}
                label="Trạng thái"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Subject["status"])
                }
                disabled={saving}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving || !code.trim() || !name.trim()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
