"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { getTypeLabel } from "@/lib/requestTypes";

type RequestType = {
  id: string;
  type: string;
  title: string;
  amount: number;
  status: string;
  applicantEmail: string;
  createdAt: string;
  resubmitCount: number;
};

type ApprovalStepType = {
  id: string;
  status: string;
  updatedAt: string;
  request: RequestType;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [myRequests, setMyRequests] = useState<RequestType[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalStepType[]>([]);
  const [pastApprovals, setPastApprovals] = useState<ApprovalStepType[]>([]);
  const [filterText, setFilterText] = useState("");
  const [myFilterText, setMyFilterText] = useState("");
  const [loading, setLoading] = useState(false); // Changed initial state to false
  const [initialLoading, setInitialLoading] = useState(true); // Added initialLoading state
  const [currentPage, setCurrentPage] = useState(1);
  const [myCurrentPage, setMyCurrentPage] = useState(1);
  const [totals, setTotals] = useState({ my: 0, pending: 0, past: 0 });
  const LIMIT = 5;

  useEffect(() => {
    // 検索ワードが変わったら1ページ目に戻す
    setCurrentPage(1);
  }, [filterText]);

  useEffect(() => {
    setMyCurrentPage(1);
  }, [myFilterText]);

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      const url = `/api/requests?page=${currentPage}&limit=${LIMIT}&search=${encodeURIComponent(filterText)}&myPage=${myCurrentPage}&myLimit=${LIMIT}&mySearch=${encodeURIComponent(myFilterText)}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setMyRequests(data.myRequests || []);
          setPendingApprovals(data.pendingApprovals || []);
          setPastApprovals(data.pastApprovals || []);
          setTotals({
            my: data.myRequestsTotal || 0,
            pending: data.pendingApprovalsTotal || 0,
            past: data.pastApprovalsTotal || 0
          });
          setLoading(false);
          setInitialLoading(false); // Set initialLoading to false after first fetch
        })
        .catch(() => { // Added catch block
          setLoading(false);
          setInitialLoading(false);
        });
    }
  }, [status, currentPage, filterText, myCurrentPage, myFilterText]);

  const handleExportCSV = async () => {
    // (省略されないように一応そのまま保持か、差分で置換)
    try {
      setLoading(true);
      const res = await fetch(`/api/requests?all=true&search=${encodeURIComponent(filterText)}`);
      const data = await res.json();
      const past = data.pastApprovals || [];
      
      if (past.length === 0) {
        alert("書き出し可能なデータがありません。");
        setLoading(false);
        return;
      }

      // CSVヘッダー
      let csvContent = "申請タイトル,申請者,区分,金額,ステータス,完了/却下時刻,コメント\n";
      
      past.forEach((step: any) => {
        const row = [
          `"${step.request.title.replace(/"/g, '""')}"`,
          `"${step.request.applicantEmail}"`,
          `"${getTypeLabel(step.request.type).replace("承認", "")}"`,
          step.request.amount,
          `"${step.status === 'APPROVED' ? '承認' : '却下'}"`,
          `"${new Date(step.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}"`,
          `"${(step.comment || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `approval_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert("CSVの作成に失敗しました。");
      setLoading(false);
    }
  };

  const handleExportMyCSV = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/requests?all=true&mySearch=${encodeURIComponent(myFilterText)}`);
      const data = await res.json();
      const my = data.myRequests || [];
      
      if (my.length === 0) {
        alert("書き出し可能なデータがありません。");
        setLoading(false);
        return;
      }

      // CSVヘッダー
      let csvContent = "申請タイトル,区分,金額,ステータス,申請日時\n";
      
      my.forEach((req: any) => {
        const row = [
          `"${req.title.replace(/"/g, '""')}"`,
          `"${getTypeLabel(req.type)}"`,
          req.amount,
          `"${req.status === 'APPROVED' ? '承認済' : req.status === 'REJECTED' ? '却下' : '審査中'}"`,
          `"${new Date(req.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `my_requests_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert("CSVの作成に失敗しました。");
      setLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && initialLoading)) { // Changed condition to use initialLoading
    return <div className={styles.container}>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 style={{ marginBottom: "1rem", color: "#2563eb" }}>承認ワークフロー</h1>
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
    <div className={styles.container} style={{ opacity: loading ? 0.7 : 1, transition: "opacity 0.2s" }}> {/* Added opacity for re-fetches */}
      <header className={styles.header}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
          <h1 className={styles.title}>ダッシュボード</h1>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", paddingBottom: "3px" }}>v1.1</span>
        </div>
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
                      {getTypeLabel(step.request.type)}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem" }}>
              <h2 className={styles.sectionTitle} style={{ margin: 0, flex: 1 }}>過去の承認履歴</h2>
              <button 
                className={styles.buttonOutline} 
                onClick={handleExportCSV}
                style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", whiteSpace: "nowrap" }}
              >
                CSV出力
              </button>
              <input
                type="text"
                placeholder="キーワード検索..." // Placeholder already correct
                className={styles.input}
                style={{ width: "180px", padding: "0.5rem", height: "auto", fontSize: "0.875rem" }}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
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
                      {getTypeLabel(step.request.type)}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{step.request.title}</h3>
                  <div className={styles.cardMeta} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>申請者: {step.request.applicantEmail}</span>
                    <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      時刻: {new Date(step.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
              <button 
                className={styles.buttonOutline} 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ padding: "0.4rem 1rem", opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                前へ
              </button>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                ページ {currentPage}
              </span>
              <button 
                className={styles.buttonOutline}
                disabled={Math.max(totals.my, totals.pending, totals.past) <= currentPage * LIMIT}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ 
                  padding: "0.4rem 1rem", 
                  opacity: Math.max(totals.my, totals.pending, totals.past) <= currentPage * LIMIT ? 0.5 : 1 
                }}
              >
                次へ
              </button>
            </div>
          </section>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem" }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, flex: 1, fontFamily: '"Mochiy Pop P One", sans-serif' }}>自分の申請状況</h2>
            <button 
              className={styles.buttonOutline} 
              onClick={handleExportMyCSV}
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", whiteSpace: "nowrap" }}
            >
              CSV出力
            </button>
            <input
              type="text"
              placeholder="キーワード検索..."
              className={styles.input}
              style={{ width: "150px", padding: "0.5rem", height: "auto", fontSize: "0.875rem" }}
              value={myFilterText}
              onChange={(e) => setMyFilterText(e.target.value)}
            />
          </div>
          {myRequests.length === 0 ? (
            <p style={{ color: "#64748b" }}>条件に一致する申請はありません。</p>
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
                    {req.status === "APPROVED" ? "承認済" : req.status === "REJECTED" ? "却下" : req.resubmitCount > 0 ? "審査中（再申請）" : "審査中"}
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>
                    {getTypeLabel(req.type)}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{req.title}</h3>
                <div className={styles.cardMeta}>
                  <span>時刻: {new Date(req.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                </div>
              </div>
            ))
          )}

          {/* My Requests Pagination */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
            <button 
              className={styles.buttonOutline} 
              disabled={myCurrentPage === 1}
              onClick={() => setMyCurrentPage(p => Math.max(1, p - 1))}
              style={{ padding: "0.4rem 1rem", opacity: myCurrentPage === 1 ? 0.5 : 1 }}
            >
              前へ
            </button>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              ページ {myCurrentPage}
            </span>
            <button 
              className={styles.buttonOutline}
              disabled={totals.my <= myCurrentPage * LIMIT}
              onClick={() => setMyCurrentPage(p => p + 1)}
              style={{ 
                padding: "0.4rem 1rem", 
                opacity: totals.my <= myCurrentPage * LIMIT ? 0.5 : 1 
              }}
            >
              次へ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
