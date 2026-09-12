import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const receipt = await prisma.tuitionReceipt.findUnique({
      where: { id: (await params).id },
      include: {
        payment: {
          include: {
            refunds: { orderBy: { createdAt: "desc" } },
            tuitionFee: {
              include: {
                student: true,
                class: true,
                items: { include: { classSubject: { include: { subject: true } } } },
              },
            },
          },
        },
      },
    });
    return receipt ? apiSuccess(receipt) : apiError("NOT_FOUND", "Không tìm thấy biên lai", 404);
  } catch (error) {
    return handleApiError(error, "Không thể tải biên lai");
  }
}
