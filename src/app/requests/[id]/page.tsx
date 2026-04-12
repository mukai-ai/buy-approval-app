import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import styles from "../../requests.module.css";
import Link from "next/link";
import ApprovalActionButtons from "./ApprovalActionButtons";
import RequestActions from "./RequestActions";
import { notFound } from "next/navigation";
import { CONFIRMATION_TYPES, getTypeLabel, getDateLabel } from "@/lib/requestTypes";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className={styles.container}>
        <p>ログインしてください</p>
        <Link href="/"><button className={styles.buttonSecondary}>戻る</button></Link>
      </div>
    );
  }

  const reqData = await prisma.request.findUnique({
    where: { id: params.id },
    include: { approvalSteps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!reqData) {
    notFound();
  }

  const currentPendingStep = reqData.approvalSteps.find((s: any) => s.status === "PENDING");
  const isCurrentApprover = currentPendingStep?.approverEmail === session.user.email;
  const isApplicant = reqData.applicantEmail === session.user.email;

  const getStatusLabel = (s: string) => {
    if (s === "APPROVED") return "承認済";
    if (s === "REJECTED") return "却下";
    return "審査中 (確認待ち)";
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>申請詳細: {reqData.title}</h1>
      <div className={styles.detailCard}>
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>申請者:</div>
          <div className={styles.detailValue}>{reqData.applicantEmail}</div>
        </div>
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>日付:</div>
          <div className={styles.detailValue}>{new Date(reqData.createdAt).toLocaleString()}</div>
        </div>
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>申請区分:</div>
          <div className={styles.detailValue}>
            {getTypeLabel(reqData.type)}
          </div>
        </div>
        {!CONFIRMATION_TYPES.includes(reqData.type) && (
          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>金額:</div>
            <div className={styles.detailValue}>
              {reqData.amount.toLocaleString()} 円
            </div>
          </div>
        )}
        {reqData.type === "REFORM" && (
          <>
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>業者名:</div>
              <div className={styles.detailValue}>{reqData.companyName || "未入力"}</div>
            </div>
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>着工日 / 完了日:</div>
              <div className={styles.detailValue}>
                {reqData.startDate ? new Date(reqData.startDate).toLocaleDateString() : "未定"} 〜{" "}
                {reqData.endDate ? new Date(reqData.endDate).toLocaleDateString() : "未定"}
              </div>
            </div>
          </>
        )}
        {CONFIRMATION_TYPES.includes(reqData.type) && (
          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>{getDateLabel(reqData.type)}:</div>
            <div className={styles.detailValue}>
              {reqData.startDate ? new Date(reqData.startDate).toLocaleDateString() : "未入力"}
            </div>
          </div>
        )}
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>{CONFIRMATION_TYPES.includes(reqData.type) ? "添付資料のファイルorフォルダのパス:" : "社内サーバーのファイルパス等:"}</div>
          <div className={styles.detailValue}>
            {reqData.attachmentFile || "なし"}
          </div>
        </div>
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>全体ステータス:</div>
          <div className={styles.detailValue}>
            <strong style={{
              color: reqData.status === "APPROVED" ? "#166534" : reqData.status === "REJECTED" ? "#991b1b" : "#854d0e"
            }}>
              {getStatusLabel(reqData.status)}
            </strong>
          </div>
        </div>

        <RequestActions 
          requestId={reqData.id} 
          isApplicant={isApplicant} 
          isRejected={reqData.status === "REJECTED"}
          requestStatus={reqData.status}
          requestData={JSON.parse(JSON.stringify(reqData))}
        />
      </div>

      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", marginTop: "2rem" }}>承認フロー・状況（履歴）</h2>
      {reqData.approvalSteps.map((step: any) => (
        <div key={step.id} className={`${styles.stepCard} ${step.status === "APPROVED" ? styles.stepCardApproved : step.status === "REJECTED" ? styles.stepCardRejected : styles.stepCardPending}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: "600", color: "#334155" }}>STEP {step.stepOrder} - {step.approverEmail}</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: "bold", color: step.status === "APPROVED" ? "#10b981" : step.status === "REJECTED" ? "#ef4444" : "#eab308" }}>
                {getStatusLabel(step.status)}
              </div>
              {step.status !== "PENDING" && (
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {new Date(step.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          {step.comment && (
            <div style={{ padding: "0.5rem", background: "#f1f5f9", borderRadius: "4px", fontSize: "0.875rem", color: "#475569" }}>
              コメント: {step.comment}
            </div>
          )}
        </div>
      ))}

      {isCurrentApprover && reqData.status === "PENDING" && (
        <ApprovalActionButtons requestId={reqData.id} />
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link href="/">
          <button className={styles.buttonSecondary}>ダッシュボードへ戻る</button>
        </Link>
      </div>
    </div>
  );
}
