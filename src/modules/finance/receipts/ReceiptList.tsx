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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["finance", "common"]);
  const snackbar = useSnackbar();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: receipts, isLoading, error } = useList<Receipt>(
    "/api/payments?withReceipts=true"
  );

  const handlePrint = (receipt: Receipt) => {
    window.print();
    snackbar.showSuccess(t("finance:printSuccess"));
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
        headerName: t("finance:receiptNumber"),
        width: 150,
        fontWeight: "bold",
      },
      {
        field: "paymentId",
        headerName: t("finance:payments"),
        width: 120,
      },
      {
        field: "issueDate",
        headerName: t("finance:receiptIssueDate"),
        width: 150,
        valueGetter: (params) => new Date(params).toLocaleDateString("vi-VN"),
      },
      {
        field: "printedAt",
        headerName: t("finance:printed"),
        width: 120,
        valueGetter: (params) =>
          params ? t("finance:printed") : t("finance:notPrinted"),
      },
      {
        field: "actions",
        type: "actions",
        width: 180,
        getActions: (params) => [
          <GridActionsCellItem
            key="preview"
            icon={<VisibilityIcon />}
            label={t("finance:preview")}
            onClick={() => handlePreview(params.row as Receipt)}
          />,
          <GridActionsCellItem
            key="print"
            icon={<PrintIcon />}
            label={t("finance:print")}
            onClick={() => handlePrint(params.row as Receipt)}
          />,
        ],
      },
    ],
    [t, handlePrint]
  );

  return (
    <>
      <Card>
        <Box p={2}>
          <Stack direction="row" spacing={2} mb={2}>
            <Typography variant="h6">{t("finance:receiptManagement")}</Typography>
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
            {t("finance:receiptPreview")}
            {selectedReceipt.receiptNumber}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ p: 3, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">
                  {t("finance:receipts")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedReceipt.receiptNumber}
                </Typography>
              </Box>

              <Stack spacing={2}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <Typography variant="body2">
                    <strong>{t("finance:receiptIssueDate")}:</strong>{" "}
                    {new Date(selectedReceipt.issueDate).toLocaleDateString(
                      "vi-VN"
                    )}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t("finance:paymentMethod")}:</strong>{" "}
                    {selectedReceipt.payment?.method || "N/A"}
                  </Typography>
                </Box>

                {selectedReceipt.payment?.studentFee && (
                  <>
                    <Typography variant="body2">
                      <strong>{t("finance:student")}:</strong>{" "}
                      {selectedReceipt.payment.studentFee.studentId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t("finance:class")}:</strong>{" "}
                      {selectedReceipt.payment.studentFee.classId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t("finance:month")}:</strong>{" "}
                      {selectedReceipt.payment.studentFee.month}
                    </Typography>
                  </>
                )}

                <Typography
                  variant="h6"
                  sx={{ pt: 2, borderTop: "1px solid #ddd" }}
                >
                  {t("finance:amount")}:{" "}
                  <span style={{ color: "green", fontWeight: "bold" }}>
                    {selectedReceipt.payment?.amount?.toLocaleString()} VND
                  </span>
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ pt: 2 }}
                >
                  {t("finance:paymentDate")}:{" "}
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
            <Button onClick={() => setShowPreview(false)}>{t("common:close")}</Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                window.print();
                snackbar.showSuccess(t("finance:printCommand"));
              }}
            >
              {t("finance:printReceipt")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
