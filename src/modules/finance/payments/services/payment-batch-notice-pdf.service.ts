import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { PaymentBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";
import {
  getPaymentBatchNoticeSnapshot,
  parseDocumentSnapshot,
} from "./payment-document-snapshot";

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export async function generatePaymentBatchNoticePdf(
  batchId: string,
  exportedByName: string,
  exportedById: string,
) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
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
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING) {
    throw new ConflictError(
      "Chỉ có thể xuất thông báo cho đợt thanh toán đang chờ đối soát",
    );
  }

  if (batch.paymentMethod !== "BANK_TRANSFER" || !batch.bankAccountId) {
    throw new ConflictError(
      "Chỉ có thể xuất thông báo chuyển khoản cho đợt thanh toán đã gắn tài khoản ngân hàng",
    );
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: batch.bankAccountId, isActive: true },
  });
  if (!account) {
    throw new ConflictError(
      "Tài khoản ngân hàng của đợt thanh toán không còn hoạt động hoặc không tồn tại",
    );
  }
  const snapshot = parseDocumentSnapshot(await getPaymentBatchNoticeSnapshot(batch.id));
  const student = snapshot?.student ?? batch.student;
  const fees = snapshot?.fees ?? batch.allocations.map((allocation) => ({
    feeNo: allocation.tuitionFee.feeNo,
    className: allocation.tuitionFee.class?.name ?? null,
    finalAmount: allocation.amount.toString(),
    items: allocation.tuitionFee.items.map((item) => ({
      itemName: item.itemName,
      subjectName: item.classSubject?.subject.name ?? null,
      amount: item.amount.toString(),
    })),
    discountAmount: allocation.tuitionFee.discountAmount.toString(),
    additionalAmount: allocation.tuitionFee.additionalAmount.toString(),
  }));
  const qrUrl = buildVietQrUrl({
    bankCode: account.bankCode,
    accountNo: account.accountNo,
    accountName: account.accountName,
    amount: Number(batch.totalAmount),
    addInfo: `PB ${batch.batchNo}`,
  });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT_PATH), { subset: true });
  const exportedAt = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  let page = pdf.addPage([595, 842]);
  const color = rgb(0.12, 0.16, 0.24);
  const muted = rgb(0.38, 0.42, 0.48);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    textColor = color,
  ) => page.drawText(text, { x, y, size, font, color: textColor });
  const drawFooter = () => {
    draw(`Ngày xuất: ${exportedAt}`, 55, 45, 9, muted);
    draw(`Nhân viên xuất: ${exportedByName}`, 350, 45, 9, muted);
  };

  draw("THÔNG BÁO THANH TOÁN HỌC PHÍ", 133, 770, 17);
  draw("Chưa xác nhận thanh toán", 220, 747, 10, muted);
  draw(`Mã đợt thanh toán: ${batch.batchNo}`, 55, 708);
  draw(
    `Ngày tạo: ${batch.createdAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    55,
    686,
  );
  draw("THÔNG TIN HỌC SINH", 55, 640, 13);
  draw(`Mã học sinh: ${student.code}`, 75, 615);
  draw(`Họ tên: ${student.fullName}`, 75, 593);
  draw("CÁC KHOẢN THANH TOÁN", 55, 545, 13);

  let y = 515;
  for (const allocation of fees) {
    if (y < 260) {
      drawFooter();
      page = pdf.addPage([595, 842]);
      draw("THÔNG BÁO THANH TOÁN HỌC PHÍ", 133, 790, 15);
      draw("CÁC KHOẢN THANH TOÁN (tiếp theo)", 55, 755, 13);
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
        drawFooter();
        page = pdf.addPage([595, 842]);
        draw("THÔNG BÁO THANH TOÁN HỌC PHÍ", 133, 790, 15);
        draw("CÁC KHOẢN THANH TOÁN (tiếp theo)", 55, 755, 13);
        itemY = 725;
      }
      const subjectName = item.subjectName || item.itemName;
      draw(`- ${subjectName}`, 90, itemY, 9, muted);
      draw(`${money(Number(item.amount))} VND`, 390, itemY, 9, muted);
      itemY -= 17;
    }
    if (Number(allocation.discountAmount) > 0) {
      draw("- Giảm giá", 90, itemY, 9, muted);
      draw(`-${money(Number(allocation.discountAmount))} VND`, 390, itemY, 9, muted);
      itemY -= 17;
    }
    if (Number(allocation.additionalAmount) > 0) {
      draw("- Phụ thu", 90, itemY, 9, muted);
      draw(`${money(Number(allocation.additionalAmount))} VND`, 390, itemY, 9, muted);
      itemY -= 17;
    }
    y = itemY - 10;
  }
  page.drawLine({
    start: { x: 55, y: y - 5 },
    end: { x: 540, y: y - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  draw("TỔNG CẦN THANH TOÁN", 75, y - 35, 13);
  draw(`${money(Number(batch.totalAmount))} VND`, 390, y - 35, 13);
  draw(
    `Phương thức: ${batch.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản / VietQR" : batch.paymentMethod}`,
    75,
    y - 75,
  );
  draw(`Nội dung chuyển khoản: ${batch.batchNo}`, 75, y - 97);

  const bankY = Math.max(y - 150, 180);
  draw("THÔNG TIN CHUYỂN KHOẢN", 55, bankY, 13);
  draw(`Ngân hàng: ${account?.bankName || "Chưa cấu hình"}`, 75, bankY - 28);
  draw(`Số tài khoản: ${account?.accountNo || "-"}`, 75, bankY - 50);
  draw(`Chủ tài khoản: ${account?.accountName || "-"}`, 75, bankY - 72);
  if (qrUrl) {
    const qrResponse = await fetch(qrUrl);
    if (qrResponse.ok) {
      const qr = await pdf.embedPng(
        Buffer.from(await qrResponse.arrayBuffer()),
      );
      page.drawImage(qr, { x: 395, y: bankY - 155, width: 125, height: 125 });
    }
  }
  drawFooter();
  draw(
    "Vui lòng ghi đúng mã đợt thanh toán khi chuyển khoản.",
    75,
    90,
    9,
    muted,
  );
  const pdfBuffer = Buffer.from(await pdf.save());
  await prisma.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: batch.id,
      action: "NOTICE_PRINTED",
      dataAfter: { batchNo: batch.batchNo, snapshotUsed: Boolean(snapshot) },
      performedBy: exportedById,
    },
  });
  return { pdf: pdfBuffer, batchNo: batch.batchNo };
}
