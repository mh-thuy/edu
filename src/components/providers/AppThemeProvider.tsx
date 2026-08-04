"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb",
      light: "#dbeafe",
      dark: "#1d4ed8",
    },
    secondary: {
      main: "#0f766e",
      light: "#ccfbf1",
      dark: "#115e59",
    },
    success: {
      main: "#16a34a",
      light: "#dcfce7",
    },
    warning: {
      main: "#d97706",
      light: "#fef3c7",
    },
    error: {
      main: "#dc2626",
      light: "#fee2e2",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#64748b",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          minHeight: 38,
          padding: "8px 14px",
        },
        sizeSmall: {
          minHeight: 32,
          padding: "5px 10px",
          fontSize: "0.8125rem",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#ffffff",
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiFormControl: {
      defaultProps: { size: "small" },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: "#e2e8f0",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#e2e8f0",
          padding: "12px 16px",
        },
        head: {
          backgroundColor: "#f8fafc",
          color: "#475569",
          fontWeight: 700,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          minWidth: 720,
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          borderTop: "1px solid #e2e8f0",
        },
        toolbar: {
          minHeight: 52,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ".MuiDataGrid-root": {
          border: 0,
        },
        ".MuiDataGrid-columnHeaders": {
          backgroundColor: "#f8fafc",
          color: "#475569",
          fontWeight: 700,
        },
        ".MuiDataGrid-cell:focus, .MuiDataGrid-cell:focus-within": {
          outline: "none",
        },
      },
    },
  },
});

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps): ReactNode {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
