"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { Box, Card, Typography } from "@mui/material";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSnackbar } from "@/hooks/useSnackbar";
import { payrollApi } from "@/modules/payroll/services/payroll.service";
import {
  type PayrollListData,
  type TeacherPayrollDto,
} from "@/modules/payroll/services/payroll.types";
import { PayrollCalculateDialog } from "@/modules/finance/teacher-payroll/components/PayrollCalculateDialog";
import { PayrollDetailDialog } from "@/modules/finance/teacher-payroll/components/PayrollDetailDialog";
import {
  PayrollFilter,
  type PayrollFilterValue,
} from "@/modules/finance/teacher-payroll/components/PayrollFilter";
import { PayrollTable } from "@/modules/finance/teacher-payroll/components/PayrollTable";

interface ConfirmActionState {
  id: string;
  type: "approve" | "pay";
  title: string;
  message: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const emptyPayrollList: PayrollListData<TeacherPayrollDto> = {
  items: [],
  total: 0,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_LIMIT,
  pages: 0,
};

export function PayrollList(): ReactElement {
  const snackbar = useSnackbar();
  const [filters, setFilters] = useState<PayrollFilterValue>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [approvingPayrollId, setApprovingPayrollId] = useState<string | null>(
    null,
  );
  const [payingPayrollId, setPayingPayrollId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] =
    useState<TeacherPayrollDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(
    null,
  );

  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_LIMIT);
  const [listData, setListData] =
    useState<PayrollListData<TeacherPayrollDto>>(emptyPayrollList);

  const query = useMemo(
    () => ({
      page,
      pageSize,
      teacherId: filters.teacherId,
      month: filters.month,
      status: filters.status,
    }),
    [filters.month, filters.status, filters.teacherId, pageSize, page],
  );

  const loadPayrolls = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await payrollApi.list(query);
      setListData(result);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load payrolls";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadPayrolls();
  }, [loadPayrolls]);

  const refresh = useCallback(async () => {
    await loadPayrolls();
  }, [loadPayrolls]);

  const handleCalculate = useCallback(
    async (payload: { teacherId: string; month: string }) => {
      if (isCalculating) {
        return;
      }

      try {
        setIsCalculating(true);
        await payrollApi.calculate(payload);
        snackbar.showSuccess("Payroll calculated successfully");
        setShowCalculateDialog(false);
        await refresh();
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Failed to calculate payroll";
        snackbar.showError(message);
      } finally {
        setIsCalculating(false);
      }
    },
    [isCalculating, refresh, snackbar],
  );

  const requestApprove = useCallback((id: string) => {
    setConfirmAction({
      id,
      type: "approve",
      title: "Approve Payroll",
      message:
        "After approval this payroll is locked for editing. Do you want to continue?",
    });
  }, []);

  const requestMarkPaid = useCallback((id: string) => {
    setConfirmAction({
      id,
      type: "pay",
      title: "Mark Payroll as Paid",
      message: "Only approved payroll can be marked as paid. Continue?",
    });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) {
      return;
    }

    try {
      if (confirmAction.type === "approve") {
        if (approvingPayrollId || payingPayrollId) {
          return;
        }

        setApprovingPayrollId(confirmAction.id);
        await payrollApi.approve(confirmAction.id);
        snackbar.showSuccess("Payroll approved successfully");
      } else {
        if (approvingPayrollId || payingPayrollId) {
          return;
        }

        setPayingPayrollId(confirmAction.id);
        await payrollApi.markPaid(confirmAction.id);
        snackbar.showSuccess("Payroll marked as paid");
      }

      setConfirmAction(null);
      await refresh();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Payroll action failed";
      snackbar.showError(message);
    } finally {
      setApprovingPayrollId(null);
      setPayingPayrollId(null);
    }
  }, [approvingPayrollId, confirmAction, payingPayrollId, refresh, snackbar]);

  const isActionLoading = Boolean(approvingPayrollId || payingPayrollId);

  return (
    <>
      <Card>
        <Box p={2}>
          <PayrollFilter
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(DEFAULT_PAGE);
            }}
            onOpenCalculate={() => setShowCalculateDialog(true)}
          />

          {error && (
            <Typography color="error" mt={2} mb={1}>
              {error}
            </Typography>
          )}

          <Box mt={2}>
            <PayrollTable
              rows={listData.items}
              totalRows={listData.total}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(DEFAULT_PAGE);
              }}
              onView={setSelectedPayroll}
              onApprove={requestApprove}
              onMarkPaid={requestMarkPaid}
              approvingPayrollId={approvingPayrollId}
              payingPayrollId={payingPayrollId}
            />
          </Box>
        </Box>
      </Card>

      <PayrollCalculateDialog
        open={showCalculateDialog}
        isSubmitting={isCalculating}
        onClose={() => setShowCalculateDialog(false)}
        onSubmit={handleCalculate}
      />

      <PayrollDetailDialog
        open={Boolean(selectedPayroll)}
        payroll={selectedPayroll}
        onClose={() => setSelectedPayroll(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? "Confirm"}
        message={confirmAction?.message ?? "Are you sure?"}
        onCancel={() => {
          if (isActionLoading) {
            return;
          }

          setConfirmAction(null);
        }}
        onConfirm={() => {
          void handleConfirmAction();
        }}
        isLoading={isActionLoading}
        confirmLabel={
          confirmAction?.type === "approve" ? "Approve" : "Mark Paid"
        }
        cancelLabel="Cancel"
        confirmColor={confirmAction?.type === "approve" ? "primary" : "success"}
      />
    </>
  );
}
