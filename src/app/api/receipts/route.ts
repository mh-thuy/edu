import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ReceiptStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;

    const params = new URL(request.url).searchParams;
    const page = Math.max(Number(params.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize") || 20), 1), 100);
    const search = params.get("search")?.trim();
    const status = params.get("status") as ReceiptStatus | null;
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const issuedAt: { gte?: Date; lt?: Date } = {};
    if (dateFrom && !Number.isNaN(Date.parse(dateFrom))) issuedAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo && !Number.isNaN(Date.parse(dateTo))) {
      const nextDay = new Date(`${dateTo}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      issuedAt.lt = nextDay;
    }
    const where = {
      ...(status ? { status } : {}),
      ...(Object.keys(issuedAt).length ? { issuedAt } : {}),
      ...(search ? {
        OR: [
          { receiptNo: { contains: search, mode: "insensitive" as const } },
          { payment: { paymentNo: { contains: search, mode: "insensitive" as const } } },
          { payment: { tuitionFee: { feeNo: { contains: search, mode: "insensitive" as const } } } },
          { payment: { tuitionFee: { student: { code: { contains: search, mode: "insensitive" as const } } } } },
          { payment: { tuitionFee: { student: { fullName: { contains: search, mode: "insensitive" as const } } } } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tuitionReceipt.findMany({
        where,
        select: {
          id: true,
          receiptNo: true,
          issuedAt: true,
          amount: true,
          status: true,
          payment: {
            select: {
              paymentNo: true,
              paymentMethod: true,
              tuitionFee: {
                select: {
                  feeNo: true,
                  student: { select: { code: true, fullName: true } },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tuitionReceipt.count({ where }),
    ]);
    return apiSuccess({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (error) {
    return handleApiError(error, "Không thể tải biên lai");
  }
}
