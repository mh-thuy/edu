"use client";

import { useEffect, useState } from "react";
import { Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { RoleCode } from "@/constants/roles";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";

type Receipt = { id: string; receiptNo: string; issuedAt: string; amount: number; payment: { paymentNo: string; paymentMethod: string; tuitionFee: { feeNo: string; student: { code: string; fullName: string }; class: { name: string } } } };
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export function ReceiptList({ role }: { role: RoleCode }) {
  void role; const [items, setItems] = useState<Receipt[]>([]); const [error, setError] = useState(""); const [detailId, setDetailId] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/receipts").then(async (response) => { if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải biên lai")); return unwrapApiResponse<Receipt[]>(response); }).then(setItems).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải biên lai")); }, []);
  return <Stack spacing={2}><Typography variant="h5" fontWeight={700}>Biên lai học phí</Typography>{error && <Typography color="error">{error}</Typography>}<Paper><Table><TableHead><TableRow><TableCell>Số phiếu</TableCell><TableCell>Học sinh</TableCell><TableCell>Khoản thu</TableCell><TableCell>Ngày thu</TableCell><TableCell align="right">Số tiền</TableCell><TableCell /></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell><Button size="small" onClick={() => setDetailId(item.id)}>{item.receiptNo}</Button></TableCell><TableCell>{item.payment.tuitionFee.student.code} — {item.payment.tuitionFee.student.fullName}</TableCell><TableCell>{item.payment.tuitionFee.feeNo}</TableCell><TableCell>{new Date(item.issuedAt).toLocaleDateString("vi-VN")}</TableCell><TableCell align="right">{money(item.amount)}</TableCell><TableCell><Button size="small" href={`/api/tuition-receipts/${item.id}/pdf`}>Xuất PDF</Button></TableCell></TableRow>)}{!items.length && <TableRow><TableCell colSpan={6}><Typography sx={{ p: 3 }} color="text.secondary">Chưa có biên lai</Typography></TableCell></TableRow>}</TableBody></Table></Paper>{detailId && <ReceiptDetailDialog id={detailId} onClose={() => setDetailId(null)} />}</Stack>;
}
