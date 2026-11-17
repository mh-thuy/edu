export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

export function parsePageParams(params: URLSearchParams): { page: number; pageSize: number } {
  const page = Number(params.get("page") ?? 0);
  const pageSize = Number(params.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  return {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}
