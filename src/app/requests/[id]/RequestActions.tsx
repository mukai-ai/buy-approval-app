"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../requests.module.css";

export default function RequestActions({ 
  requestId, 
  isApplicant, 
  isRejected,
  requestStatus,
  requestData 
}: { 
  requestId: string, 
  isApplicant: boolean, 
  isRejected: boolean,
  requestStatus: string,
  requestData: any
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("本当にこの申請を削除しますか？")) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        alert("削除に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResubmit = () => {
    // 情報をクエリパラメータに乗せて新規作成画面へ
    const params = new URLSearchParams({
      copy: requestId,
      type: requestData.type,
      title: requestData.title,
      amount: requestData.amount.toString(),
      companyName: requestData.companyName || "",
      attachmentLink: requestData.attachmentLink || "",
    });
    router.push(`/requests/new?${params.toString()}`);
  };

  const hasProcessedSteps = requestData.approvalSteps && requestData.approvalSteps.some((s: any) => s.status !== "PENDING");

  return (
    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
      {isApplicant && requestStatus === "PENDING" && !hasProcessedSteps && !isDeleting && (
        <button 
          onClick={handleDelete} 
          className={styles.buttonSecondary}
          style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}
        >
          申請を削除する
        </button>
      )}
      
      {isRejected && isApplicant && (
        <button 
          onClick={handleResubmit} 
          className={styles.button}
        >
          内容をコピーして再申請
        </button>
      )}
    </div>
  );
}
