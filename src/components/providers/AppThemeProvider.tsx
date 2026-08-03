"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1565c0",
    },
    secondary: {
      main: "#2e7d32",
    },
    background: {
      default: "#f5f7fb",
      paper: "#ffffff",
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
        },
      },
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
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f8fafc",
          color: "#475569",
          fontWeight: 700,
          whiteSpace: "nowrap",
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
