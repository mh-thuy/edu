"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { resolveReturnTo, withReturnTo } from "@/lib/return-to";
import { TuitionEditForm } from "@/modules/finance/tuition/components/TuitionEditForm";

export default function EditTuitionPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [cancelHref, setCancelHref] = useState(`/admin/tuition-fees/${params.id}`);

    // Đọc returnTo sau khi mount (không đọc window lúc render) để nút Hủy và lúc lưu xong đều giữ bộ lọc.
    useEffect(() => {
        setCancelHref(withReturnTo(`/admin/tuition-fees/${params.id}`, currentReturnTo()));
    }, [params.id]);

    function currentReturnTo() {
        return resolveReturnTo(new URLSearchParams(window.location.search).get("returnTo"), ["/admin/tuition-fees"], "/admin/tuition-fees");
    }

    function goToDetailAfterSave() {
        router.push(withReturnTo(`/admin/tuition-fees/${params.id}`, currentReturnTo()));
    }

    return <TuitionEditForm id={params.id} onSuccess={goToDetailAfterSave} cancelHref={cancelHref} />; }
