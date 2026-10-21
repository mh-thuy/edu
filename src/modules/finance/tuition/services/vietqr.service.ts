import QRCode from "qrcode";

const VIETQR_IMAGE_BASE_URL = "https://img.vietqr.io/image";

export function buildVietQrUrl({ bankCode, accountNo, accountName, amount, addInfo }: { bankCode: string; accountNo: string; accountName?: string | null; amount: number; addInfo: string }) {
  const params = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: addInfo.slice(0, 25) });
  if (accountName) params.set("accountName", accountName);
  return `${VIETQR_IMAGE_BASE_URL}/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNo)}-compact2.png?${params.toString()}`;
}

// NAPAS BIN theo mã/tên viết tắt ngân hàng thường dùng (danh sách của VietQR).
const VIETQR_BANK_BINS: Record<string, string> = {
  VCB: "970436", VIETCOMBANK: "970436",
  BIDV: "970418",
  ICB: "970415", CTG: "970415", VIETINBANK: "970415",
  VBA: "970405", AGRIBANK: "970405",
  TCB: "970407", TECHCOMBANK: "970407",
  MB: "970422", MBB: "970422", MBBANK: "970422",
  ACB: "970416",
  VPB: "970432", VPBANK: "970432",
  TPB: "970423", TPBANK: "970423",
  STB: "970403", SACOMBANK: "970403",
  HDB: "970437", HDBANK: "970437",
  VIB: "970441",
  SHB: "970443",
  EIB: "970431", EXIMBANK: "970431",
  MSB: "970426",
  OCB: "970448",
  SCB: "970429",
  SEAB: "970440", SEABANK: "970440",
  LPB: "970449", LPBANK: "970449",
  NAB: "970428", NAMABANK: "970428",
  ABB: "970425", ABBANK: "970425",
  BAB: "970409", BACABANK: "970409",
  VCCB: "970454", BVB: "970454",
  PGB: "970430", PGBANK: "970430",
  SGICB: "970400", SAIGONBANK: "970400",
  KLB: "970452", KIENLONGBANK: "970452",
  VAB: "970427", VIETABANK: "970427",
  NCB: "970419",
  PVCB: "970412", PVCOMBANK: "970412",
  GPB: "970408", GPBANK: "970408",
  VIETBANK: "970433",
};

export function getVietQrBankBin(bankCode: string) {
  const normalized = bankCode.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (/^\d{6}$/.test(normalized)) return normalized;
  return VIETQR_BANK_BINS[normalized] ?? null;
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload({ bankBin, accountNo, amount, addInfo }: { bankBin: string; accountNo: string; amount: number; addInfo: string }) {
  const merchantAccount = tlv("00", "A000000727") + tlv("01", tlv("00", bankBin) + tlv("01", accountNo.trim())) + tlv("02", "QRIBFTTA");
  const content = addInfo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7E]/g, "").slice(0, 25);
  const body = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("38", merchantAccount),
    tlv("53", "704"),
    tlv("54", String(Math.round(amount))),
    tlv("58", "VN"),
    tlv("62", tlv("08", content)),
  ].join("") + "6304";
  return body + crc16Ccitt(body);
}

export async function buildVietQrPng({ bankCode, accountNo, amount, addInfo }: { bankCode: string; accountNo: string; amount: number; addInfo: string }) {
  const bankBin = getVietQrBankBin(bankCode);
  if (!bankBin) return null;
  return QRCode.toBuffer(buildVietQrPayload({ bankBin, accountNo, amount, addInfo }), { type: "png", errorCorrectionLevel: "M", margin: 1, width: 600 });
}
