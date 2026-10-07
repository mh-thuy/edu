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
    await Promise.all(
      group.map(async (noticeData) => {
        qrImages.set(noticeData.batch.id, await fetchNoticeQrPng(noticeData));
      }),
    );
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
  let page = pdf.addPage([595, 420]);
  const ink = rgb(0.12, 0.18, 0.27);
  const navy = rgb(0.1, 0.19, 0.3);
  const muted = rgb(0.39, 0.45, 0.52);
  const red = rgb(0.76, 0.12, 0.19);
  const cream = rgb(0.99, 0.98, 0.94);
  const paleGold = rgb(0.98, 0.95, 0.87);
  const gold = rgb(0.78, 0.58, 0.29);
  const paleBlue = rgb(0.96, 0.97, 0.98);
  const paleRed = rgb(1, 0.95, 0.94);
  const border = rgb(0.84, 0.75, 0.58);
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
    draw(
      text,
      rightX - Math.min(textWidth, maxWidth),
      y,
      fittedSize,
      textColor,
    );
  };
  const drawCentered = (
    text: string,
    centerX: number,
    y: number,
    size: number,
    color = ink,
  ) => {
    draw(
      text,
      centerX - font.widthOfTextAtSize(text, size) / 2,
      y,
      size,
      color,
    );
  };
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 420, color: cream });
    draw("TRÍ NHÂN", 28, 394, 12, navy);
    draw("TRUNG TÂM BDVH & LTDH", 28, 381, 6.5, muted);
    drawCentered("THÔNG BÁO THANH TOÁN HỌC PHÍ", 297.5, 394, 14, navy);
    drawCentered(
      "TRUNG TÂM BỒI DƯỠNG VĂN HÓA VÀ LUYỆN THI ĐẠI HỌC TRÍ NHÂN",
      297.5,
      380,
      5.8,
      muted,
    );
    page.drawRectangle({
      x: 450,
      y: 382,
      width: 117,
      height: 20,
      color: paleGold,
      borderColor: gold,
      borderWidth: 0.7,
    });
    const status = "CHỜ THANH TOÁN";
    drawCentered(status, 508.5, 389, 6.8, navy);
    page.drawLine({
      start: { x: 28, y: 367 },
      end: { x: 567, y: 367 },
      thickness: 1,
      color: gold,
    });
  };
  const drawCard = (
    x: number,
    y: number,
    width: number,
    height: number,
    title?: string,
  ) => {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: white,
      borderColor: gold,
      borderWidth: 0.9,
    });
    if (title) {
      page.drawRectangle({
        x,
        y: y + height - 23,
        width,
        height: 23,
        color: navy,
      });
      drawCentered(title, x + width / 2, y + height - 16, 8.5, white);
    }
  };

  const leftX = 28;
  const leftWidth = 260;
  const rightX = 307;
  const rightWidth = 260;
  const cardBottom = 32;
  const cardTop = 350;
  const drawFirstPageCards = () => {
    drawCard(
      leftX,
      cardBottom,
      leftWidth,
      cardTop - cardBottom,
      "THÔNG TIN HỌC VIÊN & HỌC PHÍ",
    );
    drawCard(rightX, cardBottom, rightWidth, cardTop - cardBottom);
    drawFit(student.fullName, 45, 303, 228, 16, red, 11);
    drawFit(`Mã học viên: ${student.code}`, 45, 286, 228, 7.5, muted, 6.5);
    drawFit(
      `Tạo lúc: ${formatVietnamDateTime(batch.createdAt)}`,
      45,
      273,
      220,
      6.5,
      muted,
      6,
    );
    draw("CÁC KHOẢN THANH TOÁN", 45, 250, 8.5, navy);
    page.drawLine({
      start: { x: 45, y: 243 },
      end: { x: 274, y: 243 },
      thickness: 0.7,
      color: border,
    });
  };

  let onContinuationPage = false;
  const drawContinuationPage = () => {
    page = pdf.addPage([595, 420]);
    drawHeader();
    drawCard(
      28,
      cardBottom,
      539,
      cardTop - cardBottom,
      "CÁC KHOẢN THANH TOÁN (TIẾP THEO)",
    );
    drawFit(
      `Học viên: ${student.fullName}  ·  Mã đợt: ${batch.batchNo}`,
      45,
      303,
      505,
      7.5,
      muted,
      6.5,
    );
    page.drawLine({
      start: { x: 45, y: 292 },
      end: { x: 550, y: 292 },
      thickness: 0.7,
      color: border,
    });
    onContinuationPage = true;
    y = 273;
  };
  const drawFinalOnlyPage = () => {
    page = pdf.addPage([595, 420]);
    drawHeader();
    drawCard(
      leftX,
      cardBottom,
      leftWidth,
      cardTop - cardBottom,
      "THÔNG TIN THANH TOÁN",
    );
    drawCard(rightX, cardBottom, rightWidth, cardTop - cardBottom);
    drawFit(student.fullName, 45, 303, 228, 16, red, 11);
    drawFit(`Mã học viên: ${student.code}`, 45, 286, 228, 7.5, muted, 6.5);
    drawRightFit(`Mã đợt: ${batch.batchNo}`, 274, 303, 180, 7.5, muted, 6.5);
  };

  drawHeader();
  drawFirstPageCards();

  let y = 228;
  let feeRowX = 45;
  let feeRowRight = 274;
  let feeRowWidth = 229;
  const minimumFeeY = 132;
  const ensureFeeSpace = (needed: number) => {
    if (y - needed < minimumFeeY) drawContinuationPage();
    if (onContinuationPage) {
      feeRowX = 45;
      feeRowRight = 550;
      feeRowWidth = feeRowRight - feeRowX;
    }
  };
  for (const allocation of fees) {
    ensureFeeSpace(28);
    page.drawRectangle({
      x: feeRowX - 3,
      y: y - 6,
      width: feeRowWidth + 6,
      height: 18,
      color: paleBlue,
    });
    drawFit(
      `${allocation.feeNo} — ${allocation.className || "Chưa có lớp"}`,
      feeRowX + 4,
      y,
      Math.max(100, feeRowWidth - 120),
      7.5,
      navy,
      6.5,
    );
    drawRightFit(
      `${money(Number(allocation.payableAmount))} VND`,
      feeRowRight,
      y,
      90,
      7.5,
      navy,
      6.5,
    );
    y -= 18;
    for (const item of allocation.items) {
      ensureFeeSpace(18);
      const subjectName = item.subjectName || item.itemName;
      drawFit(
        `– ${subjectName}`,
        feeRowX + 8,
        y,
        Math.max(90, feeRowWidth - 105),
        7,
        muted,
        6,
      );
      drawRightFit(
        `${money(Number(item.amount))} VND`,
        feeRowRight,
        y,
        90,
        7,
        muted,
        6,
      );
      y -= 13;
    }
    if (Number(allocation.discountAmount) > 0) {
      ensureFeeSpace(18);
      draw("– Giảm giá", feeRowX + 8, y, 7, muted);
      drawRightFit(
        `-${money(Number(allocation.discountAmount))} VND`,
        feeRowRight,
        y,
        90,
        7,
        muted,
        6,
      );
      y -= 13;
    }
    if (Number(allocation.additionalAmount) > 0) {
      ensureFeeSpace(18);
      draw("– Phụ thu", feeRowX + 8, y, 7, muted);
      drawRightFit(
        `${money(Number(allocation.additionalAmount))} VND`,
        feeRowRight,
        y,
        90,
        7,
        muted,
        6,
      );
      y -= 13;
    }
    y -= 5;
  }
  if (y < minimumFeeY) {
    drawFinalOnlyPage();
  }

  page.drawRectangle({
    x: 42,
    y: 88,
    width: 232,
    height: 48,
    color: paleRed,
    borderColor: border,
    borderWidth: 0.6,
  });
  page.drawRectangle({ x: 42, y: 88, width: 3, height: 48, color: red });
  draw("TỔNG CẦN THANH TOÁN", 52, 119, 7, muted);
  drawRightFit(
    `${money(Number(batch.totalAmount))} VND`,
    263,
    99,
    170,
    12.5,
    red,
    9,
  );
  draw(
    `Phương thức: ${batch.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản / VietQR" : batch.paymentMethod}`,
    45,
    78,
    6.5,
    ink,
  );
  drawFit(`Nội dung: ${batch.batchNo}`, 45, 67, 228, 6.5, ink, 6);
  drawFit(
    `Ngân hàng: ${account?.bankName || "Chưa cấu hình"}`,
    45,
    53,
    228,
    6.2,
    muted,
    5.8,
  );
  drawFit(
    `STK: ${account?.accountNo || "-"} · Chủ TK: ${account?.accountName || "-"}`,
    45,
    42,
    228,
    6.2,
    muted,
    5.8,
  );

  if (!accountRecord.isActive) {
    draw("Tài khoản đã ngừng hoạt động.", 45, 32, 6, red);
  }

  const qrPng =
    prefetchedQr === undefined ? await fetchNoticeQrPng(data) : prefetchedQr;
  if (qrPng) {
    const qr = await pdf.embedPng(qrPng);
    const qrScale = Math.min(252 / qr.width, 296 / qr.height);
    const qrWidth = qr.width * qrScale;
    const qrHeight = qr.height * qrScale;
    page.drawImage(qr, {
      x: rightX + rightWidth / 2 - qrWidth / 2,
      y: 191 - qrHeight / 2,
      width: qrWidth,
      height: qrHeight,
    });
  } else if (accountRecord.isActive) {
    drawFit(
      "Mã QR hiện chưa khả dụng.",
      rightX + 18,
      187,
      rightWidth - 36,
      8,
      muted,
      6.5,
    );
  }

  const pages = pdf.getPages();
  pages.forEach((footerPage, index) => {
    footerPage.drawLine({
      start: { x: 28, y: 25 },
      end: { x: 567, y: 25 },
      thickness: 0.7,
      color: gold,
    });
    const dateText = `Ngày xuất: ${exportedAt}`;
    const employeeText = `Nhân viên: ${exportedByName}`;
    footerPage.drawText(dateText, {
      x: 28,
      y: 14,
      size: 5.8,
      font,
      color: muted,
    });
    const employeeSize = Math.min(
      5.8,
      (270 / Math.max(font.widthOfTextAtSize(employeeText, 5.8), 1)) * 5.8,
    );
    footerPage.drawText(employeeText, {
      x: 245,
      y: 14,
      size: employeeSize,
      font,
      color: muted,
    });
    const pageText = `Trang ${index + 1}/${pages.length}`;
    footerPage.drawText(pageText, {
      x: 520,
      y: 14,
      size: 5.8,
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
