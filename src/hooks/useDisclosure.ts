"use client";

import { useCallback, useState } from "react";

type UseDisclosureReturn = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
};

export function useDisclosure(initialState = false): UseDisclosureReturn {
  const [open, setOpen] = useState<boolean>(initialState);

  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((prev) => !prev), []);

  return {
    open,
    onOpen,
    onClose,
    onToggle,
  };
}
