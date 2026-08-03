import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export async function generateTuitionReceiptPdf(receiptId: string) {
  const receipt = await prisma.tuitionReceipt.findUnique({ where: { id: receiptId }, include: { payment: { include: { tuitionFee: { include: { student: true, class: true, items: { orderBy: { displayOrder: "asc" } } } } } } } });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT_PATH), { subset: true });
  const page = pdf.addPage([595, 842]);
  const color = rgb(0.12, 0.16, 0.24);
  const draw = (text: string, x: number, y: number, size = 11, bold = false) => { void bold; page.drawText(text, { x, y, size, font, color }); };
  draw("PHIẾU THU HỌC PHÍ", 190, 770, 18, true);
  draw(`Số phiếu: ${receipt.receiptNo}`, 55, 730);
  draw(`Ngày thu: ${receipt.issuedAt.toLocaleDateString("vi-VN")}`, 55, 708);
  draw(`Mã thanh toán: ${receipt.payment.paymentNo}`, 55, 686);
  draw("THÔNG TIN HỌC SINH", 55, 640, 13, true);
  draw(`Mã học sinh: ${receipt.payment.tuitionFee.student.code}`, 75, 615);
  draw(`Họ tên: ${receipt.payment.tuitionFee.student.fullName}`, 75, 593);
  draw(`Lớp: ${receipt.payment.tuitionFee.class.name}`, 75, 571);
  draw("NỘI DUNG THU", 55, 525, 13, true);
  let y = 495;
  for (const item of receipt.payment.tuitionFee.items) { draw(`${item.itemName} x ${item.quantity.toString()}`, 75, y); draw(`${money(Number(item.amount))} VND`, 400, y); y -= 24; }
  page.drawLine({ start: { x: 55, y: y - 5 }, end: { x: 540, y: y - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  draw("TỔNG CỘNG", 75, y - 35, 13, true); draw(`${money(Number(receipt.amount))} VND`, 390, y - 35, 13, true);
  draw(`Phương thức: ${receipt.payment.paymentMethod}`, 75, y - 75);
  draw("Phiếu thu được phát hành từ hệ thống quản lý học phí.", 75, 90, 9);
  return Buffer.from(await pdf.save());
}
