"use client";

import { useEffect, useRef, useState } from "react";

type Options<Q> = {
  basePath: string;
  current: Q;
  parse: (params: URLSearchParams) => Q;
  serialize: (query: Q) => URLSearchParams;
  restore: (query: Q) => void;
};

// Khôi phục bộ lọc từ URL khi mở trang, rồi giữ URL theo bộ lọc đang áp dụng.
// restored = true sau khi khôi phục xong, để màn hình chỉ tải dữ liệu một lần với trạng thái đúng.
export function useUrlListState<Q>({ basePath, current, parse, serialize, restore }: Options<Q>) {
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    restoreRef.current(parse(new URLSearchParams(window.location.search)));
    setRestored(true);
  }, [parse]);

  const queryString = serialize(current).toString();

  useEffect(() => {
    if (!restored) return;
    window.history.replaceState(null, "", queryString ? `?${queryString}` : window.location.pathname);
  }, [restored, queryString]);

  return { restored, returnPath: queryString ? `${basePath}?${queryString}` : basePath };
}
