import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const NOTICE_OUTPUT_DIR = path.join(
  PUBLIC_ROOT,
  "generated",
  "payment-notices",
);
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

type NoticePdfInput = {
  notice: {
    noticeNumber: string;
    dueDate: Date | null;
    amount: number;
    createdAt: Date;
  };
  fee: {
    billingYear: number;
    billingMonth: number;
    amount: number;
    discount: number;
    finalAmount: number;
    student: {
      code: string;
      fullName: string;
      parentName: string | null;
      phone: string | null;
    };
    class: {
      code: string;
      name: string;
    };
  };
  qrCode: {
    qrPayload: string;
    transferContent: string;
    paymentAccount: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
  };
};

function normalizePublicUrl(relativePath: string) {
  return `/${relativePath.split(path.sep).join("/")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function splitTextByWidth(
  text: string,
  maxWidth: number,
  font: {
    widthOfTextAtSize: (text: string, size: number) => number;
  },
  fontSize: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export class StudentFeeAssetService {
  static async generateQrDataUrl(qrPayload: string) {
    return QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    });
  }

  // Add this constant next to your existing FONT_PATH definition, pointing at
  // the Bold weight of the same Unicode font you already use for FONT_PATH
  // (e.g. NotoSans-Bold.ttf, or your current font's -Bold variant).
  // const FONT_BOLD_PATH = path.join(FONT_DIR, "NotoSans-Bold.ttf");

  static async generateNoticePdfAsset(input: NoticePdfInput) {
    await mkdir(NOTICE_OUTPUT_DIR, { recursive: true });

    const qrDataUrl = await this.generateQrDataUrl(input.qrCode.qrPayload);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    const [fontBytes, fontBoldBytes] = await Promise.all([
      readFile(FONT_PATH),
      readFile(FONT_PATH),
    ]);
    const font = await pdf.embedFont(fontBytes, { subset: true });
    const fontBold = await pdf.embedFont(fontBoldBytes, { subset: true });
    const qrImage = await pdf.embedPng(dataUrlToUint8Array(qrDataUrl));

    const page = pdf.addPage([595.28, 419.53]);

    // ---- palette ----
    const white = rgb(1, 1, 1);
    const primary = rgb(0.11, 0.29, 0.65);
    const primarySoft = rgb(0.94, 0.96, 1);
    const muted = rgb(0.49, 0.52, 0.58);
    const label = rgb(0.55, 0.58, 0.64);
    const strong = rgb(0.13, 0.15, 0.2);
    const red = rgb(0.82, 0.16, 0.2);
    const redSoft = rgb(0.99, 0.95, 0.95);
    const redBorder = rgb(0.93, 0.78, 0.78);
    const amber = rgb(0.62, 0.42, 0.04);
    const amberSoft = rgb(0.99, 0.96, 0.87);
    const amberBorder = rgb(0.91, 0.82, 0.6);
    const panelBg = rgb(0.99, 0.99, 1);
    const footerBg = rgb(0.97, 0.98, 0.99);
    const border = rgb(0.85, 0.87, 0.91);
    const lightBorder = rgb(0.91, 0.93, 0.96);

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    // ---- text primitives ----
    const drawText = (
      text: string,
      x: number,
      y: number,
      size = 9,
      options?: {
        color?: ReturnType<typeof rgb>;
        align?: "left" | "center" | "right";
        width?: number;
        bold?: boolean;
      },
    ) => {
      const safeText = text || "";
      const useFont = options?.bold ? fontBold : font;
      const width = options?.width ?? 0;
      const textWidth = useFont.widthOfTextAtSize(safeText, size);

      const textX =
        options?.align === "center"
          ? x + (width - textWidth) / 2
          : options?.align === "right"
            ? x + width - textWidth
            : x;

      page.drawText(safeText, {
        x: textX,
        y,
        size,
        font: useFont,
        color: options?.color ?? strong,
      });

      return textWidth;
    };

    const splitAndMeasure = (
      text: string,
      width: number,
      size: number,
      lineHeight: number,
    ) => {
      const lines = splitTextByWidth(text || "", width, font, size);
      return { lines, height: lines.length * lineHeight };
    };

    const drawWrappedLines = (
      lines: string[],
      x: number,
      y: number,
      size: number,
      lineHeight: number,
      color: ReturnType<typeof rgb>,
      bold = false,
    ) => {
      const useFont = bold ? fontBold : font;
      lines.forEach((line, index) => {
        page.drawText(line, {
          x,
          y: y - index * lineHeight,
          size,
          font: useFont,
          color,
        });
      });
      return lines.length * lineHeight;
    };

    const drawDivider = (
      x: number,
      y: number,
      width: number,
      color = lightBorder,
    ) => {
      page.drawLine({
        start: { x, y },
        end: { x: x + width, y },
        thickness: 0.6,
        color,
      });
    };

    // ---- page frame ----
    const marginX = 26;
    const marginY = 20;
    const contentTop = pageHeight - marginY;
    const contentBottom = marginY;

    page.drawRectangle({
      x: marginX,
      y: marginY,
      width: pageWidth - marginX * 2,
      height: pageHeight - marginY * 2,
      borderColor: lightBorder,
      borderWidth: 0.8,
    });

    // ===== HEADER =====
    const headerH = 36;
    const headerY = contentTop - headerH;

    page.drawRectangle({
      x: marginX,
      y: headerY,
      width: pageWidth - marginX * 2,
      height: headerH,
      color: primarySoft,
    });
    drawDivider(marginX, headerY, pageWidth - marginX * 2);

    const headerPadX = 18;
    drawText("TRUNG TÂM GIÁO DỤC", marginX + headerPadX, headerY + 24, 10.5, {
      color: primary,
      bold: true,
    });
    drawText(
      `Phiếu báo học phí tháng ${input.fee.billingMonth}/${input.fee.billingYear}`,
      marginX + headerPadX,
      headerY + 10,
      8.5,
      { color: primary },
    );
    drawText(
      `Mã phiếu: ${input.notice.noticeNumber}`,
      marginX,
      headerY + 16,
      7.5,
      {
        align: "right",
        width: pageWidth - marginX * 2 - headerPadX,
        color: muted,
      },
    );

    // ===== BODY: two flow-based columns =====
    const bodyGapTop = 12;
    const bodyBottomReserve = 30; // reserved space for footer band
    const bodyTop = headerY - bodyGapTop;
    const bodyBottom = contentBottom + bodyBottomReserve;
    const bodyH = bodyTop - bodyBottom;

    const colGap = 16;
    const leftPanelX = marginX;
    const leftPanelW = 248;
    const rightPanelX = leftPanelX + leftPanelW + colGap;
    const rightPanelW = pageWidth - rightPanelX - marginX;
    const panelY = bodyBottom;
    const panelH = bodyH;

    // ===== LEFT: QR CARD =====
    page.drawRectangle({
      x: leftPanelX,
      y: panelY,
      width: leftPanelW,
      height: panelH,
      color: white,
      borderColor: border,
      borderWidth: 0.8,
    });

    let leftCursorY = panelY + panelH - 24;

    drawText("QUÉT QR ĐỂ THANH TOÁN", leftPanelX, leftCursorY, 9, {
      align: "center",
      width: leftPanelW,
      color: primary,
      bold: true,
    });
    leftCursorY -= 14;

    drawText(
      "Dùng app ngân hàng hoặc ví điện tử để quét mã",
      leftPanelX,
      leftCursorY,
      7,
      { align: "center", width: leftPanelW, color: muted },
    );
    leftCursorY -= 16;

    const qrSize = 124;
    const qrFrameSize = qrSize + 20;
    const qrFrameX = leftPanelX + (leftPanelW - qrFrameSize) / 2;
    const qrFrameY = leftCursorY - qrFrameSize;

    page.drawRectangle({
      x: qrFrameX,
      y: qrFrameY,
      width: qrFrameSize,
      height: qrFrameSize,
      color: white,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawImage(qrImage, {
      x: qrFrameX + 10,
      y: qrFrameY + 10,
      width: qrSize,
      height: qrSize,
    });

    leftCursorY = qrFrameY - 16;

    drawText(
      input.qrCode.paymentAccount.accountName,
      leftPanelX,
      leftCursorY,
      8,
      {
        align: "center",
        width: leftPanelW,
        color: strong,
        bold: true,
      },
    );
    leftCursorY -= 12;

    drawText(
      `${input.qrCode.paymentAccount.bankName} (${input.qrCode.paymentAccount.bankCode})`,
      leftPanelX + 10,
      leftCursorY,
      6.8,
      { align: "center", width: leftPanelW - 20, color: muted },
    );
    leftCursorY -= 11;

    drawText(
      input.qrCode.paymentAccount.accountNumber,
      leftPanelX,
      leftCursorY,
      7.5,
      {
        align: "center",
        width: leftPanelW,
        color: muted,
      },
    );

    // Expiry note, pinned to a fixed offset from the panel's bottom edge
    const noteH = 26;
    const noteY = panelY + 14;
    const noteX = leftPanelX + 14;
    const noteW = leftPanelW - 28;

    page.drawRectangle({
      x: noteX,
      y: noteY,
      width: noteW,
      height: noteH,
      color: amberSoft,
      borderColor: amberBorder,
      borderWidth: 0.6,
    });

    const { lines: noteLines } = splitAndMeasure(
      "QR có hiệu lực trong 15 phút. Vui lòng hoàn tất giao dịch trước khi hết hạn.",
      noteW - 16,
      6.3,
      7.6,
    );
    drawWrappedLines(noteLines, noteX + 8, noteY + noteH - 9, 6.3, 7.6, amber);

    // ===== RIGHT: PAYMENT INFO CARD (pure top-down flow) =====
    page.drawRectangle({
      x: rightPanelX,
      y: panelY,
      width: rightPanelW,
      height: panelH,
      color: panelBg,
      borderColor: border,
      borderWidth: 0.8,
    });

    const rightTitleH = 30;
    page.drawRectangle({
      x: rightPanelX,
      y: panelY + panelH - rightTitleH,
      width: rightPanelW,
      height: rightTitleH,
      color: primarySoft,
    });
    drawDivider(rightPanelX, panelY + panelH - rightTitleH, rightPanelW);
    drawText(
      "THÔNG TIN THANH TOÁN",
      rightPanelX + 16,
      panelY + panelH - 19,
      8.5,
      {
        color: primary,
        bold: true,
      },
    );

    const infoX = rightPanelX + 16;
    const infoW = rightPanelW - 32;

    // Every block advances a single cursor — no fixed/absolute y-coordinates
    // for dynamic content, so a long name/class/bank can never silently
    // overlap a block below it. If it runs out of room, cursorY will land
    // below the panel and the overflow will be visually obvious in QA
    // instead of hidden behind another element.
    const rowGap = 5;
    const sectionTitleGap = 11;

    let cursorY = panelY + panelH - rightTitleH - 16;

    const drawField = (
      lbl: string,
      value: string,
      size = 8,
      lineHeight = 9.6,
    ) => {
      drawText(lbl, infoX, cursorY, 6.8, { color: label });
      cursorY -= 10;
      const { lines, height } = splitAndMeasure(value, infoW, size, lineHeight);
      drawWrappedLines(lines, infoX, cursorY, size, lineHeight, strong, true);
      cursorY -= height + rowGap;
    };

    const drawSectionTitle = (text: string) => {
      drawText(text, infoX, cursorY, 7.2, { color: primary, bold: true });
      cursorY -= sectionTitleGap;
    };

    drawSectionTitle("Người thụ hưởng");
    drawField("Tên đơn vị", input.qrCode.paymentAccount.accountName);
    drawField("Số tài khoản", input.qrCode.paymentAccount.accountNumber);
    drawField(
      "Ngân hàng",
      `${input.qrCode.paymentAccount.bankName} (${input.qrCode.paymentAccount.bankCode})`,
    );

    cursorY -= 3;
    drawDivider(infoX, cursorY, infoW);
    cursorY -= 11;

    drawSectionTitle("Thông tin học phí");
    drawField(
      "Học viên",
      `${input.fee.student.code} — ${input.fee.student.fullName}`,
    );
    drawField("Lớp", `${input.fee.class.code} — ${input.fee.class.name}`);
    drawField("Nội dung chuyển khoản", input.qrCode.transferContent, 7.2, 8.6);

    // Amount box sits wherever the cursor lands — sized to its own content,
    // not pinned to the panel bottom. This is what exposes overflow during
    // testing instead of papering over it.
    const amountBoxH = 42;
    const amountBoxY = cursorY - amountBoxH + 6;

    if (amountBoxY < panelY) {
      // Dev-time signal only — doesn't block generation, but flags that this
      // particular notice's content is long enough to be worth a visual check.
      // eslint-disable-next-line no-console
      console.warn(
        `[generateNoticePdfAsset] Content for notice ${input.notice.noticeNumber} is near/over the panel height (overflow: ${(panelY - amountBoxY).toFixed(1)}pt). Consider shortening account/class names or reviewing the rendered PDF.`,
      );
    }

    page.drawRectangle({
      x: infoX,
      y: amountBoxY,
      width: infoW,
      height: amountBoxH,
      color: redSoft,
      borderColor: redBorder,
      borderWidth: 0.6,
    });

    drawText(
      "Số tiền cần thanh toán",
      infoX + 10,
      amountBoxY + amountBoxH - 14,
      7,
      {
        color: muted,
      },
    );
    drawText(
      `${formatCurrency(input.notice.amount)} đ`,
      infoX + 10,
      amountBoxY + 11,
      17,
      {
        color: red,
        bold: true,
      },
    );

    // ===== FOOTER =====
    const footerH = 20;
    page.drawRectangle({
      x: marginX,
      y: marginY,
      width: pageWidth - marginX * 2,
      height: footerH,
      color: footerBg,
    });
    drawDivider(marginX, marginY + footerH, pageWidth - marginX * 2);
    drawText(
      "Phiếu này không phải biên lai thu tiền. Vui lòng giữ lại thông tin chuyển khoản để đối soát.",
      marginX,
      marginY + 7,
      6.3,
      { align: "center", width: pageWidth - marginX * 2, color: muted },
    );

    const pdfBytes = await pdf.save();
    const safeFileName = input.notice.noticeNumber.replace(/[^\w.-]/g, "_");
    const fileName = `${safeFileName}.pdf`;
    const outputPath = path.join(NOTICE_OUTPUT_DIR, fileName);

    await writeFile(outputPath, pdfBytes);

    return {
      pdfUrl: normalizePublicUrl(
        path.join("generated", "payment-notices", fileName),
      ),
      qrDataUrl,
    };
  }
}
