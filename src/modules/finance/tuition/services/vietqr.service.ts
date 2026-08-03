const VIETQR_IMAGE_BASE_URL = "https://img.vietqr.io/image";

export function buildVietQrUrl({ bankCode, accountNo, accountName, amount, addInfo }: { bankCode: string; accountNo: string; accountName?: string | null; amount: number; addInfo: string }) {
  const params = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: addInfo.slice(0, 25) });
  if (accountName) params.set("accountName", accountName);
  return `${VIETQR_IMAGE_BASE_URL}/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNo)}-compact2.png?${params.toString()}`;
}
