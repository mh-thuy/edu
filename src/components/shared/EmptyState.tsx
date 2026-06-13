import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps): ReactElement {
  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{ py: 8, color: "text.secondary", textAlign: "center" }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 48 }} />
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description ? <Typography variant="body2">{description}</Typography> : null}
    </Stack>
  );
}
