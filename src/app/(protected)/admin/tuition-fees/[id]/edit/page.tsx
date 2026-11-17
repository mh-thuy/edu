"use client";

import { useParams, useRouter } from "next/navigation";
import { resolveReturnTo, withReturnTo } from "@/lib/return-to";
import { TuitionEditForm } from "@/modules/finance/tuition/components/TuitionEditForm";

export default function EditTuitionPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();

    // Đọc returnTo lúc lưu xong, để sau khi sửa vẫn quay về đúng danh sách có bộ lọc.
    function goToDetailAfterSave() {
        const returnTo = resolveReturnTo(new URLSearchParams(window.location.search).get("returnTo"), ["/admin/tuition-fees"], "/admin/tuition-fees");
        router.push(withReturnTo(`/admin/tuition-fees/${params.id}`, returnTo));
    }

    return <TuitionEditForm id={params.id} onSuccess={goToDetailAfterSave} />; }
