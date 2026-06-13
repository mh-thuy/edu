import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import { Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { ReactElement } from "react";

export default function ForbiddenPage(): ReactElement {
  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: "100vh", px: 2, textAlign: "center" }}
    >
      <BlockOutlinedIcon color="error" sx={{ fontSize: 54 }} />
      <Typography variant="h4" fontWeight={700}>
        Access Forbidden
      </Typography>
      <Typography color="text.secondary">
        You do not have permission to access this resource.
      </Typography>
      <Button component={Link} href="/" variant="contained">
        Back to Dashboard
      </Button>
    </Stack>
  );
}
