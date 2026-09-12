import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ReceiptStatus } from "@prisma/client";
import { getVietnamDayEndExclusive, parseVietnamDateStart } from "@/lib/vietnam-time";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const params = new URL(request.url).searchParams;
    const page = Math.max(Number(params.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize") || 20), 1), 100);
    const search = params.get("search")?.trim();
    const rawStatus = params.get("status");
    const status = rawStatus && Object.values(ReceiptStatus).includes(rawStatus as ReceiptStatus) ? rawStatus as ReceiptStatus : undefined;
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const issuedAt: { gte?: Date; lt?: Date } = {};
    if (dateFrom) {
      const start = parseVietnamDateStart(dateFrom);
      if (!start) return apiError("VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ", 400);
      issuedAt.gte = start;
    }
    if (dateTo) {
      const end = getVietnamDayEndExclusive(dateTo);
      if (!end) return apiError("VALIDATION_ERROR", "Ngày kết thúc không hợp lệ", 400);
      issuedAt.lt = end;
    }
    if (issuedAt.gte && issuedAt.lt && issuedAt.gte >= issuedAt.lt) {
      return apiError("VALIDATION_ERROR", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", 400);
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
                  items: {
                    select: {
                      itemName: true,
                      classSubject: {
                        select: { subject: { select: { name: true } } },
                      },
                    },
                  },
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
    return apiSuccess({
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể tải biên lai");
  }
}
