import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export async function generatePaymentBatchReceiptPdf(receiptId: string) {
  const receipt = await prisma.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    include: {
      paymentBatch: {
        include: {
          student: true,
          allocations: { include: { tuitionFee: { include: { class: true } } } },
        },
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai tổng");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT_PATH), { subset: true });
  const page = pdf.addPage([595, 842]);
  const color = rgb(0.12, 0.16, 0.24);
  const draw = (text: string, x: number, y: number, size = 11) => page.drawText(text, { x, y, size, font, color });

  draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 770, 17);
  draw(`Số biên lai: ${receipt.receiptNo}`, 55, 730);
  draw(`Mã thanh toán: ${receipt.paymentBatch.batchNo}`, 55, 708);
  draw(`Ngày thu: ${receipt.issuedAt.toLocaleDateString("vi-VN")}`, 55, 686);
  draw("THÔNG TIN HỌC SINH", 55, 640, 13);
  draw(`Mã học sinh: ${receipt.paymentBatch.student.code}`, 75, 615);
  draw(`Họ tên: ${receipt.paymentBatch.student.fullName}`, 75, 593);
  draw("CÁC KHOẢN ĐÃ THANH TOÁN", 55, 545, 13);

  let y = 515;
  for (const allocation of receipt.paymentBatch.allocations) {
    draw(`${allocation.tuitionFee.feeNo} — ${allocation.tuitionFee.class?.name || "Chưa có lớp"}`, 75, y);
    draw(`${money(Number(allocation.amount))} VND`, 390, y);
    y -= 24;
  }
  page.drawLine({ start: { x: 55, y: y - 5 }, end: { x: 540, y: y - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  draw("TỔNG CỘNG", 75, y - 35, 13);
  draw(`${money(Number(receipt.amount))} VND`, 390, y - 35, 13);
  draw(`Phương thức: ${receipt.paymentBatch.paymentMethod}`, 75, y - 75);
  if (receipt.paymentBatch.transactionReference) draw(`Mã giao dịch: ${receipt.paymentBatch.transactionReference}`, 75, y - 97);
  draw("Biên lai tổng hợp được phát hành từ hệ thống quản lý học phí.", 75, 90, 9);
  return { pdf: Buffer.from(await pdf.save()), batchNo: receipt.paymentBatch.batchNo };
}
