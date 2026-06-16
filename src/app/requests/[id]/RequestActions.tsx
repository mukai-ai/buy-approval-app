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

  // 福利厚生施設用のState
  const [endDate, setEndDate] = useState(
    requestData.endDate
      ? new Date(requestData.endDate).toISOString().split("T")[0]
      : ""
  );
  const [facilityName, setFacilityName] = useState(requestData.facilityName || "");
  const [peopleCount, setPeopleCount] = useState(requestData.peopleCount?.toString() || "1");
  const [companions, setCompanions] = useState(requestData.companions || "");
  const [purpose, setPurpose] = useState(requestData.purpose || "PRIVATE");

  // 事後報告用のState
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState(requestData.report || "");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
          title: requestData.type === 'FACILITY' ? `${facilityName} 利用申請 (${startDate}〜${endDate})` : title, 
          startDate, 
          endDate: requestData.type === 'FACILITY' ? endDate : undefined,
          attachmentFile: requestData.type === 'FACILITY' ? undefined : attachmentFile, 
          amount: requestData.type === 'FACILITY' ? '0' : amount, 
          companyName: requestData.type === 'FACILITY' ? undefined : companyName,
          applicantComment: (requestData.type === 'BUY' || requestData.type === 'FACILITY') ? applicantComment : undefined,
          // 福利厚生用
          facilityName: requestData.type === 'FACILITY' ? facilityName : undefined,
          peopleCount: requestData.type === 'FACILITY' ? peopleCount : undefined,
          companions: requestData.type === 'FACILITY' ? companions : undefined,
          purpose: requestData.type === 'FACILITY' ? purpose : undefined,
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

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    if (!confirm("この内容で利用報告を提出しますか？")) return;
    
    setIsSubmittingReport(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: reportText }),
      });
      if (res.ok) {
        alert("利用報告を提出しました。");
        router.refresh();
        setShowReportForm(false);
      } else {
        const data = await res.json();
        alert("提出に失敗しました: " + (data.error || ""));
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const generateGCalUrl = () => {
    const titleVal = encodeURIComponent(`【利用】${requestData.facilityName}`);
    const startVal = startDate.replace(/-/g, '');
    const endDateObj = new Date(endDate || startDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endVal = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
    const detailsVal = encodeURIComponent(`利用者・同伴者: ${companions}\n目的: ${purpose === 'BUSINESS' ? '接待利用' : '私的利用'}\n備考: ${applicantComment}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleVal}&dates=${startVal}/${endVal}&details=${detailsVal}`;
  };

  const hasProcessedSteps = requestData.approvalSteps && requestData.approvalSteps.some((s: any) => s.status !== "PENDING");

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
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

        {/* 福利厚生施設で承認済（報告前）の場合 */}
        {requestData.type === 'FACILITY' && requestStatus === 'APPROVED' && isApplicant && (
          <>
            <a 
              href={generateGCalUrl()} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={styles.button}
              style={{ backgroundColor: "#4285F4", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              📅 Googleカレンダーに追加
            </a>
            {!showReportForm && (
              <button 
                onClick={() => setShowReportForm(true)} 
                className={styles.button}
                style={{ backgroundColor: "#10b981", color: "white", border: "none" }}
              >
                📝 利用報告を提出する
              </button>
            )}
          </>
        )}
      </div>

      {/* 事後報告フォーム */}
      {showReportForm && (
        <div style={{ marginTop: "1.5rem", padding: "1.5rem", border: "2px solid #10b981", borderRadius: "8px", backgroundColor: "#ecfdf5" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem", color: "#047857" }}>
            利用報告の提出
          </h3>
          <form onSubmit={handleReportSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>報告内容</label>
              <textarea
                className={styles.textarea}
                rows={4}
                required
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="利用中に特に問題がなかったか、あるいは特記すべき利用結果を報告してください。"
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button type="submit" className={styles.button} style={{ backgroundColor: "#10b981", color: "white", border: "none" }} disabled={isSubmittingReport}>
                {isSubmittingReport ? "送信中..." : "報告を提出する"}
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={() => setShowReportForm(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

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
            {requestData.type !== "FACILITY" && (
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
            )}

            {isConfirmationType && requestData.type !== "FACILITY" && (
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
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label className={styles.label}>着工日</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label className={styles.label}>完了日</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {!isConfirmationType && requestData.type !== "FACILITY" && (
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

            {requestData.type !== "FACILITY" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>{isConfirmationType ? "添付資料のファイルorフォルダのパス" : "社内サーバーのファイルパス等"}</label>
                <input
                  type="text"
                  className={styles.input}
                  value={attachmentFile}
                  onChange={(e) => setAttachmentFile(e.target.value)}
                />
              </div>
            )}

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
