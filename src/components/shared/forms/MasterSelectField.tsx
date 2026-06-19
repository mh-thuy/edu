"use client";

import {
  Box,
  Button,
  FormHelperText,
  Paper,
  Stack,
  Typography,
  SxProps,
  Theme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import type { ReactElement } from "react";

export type MasterSelectValue = {
  id: string;
  code: string;
  name: string;
};

export type MasterSelectFieldProps = {
  label: string;
  value?: MasterSelectValue | null;
  onOpen: () => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  codeLabel?: string;
  nameLabel?: string;
  size?: "small" | "medium"; // Thêm prop size
  sx?: SxProps<Theme>; // Thêm prop sx để Grid bên ngoài can thiệp
};

export function MasterSelectField({
  label,
  value,
  onOpen,
  disabled = false,
  error,
  required = false,
  codeLabel = "Mã",
  nameLabel = "Tên",
  size = "medium", // Mặc định nếu không truyền
  sx,
}: MasterSelectFieldProps): ReactElement {
  const hasValue = Boolean(value?.id);
  const isSmall = size === "small";

  return (
    <Box sx={{ ...sx, position: "relative" }}>
      {/* 1. Nếu dùng size="small" để lọc, ta biến Label thành một thẻ nhỏ tinh tế chặn ở góc viền giống chuẩn MUI */}
      <Typography
        component="label"
        variant="caption"
        fontWeight={500}
        color={error ? "error" : "text.secondary"}
        sx={{
          position: "absolute",
          left: 12,
          top: -9,
          bgcolor: "background.paper",
          px: 0.5,
          zIndex: 1,
          lineHeight: 1,
        }}
      >
        {label}
        {required && <span style={{ color: "red", marginLeft: 2 }}>*</span>}
      </Typography>

      {/* 2. Khung hiển thị dữ liệu */}
      <Paper
        variant="outlined"
        sx={{
          px: 1.5,
          // Tính toán padding động: nếu small thì dùng 0.5 (cao chuẩn 40px), medium dùng 1.5
          py: isSmall ? 0.5 : 1.5,
          minHeight: isSmall ? 40 : 56, // Ép cứng chiều cao chuẩn xác từng pixel
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          transition: "border-color 0.2s",
          bgcolor: disabled ? "action.disabledBackground" : "background.paper",
          "&:hover": {
            borderColor: disabled ? undefined : "primary.main",
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} width="100%">
          {/* Nội dung hiển thị */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {hasValue ? (
              <Stack
                direction="row"
                spacing={isSmall ? 1.5 : 3} // Giảm khoảng cách nếu ở chế độ nhỏ
                alignItems="center"
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {codeLabel}:
                  </Typography>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {value!.code}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {nameLabel}:
                  </Typography>
                  <Typography variant="body2" noWrap>
                    {value!.name}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography
                variant="body2"
                color="text.disabled"
                fontStyle="italic"
              >
                Chưa chọn...
              </Typography>
            )}
          </Box>

          {/* Nút bấm Chọn / Đổi */}
          <Button
            size="small"
            variant={hasValue ? "text" : "contained"} // Đổi sang text trên bản small nhìn thanh thoát hơn
            startIcon={hasValue ? <SwapHorizIcon /> : <SearchIcon />}
            onClick={onOpen}
            disabled={disabled}
            sx={{
              flexShrink: 0,
              height: 28, // Nút nhỏ nằm gọn gàng bên trong khung 40px
              boxShadow: "none",
              "&:hover": { boxShadow: "none" },
            }}
          >
            {hasValue ? "Đổi" : "Chọn"}
          </Button>
        </Stack>
      </Paper>

      {/* Thông báo lỗi */}
      {error && (
        <FormHelperText error sx={{ mx: "14px", mt: 0.5 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
