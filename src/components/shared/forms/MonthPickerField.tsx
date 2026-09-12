"use client";

import dayjs from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { TextFieldProps } from "@mui/material";

type MonthPickerTextFieldProps = Pick<
  TextFieldProps,
  | "disabled"
  | "error"
  | "fullWidth"
  | "helperText"
  | "placeholder"
  | "required"
  | "size"
>;

type MonthPickerFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  textFieldProps?: MonthPickerTextFieldProps;
};

/** Dùng chung cho kỳ nhập vào, hiển thị MM/YYYY và trả về YYYY-MM. */
export function MonthPickerField({
  label,
  value,
  onChange,
  textFieldProps,
}: MonthPickerFieldProps) {
  return (
    <DatePicker
      label={label}
      views={["year", "month"]}
      openTo="month"
      format="MM/YYYY"
      value={value ? dayjs(`${value}-01`) : null}
      onChange={(date) =>
        onChange(date?.isValid() ? date.format("YYYY-MM") : "")
      }
      slotProps={{
        textField: {
          ...textFieldProps,
          fullWidth: textFieldProps?.fullWidth ?? true,
          size: textFieldProps?.size ?? "small",
        },
      }}
    />
  );
}
