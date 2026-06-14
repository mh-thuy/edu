"use client";

import { useTranslation } from "react-i18next";
import { Select, MenuItem, FormControl } from "@mui/material";
import type { ReactElement } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";

export function LanguageSwitcher(): ReactElement {
  const { i18n } = useTranslation();

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    const lang = event.target.value;
    void i18n.changeLanguage(lang);
    localStorage.setItem("i18nextLng", lang);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
        aria-label="Language"
      >
        <MenuItem value="en">English</MenuItem>
        <MenuItem value="vi">Tiếng Việt</MenuItem>
      </Select>
    </FormControl>
  );
}
