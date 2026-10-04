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
  draw(`Ngày tạo: ${formatVietnamDateTime(batch.createdAt)}`, 55, 686);
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
    const payableAmount = allocation.payableAmount;
    draw(`${money(Number(payableAmount))} VND`, 390, y);
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
      draw(
        `-${money(Number(allocation.discountAmount))} VND`,
        390,
        itemY,
        9,
        muted,
      );
      itemY -= 17;
    }
    if (Number(allocation.additionalAmount) > 0) {
      draw("- Phụ thu", 90, itemY, 9, muted);
      draw(
        `${money(Number(allocation.additionalAmount))} VND`,
        390,
        itemY,
        9,
        muted,
      );
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
  if (!accountRecord.isActive) {
    draw(
      "Tài khoản đã ngừng hoạt động; vui lòng liên hệ trung tâm trước khi chuyển khoản.",
      75,
      bankY - 94,
      9,
      muted,
    );
  }
  const qrPng = prefetchedQr === undefined
    ? await fetchNoticeQrPng(data)
    : prefetchedQr;
  if (qrPng) {
    const qr = await pdf.embedPng(qrPng);
    page.drawImage(qr, { x: 395, y: bankY - 155, width: 125, height: 125 });
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
