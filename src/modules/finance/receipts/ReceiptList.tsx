"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useMemo } from "react";
import {
  Box,
  Button,
  Card,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useState } from "react";

interface Receipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  issueDate: string;
  printedAt?: string;
  payment?: {
    amount: number;
    method: string;
    paymentDate: string;
    studentFee?: {
      studentId: string;
      classId: string;
      month: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export function ReceiptList() {
  const snackbar = useSnackbar();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: receipts, isLoading, error } = useList<Receipt>(
    "/api/payments?withReceipts=true"
  );

  const handlePrint = (receipt: Receipt) => {
    window.print();
    snackbar.showSuccess("Phiếu thu sẵn sàng để in");
  };

  const handlePreview = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowPreview(true);
  };

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "receiptNumber",
        headerName: "Số phiếu thu",
        width: 150,
        fontWeight: "bold",
      },
      {
        field: "paymentId",
        headerName: "ID Thanh toán",
        width: 120,
      },
      {
        field: "issueDate",
        headerName: "Ngày phát hành",
        width: 150,
        valueGetter: (params) => new Date(params).toLocaleDateString("vi-VN"),
      },
      {
        field: "printedAt",
        headerName: "Đã in",
        width: 120,
        valueGetter: (params) =>
          params ? "Có" : "Chưa",
      },
      {
        field: "actions",
        type: "actions",
        width: 180,
        getActions: (params) => [
          <GridActionsCellItem
            key="preview"
            icon={<VisibilityIcon />}
            label="Xem"
            onClick={() => handlePreview(params.row as Receipt)}
          />,
          <GridActionsCellItem
            key="print"
            icon={<PrintIcon />}
            label="In"
            onClick={() => handlePrint(params.row as Receipt)}
          />,
        ],
      },
    ],
    [handlePrint]
  );

  return (
    <>
      <Card>
        <Box p={2}>
          <Stack direction="row" spacing={2} mb={2}>
            <Typography variant="h6">Quản lý phiếu thu</Typography>
          </Stack>

          {error && (
            <Typography color="error" mb={2}>
              {error}
            </Typography>
          )}

          <BaseTable
            rows={receipts?.items || []}
            columns={columns}
            isLoading={isLoading}
            totalRows={receipts?.total || 0}
            page={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </Box>
      </Card>

      {/* Receipt Preview */}
      {showPreview && selectedReceipt && (
        <Dialog open maxWidth="md" fullWidth>
          <DialogTitle>
            Phiếu thu - {selectedReceipt.receiptNumber}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ p: 3, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">
                  PHIẾU THU
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedReceipt.receiptNumber}
                </Typography>
              </Box>

              <Stack spacing={2}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <Typography variant="body2">
                    <strong>Ngày phát hành:</strong>{" "}
                    {new Date(selectedReceipt.issueDate).toLocaleDateString(
                      "vi-VN"
                    )}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Phương thức:</strong>{" "}
                    {selectedReceipt.payment?.method || "N/A"}
                  </Typography>
                </Box>

                {selectedReceipt.payment?.studentFee && (
                  <>
                    <Typography variant="body2">
                      <strong>Học sinh:</strong>{" "}
                      {selectedReceipt.payment.studentFee.studentId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Lớp:</strong>{" "}
                      {selectedReceipt.payment.studentFee.classId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Tháng:</strong>{" "}
                      {selectedReceipt.payment.studentFee.month}
                    </Typography>
                  </>
                )}

                <Typography
                  variant="h6"
                  sx={{ pt: 2, borderTop: "1px solid #ddd" }}
                >
                  Số tiền:{" "}
                  <span style={{ color: "green", fontWeight: "bold" }}>
                    {selectedReceipt.payment?.amount?.toLocaleString()} VND
                  </span>
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ pt: 2 }}
                >
                  Ngày thanh toán:{" "}
                  {selectedReceipt.payment?.paymentDate
                    ? new Date(
                        selectedReceipt.payment.paymentDate
                      ).toLocaleDateString("vi-VN")
                    : "N/A"}
                </Typography>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPreview(false)}>Đóng</Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                window.print();
                snackbar.showSuccess("Đã gửi lệnh in");
              }}
            >
              In phiếu
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
