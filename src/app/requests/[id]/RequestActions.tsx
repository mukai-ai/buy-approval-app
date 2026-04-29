"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../requests.module.css";
import { CONFIRMATION_TYPES, getDateLabel } from "@/lib/requestTypes";

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
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // フォームの初期値
  const [title, setTitle] = useState(requestData.title || "");
  const [attachmentFile, setAttachmentFile] = useState(requestData.attachmentFile || "");
  const [startDate, setStartDate] = useState(
    requestData.startDate
      ? new Date(requestData.startDate).toISOString().split("T")[0]
      : ""
  );
  const [amount, setAmount] = useState(requestData.amount?.toString() || "");
  const [companyName, setCompanyName] = useState(requestData.companyName || "");
  const [applicantComment, setApplicantComment] = useState(requestData.applicantComment || "");

  const isConfirmationType = CONFIRMATION_TYPES.includes(requestData.type);

  const handleDelete = async () => {
    if (!confirm("本当にこの申請を削除しますか？")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        alert("削除に失敗しました");
      }
    } catch {
      alert("エラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResubmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("この内容で再申請しますか？")) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          startDate, 
          attachmentFile, 
          amount, 
          companyName,
          applicantComment: requestData.type === 'BUY' ? applicantComment : undefined
        }),
      });
      if (res.ok) {
        router.refresh();
        setShowResubmitForm(false);
      } else {
        const data = await res.json();
        alert("再申請に失敗しました: " + (data.error || ""));
      }
    } catch {
      alert("エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasProcessedSteps = requestData.approvalSteps && requestData.approvalSteps.some((s: any) => s.status !== "PENDING");

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem" }}>
        {isApplicant && requestStatus === "PENDING" && !hasProcessedSteps && !isDeleting && (
          <button
            onClick={handleDelete}
            className={styles.buttonSecondary}
            style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}
          >
            申請を削除する
          </button>
        )}
        {isRejected && isApplicant && !showResubmitForm && (
          <button onClick={() => setShowResubmitForm(true)} className={styles.button}>
            内容を修正して再申請
          </button>
        )}
      </div>

      {showResubmitForm && isRejected && isApplicant && (
        <div style={{
          marginTop: "1.5rem",
          padding: "1.5rem",
          border: "2px solid #3b82f6",
          borderRadius: "8px",
          backgroundColor: "#eff6ff"
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem", color: "#1d4ed8" }}>
            内容を修正して再申請
          </h3>
          <form onSubmit={handleResubmitSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>申請タイトル</label>
              <input
                type="text"
                className={styles.input}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {isConfirmationType && (
              <div className={styles.formGroup}>
                <label className={styles.label}>{getDateLabel(requestData.type)}</label>
                <input
                  type="date"
                  className={styles.input}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            )}

            {requestData.type === "REFORM" && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label}>業者名</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>着工日</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {!isConfirmationType && (
              <div className={styles.formGroup}>
                <label className={styles.label}>金額（円）</label>
                <input
                  type="text"
                  className={styles.input}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>{isConfirmationType ? "添付資料のファイルorフォルダのパス" : "社内サーバーのファイルパス等"}</label>
              <input
                type="text"
                className={styles.input}
                value={attachmentFile}
                onChange={(e) => setAttachmentFile(e.target.value)}
              />
            </div>

            {requestData.type === 'BUY' && (
              <div className={styles.formGroup}>
                <label className={styles.label}>承認者へのコメント（任意）</label>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={applicantComment}
                  onChange={(e) => setApplicantComment(e.target.value)}
                  placeholder="承認者へ伝えたいことがあれば入力してください"
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button type="submit" className={styles.button} disabled={isSubmitting}>
                {isSubmitting ? "送信中..." : "再申請する"}
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setShowResubmitForm(false)}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
