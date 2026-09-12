import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  getPaymentBatchReceiptSnapshot,
  parseBatchReceiptSnapshot,
} from "./payment-document-snapshot";

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const A5_PAGE_SIZE: [number, number] = [419.53, 595.28];
const A5_SCALE = A5_PAGE_SIZE[0] / 595;

export async function generatePaymentBatchReceiptPdf(receiptId: string, actorId: string) {
  const receipt = await prisma.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    include: {
      paymentBatch: {
        include: {
          student: true,
          allocations: {
            include: {
              tuitionFee: {
                include: {
                  class: true,
                  items: {
                    include: { classSubject: { include: { subject: true } } },
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai tổng");
  if (receipt.paymentBatch.status !== "SUCCESS") {
    throw new ConflictError("Biên lai tổng đã bị hủy và không thể xuất PDF");
  }
  const snapshot = parseBatchReceiptSnapshot(
    await getPaymentBatchReceiptSnapshot(receipt.id),
  );
  const student = snapshot?.student ?? receipt.paymentBatch.student;
  const fees = snapshot?.fees ?? receipt.paymentBatch.allocations.map((allocation) => ({
    feeNo: allocation.tuitionFee.feeNo,
    finalAmount: allocation.amount.toString(),
    className: allocation.tuitionFee.class?.name ?? null,
    items: allocation.tuitionFee.items.map((item) => ({
      itemName: item.itemName,
      subjectName: item.classSubject?.subject.name ?? null,
      amount: item.amount.toString(),
    })),
    discountAmount: allocation.tuitionFee.discountAmount.toString(),
    additionalAmount: allocation.tuitionFee.additionalAmount.toString(),
  }));

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT_PATH), { subset: true });
  let page = pdf.addPage(A5_PAGE_SIZE);
  const color = rgb(0.12, 0.16, 0.24);
  const draw = (text: string, x: number, y: number, size = 11) =>
    page.drawText(text, {
      x: x * A5_SCALE,
      y: y * A5_SCALE,
      size: size * A5_SCALE,
      font,
      color,
    });

  draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 770, 17);
  draw(`Số biên lai: ${receipt.receiptNo}`, 55, 730);
  draw(`Mã thanh toán: ${receipt.paymentBatch.batchNo}`, 55, 708);
  draw(
    `Ngày thu: ${receipt.issuedAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    55,
    686,
  );
  draw("THÔNG TIN HỌC SINH", 55, 640, 13);
  draw(`Mã học sinh: ${student.code}`, 75, 615);
  draw(`Họ tên: ${student.fullName}`, 75, 593);
  draw("CÁC KHOẢN ĐÃ THANH TOÁN", 55, 545, 13);

  let y = 515;
  for (const allocation of fees) {
    if (y < 260) {
      page = pdf.addPage(A5_PAGE_SIZE);
      draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 790, 15);
      draw("CÁC KHOẢN ĐÃ THANH TOÁN (tiếp theo)", 55, 755, 13);
      y = 725;
    }
    draw(
      `${allocation.feeNo} — ${allocation.className || "Chưa có lớp"}`,
      75,
      y,
    );
    draw(`${money(Number(allocation.finalAmount))} VND`, 390, y);
    let itemY = y - 17;
    for (const item of allocation.items) {
      if (itemY < 220) {
        page = pdf.addPage([595, 842]);
        draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 790, 15);
        draw("CÁC KHOẢN ĐÃ THANH TOÁN (tiếp theo)", 55, 755, 13);
        itemY = 725;
      }
      const subjectName = item.subjectName || item.itemName;
      draw(`- ${subjectName}`, 90, itemY, 9);
      draw(`${money(Number(item.amount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    if (Number(allocation.discountAmount) > 0) {
      draw("- Giảm giá", 90, itemY, 9);
      draw(`-${money(Number(allocation.discountAmount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    if (Number(allocation.additionalAmount) > 0) {
      draw("- Phụ thu", 90, itemY, 9);
      draw(`${money(Number(allocation.additionalAmount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    y = itemY - 10;
  }
  page.drawLine({
    start: { x: 55 * A5_SCALE, y: (y - 5) * A5_SCALE },
    end: { x: 540 * A5_SCALE, y: (y - 5) * A5_SCALE },
    thickness: A5_SCALE,
    color: rgb(0.8, 0.8, 0.8),
  });
  draw("TỔNG CỘNG", 75, y - 35, 13);
  draw(`${money(Number(receipt.amount))} VND`, 390, y - 35, 13);
  draw(`Phương thức: ${receipt.paymentBatch.paymentMethod}`, 75, y - 75);
  if (receipt.paymentBatch.transactionReference)
    draw(
      `Mã giao dịch: ${receipt.paymentBatch.transactionReference}`,
      75,
      y - 97,
    );
  draw(
    "Biên lai tổng hợp được phát hành từ hệ thống quản lý học phí.",
    75,
    90,
    9,
  );
  const pdfBuffer = Buffer.from(await pdf.save());
  await prisma.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: receipt.paymentBatchId,
      action: "RECEIPT_PDF_PRINTED",
      dataAfter: { receiptNo: receipt.receiptNo, snapshotUsed: Boolean(snapshot) },
      performedBy: actorId,
    },
  });
  return {
    pdf: pdfBuffer,
    batchNo: receipt.paymentBatch.batchNo,
  };
}
