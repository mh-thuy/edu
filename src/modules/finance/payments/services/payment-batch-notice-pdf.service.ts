import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PaymentBatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { getPdfFontBytes } from "@/lib/pdf-font";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";
import {
  getPaymentBatchNoticeSnapshot,
  parseDocumentSnapshot,
  savePaymentBatchNoticeSnapshot,
  toFeeSnapshot,
  type DocumentSnapshot,
} from "./payment-document-snapshot";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatVietnamDateTime = (value: Date) => {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

export async function generatePaymentBatchNoticePdf(
  batchId: string,
  exportedByName: string,
  exportedById: string,
  auditContext?: AuditContext,
) {
  const data = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    return loadPaymentBatchNoticeData(tx, batchId);
  });

  const pdf = await renderPaymentBatchNoticePdf(data, exportedByName);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const current = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    });
    if (!current) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (current.status !== PaymentBatchStatus.PENDING) {
      throw new ConflictError(
        "Chỉ có thể xuất thông báo cho đợt thanh toán đang chờ đối soát",
      );
    }
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "NOTICE_PRINTED",
        dataAfter: {
          batchNo: data.batch.batchNo,
          snapshotUsed: Boolean(data.snapshot),
          bankAccountSnapshotUsed: Boolean(data.snapshot?.bankAccount),
        },
        performedBy: exportedById,
        ...auditFields(auditContext),
      },
    });
  });

  return { pdf, batchNo: data.batch.batchNo };
}

export async function generatePaymentBatchNoticesPdf(
  batchIds: string[],
  exportedByName: string,
  exportedById: string,
  auditContext?: AuditContext,
) {
  const uniqueIds = [...new Set(batchIds)];
  if (uniqueIds.length !== batchIds.length) {
    throw new ConflictError("Danh sách đợt thu bị trùng");
  }

  const notices = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`
      SELECT id FROM payment_batches
      WHERE id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE
    `);
      const batches = await tx.paymentBatch.findMany({
        where: { id: { in: uniqueIds } },
        include: {
          student: true,
          bankAccount: true,
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
      if (batches.length !== uniqueIds.length) {
        throw new NotFoundError("Không tìm thấy đầy đủ các đợt thu đã chọn");
      }
      if (
        batches.some(
          (batch) =>
            batch.status !== PaymentBatchStatus.PENDING ||
            batch.paymentMethod !== "BANK_TRANSFER" ||
            !batch.bankAccountId ||
            !batch.bankAccount,
        )
      ) {
        throw new ConflictError(
          "Chỉ có thể gộp PDF của các đợt chuyển khoản đang chờ",
        );
      }
      if (new Set(batches.map((batch) => batch.bankAccountId)).size !== 1) {
        throw new ConflictError(
          "Các đợt thu phải dùng cùng một tài khoản nhận tiền để gộp PDF",
        );
      }

      const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
      const prepared = uniqueIds.map((id) => {
        const batch = batchesById.get(id)!;
        const accountRecord = batch.bankAccount!;
        const parsedSnapshot = parseDocumentSnapshot(batch.noticeSnapshot);
        const student = parsedSnapshot?.student ?? batch.student;
        const snapshot: DocumentSnapshot = parsedSnapshot ?? {
          version: 1,
          student: { code: student.code, fullName: student.fullName },
          fees: batch.allocations.map((allocation) =>
            toFeeSnapshot(allocation.tuitionFee, allocation.amount),
          ),
          bankAccount: {
            bankCode: accountRecord.bankCode,
            bankName: accountRecord.bankName,
            accountNo: accountRecord.accountNo,
            accountName: accountRecord.accountName,
          },
        };
        return {
          data: {
            batch,
            accountRecord,
            account: snapshot.bankAccount ?? accountRecord,
            student,
            fees: snapshot.fees,
            snapshot,
          },
          snapshotWasMissing: !parsedSnapshot,
        };
      });
      const snapshotsToSave = prepared.filter(
        (item) => item.snapshotWasMissing,
      );
      if (snapshotsToSave.length) {
        await tx.$executeRaw(Prisma.sql`
        UPDATE payment_batches AS batch
        SET notice_snapshot = payload.snapshot
        FROM (VALUES ${Prisma.join(
          snapshotsToSave.map(
            ({ data }) =>
              Prisma.sql`(${data.batch.id}::uuid, ${JSON.stringify(data.snapshot)}::jsonb)`,
          ),
        )}) AS payload(id, snapshot)
        WHERE batch.id = payload.id
      `);
      }
      return prepared.map((item) => item.data);
    },
    { timeout: 60_000 },
  );

  const combinedPdf = await PDFDocument.create();
  const noticeMetadata: Array<{
    batchId: string;
    batchNo: string;
    snapshotUsed: boolean;
    bankAccountSnapshotUsed: boolean;
  }> = [];
  const qrImages = new Map<string, Buffer | null>();
  for (let offset = 0; offset < notices.length; offset += 8) {
    const group = notices.slice(offset, offset + 8);
    await Promise.all(group.map(async (noticeData) => {
      qrImages.set(
        noticeData.batch.id,
        await fetchNoticeQrPng(noticeData),
      );
    }));
  }
  for (const noticeData of notices) {
    const notice = await renderPaymentBatchNoticePdf(
      noticeData,
      exportedByName,
      qrImages.get(noticeData.batch.id) ?? null,
    );
    const sourcePdf = await PDFDocument.load(notice);
    const pages = await combinedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices(),
    );
    for (const page of pages) combinedPdf.addPage(page);
    noticeMetadata.push({
      batchId: noticeData.batch.id,
      batchNo: noticeData.batch.batchNo,
      snapshotUsed: Boolean(noticeData.snapshot),
      bankAccountSnapshotUsed: Boolean(noticeData.snapshot.bankAccount),
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      SELECT id FROM payment_batches
      WHERE id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE
    `);
    const currentBatches = await tx.paymentBatch.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    });
    if (currentBatches.length !== uniqueIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thu đã chọn");
    }
    if (
      currentBatches.some(
        (batch) => batch.status !== PaymentBatchStatus.PENDING,
      )
    ) {
      throw new ConflictError("Chỉ có thể xuất PDF của các đợt đang chờ");
    }
    await tx.tuitionAuditLog.createMany({
      data: noticeMetadata.map((notice) => ({
        entityType: "PAYMENT_BATCH",
        entityId: notice.batchId,
        action: "NOTICE_PRINTED",
        dataAfter: {
          batchNo: notice.batchNo,
          snapshotUsed: notice.snapshotUsed,
          bankAccountSnapshotUsed: notice.bankAccountSnapshotUsed,
        },
        performedBy: exportedById,
        ...auditFields(auditContext),
      })),
    });
  });

  return Buffer.from(await combinedPdf.save());
}

async function loadPaymentBatchNoticeData(
  client: Prisma.TransactionClient,
  batchId: string,
) {
  const batch = await client.paymentBatch.findUnique({
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

  const accountRecord = await client.bankAccount.findUnique({
    where: { id: batch.bankAccountId },
  });
  if (!accountRecord) {
    throw new ConflictError(
      "Tài khoản ngân hàng của đợt thanh toán không còn tồn tại",
    );
  }
  const parsedSnapshot = parseDocumentSnapshot(
    await getPaymentBatchNoticeSnapshot(batch.id, client),
  );
  const student = parsedSnapshot?.student ?? batch.student;
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    student: { code: student.code, fullName: student.fullName },
    fees: batch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    bankAccount: {
      bankCode: accountRecord.bankCode,
      bankName: accountRecord.bankName,
      accountNo: accountRecord.accountNo,
      accountName: accountRecord.accountName,
    },
  };
  if (!parsedSnapshot) {
    await savePaymentBatchNoticeSnapshot(client, batch.id, snapshot);
  }
  const account = snapshot.bankAccount ?? accountRecord;
  const fees = snapshot.fees;

  return { batch, accountRecord, account, student, fees, snapshot };
}

async function renderPaymentBatchNoticePdf(
  data: Awaited<ReturnType<typeof loadPaymentBatchNoticeData>>,
  exportedByName: string,
  prefetchedQr?: Buffer | null,
) {
  const { batch, accountRecord, account, student, fees } = data;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getPdfFontBytes(), { subset: true });
  const exportedAt = formatVietnamDateTime(new Date());
  let page = pdf.addPage([595, 842]);
  const ink = rgb(0.12, 0.18, 0.27);
  const navy = rgb(0.1, 0.19, 0.3);
  const muted = rgb(0.39, 0.45, 0.52);
  const red = rgb(0.76, 0.12, 0.19);
  const paleBlue = rgb(0.95, 0.97, 0.99);
  const paleRed = rgb(1, 0.95, 0.95);
  const border = rgb(0.84, 0.88, 0.92);
  const white = rgb(1, 1, 1);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    textColor = ink,
  ) => page.drawText(text, { x, y, size, font, color: textColor });
  const drawFit = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    textColor = ink,
    minSize = 8,
  ) => {
    let fittedSize = size;
    while (
      fittedSize > minSize &&
      font.widthOfTextAtSize(text, fittedSize) > maxWidth
    ) {
      fittedSize = Math.max(minSize, fittedSize - 0.5);
    }
    draw(text, x, y, fittedSize, textColor);
  };
  const drawRightFit = (
    text: string,
    rightX: number,
    y: number,
    maxWidth: number,
    size: number,
    textColor = ink,
    minSize = 8,
  ) => {
    let fittedSize = size;
    while (
      fittedSize > minSize &&
      font.widthOfTextAtSize(text, fittedSize) > maxWidth
    ) {
      fittedSize = Math.max(minSize, fittedSize - 0.5);
    }
    const textWidth = font.widthOfTextAtSize(text, fittedSize);
    draw(text, rightX - Math.min(textWidth, maxWidth), y, fittedSize, textColor);
  };
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: navy });
    draw("TRUNG TÂM ĐÀO TẠO", 48, 816, 8, white);
    draw("THÔNG BÁO THANH TOÁN HỌC PHÍ", 48, 785, 15, white);
    page.drawRectangle({ x: 405, y: 783, width: 142, height: 25, color: red });
    const status = "CHỜ THANH TOÁN";
    const statusWidth = font.widthOfTextAtSize(status, 8);
    draw(status, 405 + (142 - statusWidth) / 2, 791, 8, white);
    page.drawRectangle({ x: 48, y: 756, width: 499, height: 2, color: red });
  };
  const drawContinuationPage = () => {
    page = pdf.addPage([595, 842]);
    drawHeader();
    drawFit(`Mã đợt thanh toán: ${batch.batchNo}`, 48, 724, 499, 10, muted);
    draw("CÁC KHOẢN THANH TOÁN (TIẾP THEO)", 48, 692, 12, navy);
    page.drawLine({
      start: { x: 48, y: 680 },
      end: { x: 547, y: 680 },
      thickness: 1,
      color: border,
    });
    y = 650;
  };

  drawHeader();
  page.drawRectangle({ x: 48, y: 670, width: 499, height: 72, color: paleBlue });
  page.drawRectangle({ x: 48, y: 670, width: 4, height: 72, color: red });
  draw("HỌC VIÊN", 64, 722, 8, muted);
  drawFit(student.fullName, 64, 694, 320, 17, red, 10);
  drawFit(`Mã học viên: ${student.code}`, 64, 677, 300, 9, ink);
  draw("MÃ ĐỢT", 407, 719, 8, muted);
  drawRightFit(batch.batchNo, 531, 699, 124, 10, navy, 8);
  drawFit(`Tạo lúc: ${formatVietnamDateTime(batch.createdAt)}`, 385, 680, 146, 8, muted, 7);
  draw("CÁC KHOẢN THANH TOÁN", 48, 635, 12, navy);
  page.drawLine({
    start: { x: 48, y: 623 },
    end: { x: 547, y: 623 },
    thickness: 1,
    color: border,
  });

  let y = 599;
  const minimumFeeY = 450;
  const ensureFeeSpace = (needed: number) => {
    if (y - needed < minimumFeeY) drawContinuationPage();
  };
  for (const allocation of fees) {
    ensureFeeSpace(28);
    page.drawRectangle({ x: 48, y: y - 7, width: 499, height: 22, color: paleBlue });
    drawFit(
      `${allocation.feeNo} — ${allocation.className || "Chưa có lớp"}`,
      61,
      y,
      340,
      9.5,
      navy,
      8,
    );
    drawRightFit(
      `${money(Number(allocation.payableAmount))} VND`,
      532,
      y,
      125,
      9.5,
      navy,
    );
    y -= 25;
    for (const item of allocation.items) {
      ensureFeeSpace(18);
      const subjectName = item.subjectName || item.itemName;
      drawFit(`– ${subjectName}`, 70, y, 335, 8.5, muted, 7.5);
      drawRightFit(`${money(Number(item.amount))} VND`, 532, y, 125, 8.5, muted);
      y -= 17;
    }
    if (Number(allocation.discountAmount) > 0) {
      ensureFeeSpace(18);
      draw("– Giảm giá", 70, y, 8.5, muted);
      drawRightFit(`-${money(Number(allocation.discountAmount))} VND`, 532, y, 125, 8.5, muted);
      y -= 17;
    }
    if (Number(allocation.additionalAmount) > 0) {
      ensureFeeSpace(18);
      draw("– Phụ thu", 70, y, 8.5, muted);
      drawRightFit(`${money(Number(allocation.additionalAmount))} VND`, 532, y, 125, 8.5, muted);
      y -= 17;
    }
    y -= 5;
  }
  if (y < 450) {
    drawContinuationPage();
  }

  page.drawRectangle({ x: 48, y: 340, width: 499, height: 80, color: paleRed });
  page.drawRectangle({ x: 48, y: 340, width: 5, height: 80, color: red });
  draw("TỔNG CẦN THANH TOÁN", 65, 397, 9, muted);
  drawRightFit(
    `${money(Number(batch.totalAmount))} VND`,
    530,
    389,
    250,
    18,
    red,
    13,
  );
  draw(
    `Phương thức: ${batch.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản / VietQR" : batch.paymentMethod}`,
    65,
    368,
    8.5,
    ink,
  );
  drawFit(`Nội dung chuyển khoản: ${batch.batchNo}`, 65, 352, 450, 8.5, ink);

  page.drawRectangle({
    x: 48,
    y: 80,
    width: 499,
    height: 255,
    color: white,
    borderColor: border,
    borderWidth: 1,
  });
  page.drawRectangle({ x: 48, y: 305, width: 250, height: 30, color: navy });
  draw("THÔNG TIN CHUYỂN KHOẢN", 64, 315, 10, white);
  drawFit(`Ngân hàng: ${account?.bankName || "Chưa cấu hình"}`, 64, 266, 220, 9, ink);
  drawFit(`Số tài khoản: ${account?.accountNo || "-"}`, 64, 242, 220, 9, ink);
  draw("CHỦ TÀI KHOẢN", 64, 213, 8, muted);
  drawFit(account?.accountName || "-", 64, 185, 220, 17, red, 10);

  if (!accountRecord.isActive) {
    drawFit(
      "Tài khoản đã ngừng hoạt động. Vui lòng liên hệ trung tâm trước khi chuyển khoản.",
      64,
      148,
      220,
      8.5,
      red,
      7.5,
    );
  }

  const qrPng = prefetchedQr === undefined
    ? await fetchNoticeQrPng(data)
    : prefetchedQr;
  if (qrPng) {
    const qr = await pdf.embedPng(qrPng);
    draw("QUÉT MÃ QR ĐỂ CHUYỂN KHOẢN", 298, 317, 7.5, muted);
    page.drawRectangle({
      x: 298,
      y: 82,
      width: 242,
      height: 242,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });
    page.drawImage(qr, { x: 304, y: 88, width: 230, height: 230 });
  } else if (accountRecord.isActive) {
    drawFit("Mã QR hiện chưa khả dụng.", 298, 200, 242, 8.5, muted);
  }

  const pages = pdf.getPages();
  pages.forEach((footerPage, index) => {
    footerPage.drawLine({
      start: { x: 48, y: 58 },
      end: { x: 547, y: 58 },
      thickness: 1,
      color: border,
    });
    const dateText = `Ngày xuất: ${exportedAt}`;
    const employeeText = `Nhân viên: ${exportedByName}`;
    footerPage.drawText(dateText, {
      x: 48,
      y: 40,
      size: 7.5,
      font,
      color: muted,
    });
    const employeeSize = Math.min(
      7.5,
      270 / Math.max(font.widthOfTextAtSize(employeeText, 7.5), 1) * 7.5,
    );
    footerPage.drawText(employeeText, {
      x: 255,
      y: 40,
      size: employeeSize,
      font,
      color: muted,
    });
    const pageText = `Trang ${index + 1}/${pages.length}`;
    footerPage.drawText(pageText, {
      x: 500,
      y: 40,
      size: 7.5,
      font,
      color: muted,
    });
  });

  const pdfBuffer = Buffer.from(await pdf.save());
  return pdfBuffer;
}

async function fetchNoticeQrPng(
  data: Awaited<ReturnType<typeof loadPaymentBatchNoticeData>>,
) {
  const { batch, accountRecord, account } = data;
  if (!accountRecord.isActive) return null;
  const qrUrl = buildVietQrUrl({
    bankCode: account.bankCode,
    accountNo: account.accountNo,
    accountName: account.accountName,
    amount: Number(batch.totalAmount),
    addInfo: `PB ${batch.batchNo}`,
  });
  const response = await fetch(qrUrl, { signal: AbortSignal.timeout(10_000) });
  return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
}
