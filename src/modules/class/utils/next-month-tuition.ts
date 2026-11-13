export type ClassTuitionResult = {
  created: number;
  skipped: number;
  failed?: Array<{ studentCode: string; studentName: string; reason: string }>;
};

export type NextMonthTuitionSummary = {
  created: number;
  skipped: number;
  problems: string[];
};

// Đọc hết các trang; dừng khi trang rỗng hoặc đã đủ total.
export async function loadAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchPage(page);
    all.push(...data.items);
    if (data.items.length === 0 || all.length >= data.total) return all;
  }
}

// Một lớp lỗi không làm dừng các lớp còn lại; lỗi được ghi vào problems.
export async function createTuitionForClasses(
  classes: Array<{ id: string; code: string }>,
  createFees: (classId: string) => Promise<ClassTuitionResult>,
  onProgress?: (done: number, total: number) => void,
): Promise<NextMonthTuitionSummary> {
  const summary: NextMonthTuitionSummary = { created: 0, skipped: 0, problems: [] };
  for (const [index, cls] of classes.entries()) {
    try {
      const result = await createFees(cls.id);
      summary.created += result.created;
      summary.skipped += result.skipped;
      for (const item of result.failed ?? []) {
        summary.problems.push(`${cls.code} · ${item.studentCode} ${item.studentName}: ${item.reason}`);
      }
    } catch (err) {
      summary.problems.push(`${cls.code}: ${err instanceof Error ? err.message : "Lỗi không xác định"}`);
    }
    onProgress?.(index + 1, classes.length);
  }
  return summary;
}
