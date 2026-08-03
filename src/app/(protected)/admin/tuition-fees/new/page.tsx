"use client";

import { useRouter } from "next/navigation";
import { TuitionFeeForm } from "@/modules/finance/tuition/components/TuitionFeeForm";

export default function NewTuitionFeePage() { const router = useRouter(); return <TuitionFeeForm onSuccess={(id) => router.push(`/admin/tuition-fees/${id}`)} />; }
