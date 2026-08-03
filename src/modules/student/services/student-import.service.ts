import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import { generateStudentCode } from "@/modules/student/services/student.service";

type CsvDelimiter = "," | ";" | "\t";

type ParsedStudentRow = {
  rowNo: number;
  fullName: string;
  phone: string | null;
};

export type StudentImportResult = {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ rowNo: number; message: string }>;
};

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
  }
}

function countDelimiter(line: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let quoted = false;

  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count += 1;
  }

  return count;
}

function detectDelimiter(line: string): CsvDelimiter {
  const delimiters: CsvDelimiter[] = [",", ";", "\t"];
  return delimiters.reduce((selected, delimiter) =>
    countDelimiter(line, delimiter) > countDelimiter(line, selected)
      ? delimiter
      : selected,
  ",");
}

function parseCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  const columns: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      columns.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  columns.push(value.trim());
  return columns;
}

function normalizePhone(value: string): string | null {
  const phone = value.replace(/[.\s()-]/g, "");
  return phone || null;
}

function parseStudentCsv(buffer: Buffer): { rows: ParsedStudentRow[]; errors: StudentImportResult["errors"] } {
  const lines = decodeCsv(buffer).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) throw new Error("File CSV không có dữ liệu");

  const delimiter = detectDelimiter(lines[0]!);
  const rows: ParsedStudentRow[] = [];
  const errors: StudentImportResult["errors"] = [];

  lines.forEach((line, index) => {
    const rowNo = index + 1;
    const columns = parseCsvLine(line, delimiter);
    const fullName = `${columns[1] ?? ""} ${columns[2] ?? ""}`.replace(/\s+/g, " ").trim();

    if (!fullName) {
      errors.push({ rowNo, message: "Thiếu họ tên" });
      return;
    }

    rows.push({ rowNo, fullName, phone: normalizePhone(columns[3] ?? "") });
  });

  return { rows, errors };
}

function studentKey(fullName: string, phone: string | null): string {
  return `${fullName.trim().toLocaleLowerCase()}|${phone ?? ""}`;
}

export async function importStudentsCsv(
  buffer: Buffer,
): Promise<StudentImportResult> {
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ConflictError("File CSV không được vượt quá 5 MB");
  }

  const { rows, errors } = parseStudentCsv(buffer);
  const importedRows = await prisma.$transaction(async (tx) => {
    const existingStudents = await tx.student.findMany({
      select: { fullName: true, phone: true },
    });
    const knownStudents = new Set(
      existingStudents.map((student) => studentKey(student.fullName, student.phone)),
    );
    const importedKeys = new Set<string>();
    let imported = 0;

    for (const row of rows) {
      const key = studentKey(row.fullName, row.phone);
      if (knownStudents.has(key) || importedKeys.has(key)) continue;

      const code = await generateStudentCode(tx);
      try {
        await tx.student.create({
          data: {
            code,
            fullName: row.fullName,
            phone: row.phone,
            status: "ACTIVE",
          },
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictError("Mã học viên tự động bị trùng, vui lòng import lại");
        }
        throw error;
      }

      knownStudents.add(key);
      importedKeys.add(key);
      imported += 1;
    }

    return imported;
  });

  return {
    totalRows: rows.length + errors.length,
    importedRows,
    skippedRows: rows.length - importedRows,
    errors,
  };
}
