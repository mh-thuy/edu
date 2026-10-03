"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const uiTokens = {
  divider: "#dce7eb",
  surface: "#ffffff",
  mutedSurface: "#f1f6f8",
  mutedText: "#60717d",
  subtleShadow: "0 2px 10px rgba(35, 68, 82, 0.035)",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#3188f5",
      light: "#e8f3ff",
      dark: "#2074db",
    },
    secondary: {
      main: "#19aa83",
      light: "#e4f7f1",
      dark: "#128563",
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
    info: {
      main: "#3188f5",
      light: "#e8f3ff",
      dark: "#2074db",
    },
    background: {
      default: "#f1f6f8",
      paper: uiTokens.surface,
    },
    text: {
      primary: "#172b38",
      secondary: "#687d89",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif",
    h1: { fontSize: "2rem", fontWeight: 800, lineHeight: 1.2 },
    h2: { fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.25 },
    h3: { fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.3 },
    h4: { fontSize: "1.25rem", fontWeight: 750, lineHeight: 1.35 },
    h5: { fontSize: "1.125rem", fontWeight: 750, lineHeight: 1.4 },
    h6: { fontSize: "1rem", fontWeight: 700, lineHeight: 1.45 },
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
          minHeight: 40,
          padding: "8px 16px",
        },
        sizeSmall: {
          minHeight: 32,
          padding: "5px 12px",
          fontSize: "0.8125rem",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid",
          borderColor: uiTokens.divider,
          borderRadius: 12,
          boxShadow: uiTokens.subtleShadow,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          "&:last-child": {
            paddingBottom: 24,
          },
          "@media (max-width:600px)": {
            padding: 16,
            "&:last-child": {
              paddingBottom: 16,
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: uiTokens.surface,
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
          border: "1px solid",
          borderColor: uiTokens.divider,
          borderRadius: 12,
          boxShadow: uiTokens.subtleShadow,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: "1px solid",
          borderColor: uiTokens.divider,
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: "22px 24px 12px",
          fontWeight: 800,
          fontSize: "1.125rem",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "14px 24px 22px",
          gap: 8,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: uiTokens.divider,
          padding: "12px 16px",
          verticalAlign: "middle",
        },
        head: {
          backgroundColor: uiTokens.mutedSurface,
          color: uiTokens.mutedText,
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
        root: { width: "100%" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&.MuiTableRow-hover:hover": { backgroundColor: "#f7fafb" } },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          borderTop: "1px solid",
          borderColor: uiTokens.divider,
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
          borderRadius: 12,
          overflow: "hidden",
          "--DataGrid-rowBorderColor": uiTokens.divider,
        },
        ".MuiDataGrid-columnHeaders": {
          backgroundColor: uiTokens.mutedSurface,
          color: uiTokens.mutedText,
          fontWeight: 700,
        },
        ".MuiDataGrid-cell:focus, .MuiDataGrid-cell:focus-within": {
          outline: "none",
        },
        ".MuiDataGrid-columnHeader:focus, .MuiDataGrid-columnHeader:focus-within": {
          outline: "none",
        },
        ".MuiDataGrid-footerContainer": {
          minHeight: 56,
          borderTop: "1px solid",
          borderColor: uiTokens.divider,
        },
        ".MuiDataGrid-row:hover": {
          backgroundColor: "#f7fafb",
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
