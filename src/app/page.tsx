"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

type RequestType = {
  id: string;
  type: string;
  title: string;
  amount: number;
  status: string;
  applicantEmail: string;
  createdAt: string;
};

type ApprovalStepType = {
  id: string;
  status: string;
  request: RequestType;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [myRequests, setMyRequests] = useState<RequestType[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalStepType[]>([]);
  const [pastApprovals, setPastApprovals] = useState<ApprovalStepType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/requests")
        .then((res) => res.json())
        .then((data) => {
          setMyRequests(data.myRequests || []);
          setPendingApprovals(data.pendingApprovals || []);
          setPastApprovals(data.pastApprovals || []);
          setLoading(false);
        });
    }
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 style={{ marginBottom: "1rem", color: "#0f172a" }}>承認ワークフロー</h1>
          <p style={{ color: "#64748b", marginBottom: "2rem", lineHeight: "1.6" }}>
            システムを利用するにはGoogleアカウント<br />でログインしてください。
          </p>
          <button className={styles.button} onClick={() => signIn("google")}>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  const getStatusClass = (reqStatus: string) => {
    if (reqStatus === "APPROVED") return styles.statusApproved;
    if (reqStatus === "REJECTED") return styles.statusRejected;
    return styles.statusPending;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>ダッシュボード</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>{session?.user?.email}</span>
          <button className={styles.buttonOutline} onClick={() => router.push("/requests/new")}>
            ＋ 新規申請
          </button>
          <button className={styles.buttonOutline} onClick={() => signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      <div className={styles.dashboardGrid}>
        <div>
          <section style={{ marginBottom: "2.5rem" }}>
            <h2 className={styles.sectionTitle}>承認依頼（要対応）</h2>
            {pendingApprovals.length === 0 ? (
              <p style={{ color: "#64748b" }}>現在、対応が必要な承認はありません。</p>
            ) : (
              pendingApprovals.map((step) => (
                <div
                  key={step.id}
                  className={styles.card}
                  onClick={() => router.push(`/requests/${step.request.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span className={`${styles.statusBadge} ${styles.statusPending}`}>確認待ち</span>
                    <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>
                      {step.request.type === "BUY" ? "買付承認" : "リフォーム承認"}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{step.request.title}</h3>
                  <div className={styles.cardMeta}>
                    <span>日付: {new Date(step.request.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          <section>
            <h2 className={styles.sectionTitle}>過去の承認履歴</h2>
            {pastApprovals.length === 0 ? (
              <p style={{ color: "#64748b" }}>過去の承認履歴はありません。</p>
            ) : (
              pastApprovals.map((step) => (
                <div
                  key={step.id}
                  className={styles.card}
                  onClick={() => router.push(`/requests/${step.request.id}`)}
                  style={{ opacity: 0.8, borderLeftColor: step.status === "APPROVED" ? "#10b981" : "#ef4444" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span className={`${styles.statusBadge} ${step.status === "APPROVED" ? styles.statusApproved : styles.statusRejected}`}>
                      {step.status === "APPROVED" ? "承認済" : "却下"}
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>
                      {step.request.type === "BUY" ? "買付承認" : "リフォーム承認"}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{step.request.title}</h3>
                  <div className={styles.cardMeta}>
                    <span>申請者: {step.request.applicantEmail}</span>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div>
          <h2 className={styles.sectionTitle}>自分の申請状況</h2>
          {myRequests.length === 0 ? (
            <p style={{ color: "#64748b" }}>まだ申請履歴がありません。</p>
          ) : (
            myRequests.map((req) => (
              <div
                key={req.id}
                className={styles.card}
                onClick={() => router.push(`/requests/${req.id}`)}
                style={{ borderLeftColor: req.status === "APPROVED" ? "#166534" : req.status === "REJECTED" ? "#991b1b" : "#eab308" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span className={`${styles.statusBadge} ${getStatusClass(req.status)}`}>
                    {req.status === "APPROVED" ? "承認済" : req.status === "REJECTED" ? "却下" : "審査中"}
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>
                    {req.type === "BUY" ? "買付承認" : "リフォーム承認"}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{req.title}</h3>
                <div className={styles.cardMeta}>
                  <span>日付: {new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
