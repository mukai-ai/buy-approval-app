"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { facilities, rules } from "@/lib/facilities";
import CalendarComponent from "../components/CalendarComponent";

// ===== 型定義 =====
type RequestType = {
  id: string;
  type: string;
  title: string;
  amount: number;
  status: string;
  applicantEmail: string;
  createdAt: string;
  resubmitCount: number;
  facilityName: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  purpose: string | null;
  peopleCount: number | null;
  companions: string | null;
  applicantComment: string | null;
  report: string | null;
  approvalSteps?: ApprovalStepType[];
};

type ApprovalStepType = {
  id: string;
  status: string;
  updatedAt: string;
  approverEmail: string;
  stepOrder: number;
  round: number;
  comment?: string | null;
  request: RequestType;
};

// ===== 権限定義 =====
const ADMIN_EMAIL = "info@tokyomf.co.jp";      // 総務
const DIRECTOR_EMAIL = "koyanagi@tokyomf.co.jp"; // 部長
const EXEC_EMAIL = "satou@tokyomf.co.jp";         // 事務長

type UserRole = "employee" | "admin" | "director" | "exec";

function getRole(email: string): UserRole {
  if (email === ADMIN_EMAIL) return "admin";
  if (email === DIRECTOR_EMAIL) return "director";
  if (email === EXEC_EMAIL) return "exec";
  return "employee";
}

type ActiveTabEmployee = "employee" | "calendar" | "rules" | "approvals";
type ActiveTabAdmin = "employee" | "calendar" | "rules" | "admin-view" | "director-view" | "exec-view";
type ActiveTabDirector = "employee" | "calendar" | "rules" | "director-view";
type ActiveTabExec = "employee" | "calendar" | "rules" | "exec-view";
type ActiveTab = ActiveTabEmployee | ActiveTabAdmin | ActiveTabDirector | ActiveTabExec;

// 総務ビューのステータスフィルター
type AdminStatusFilter = "pending-admin" | "pending-director" | "pending-exec" | "approved" | "rejected" | "all";

// ===== ステータス変換 =====
function getStatusClass(reqStatus: string, s: typeof styles) {
  if (reqStatus === "APPROVED" || reqStatus === "REPORTED") return s.statusApproved;
  if (reqStatus === "REJECTED") return s.statusRejected;
  return s.statusPending;
}

function getStatusLabel(status: string) {
  if (status === "APPROVED") return "承認済";
  if (reqStatus_isReported(status)) return "報告済";
  if (status === "REJECTED") return "却下";
  return "審査中";
}

function reqStatus_isReported(s: string) {
  return s === "REPORTED";
}

// ===== インラインカードボタン =====
function ApprovalCardButtons({
  step,
  onActionDone,
  approveLabel = "承認",
}: {
  step: ApprovalStepType;
  onActionDone: () => void;
  approveLabel?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "APPROVED" | "REJECTED") => {
    let comment: string | null = null;
    if (action === "REJECTED") {
      comment = window.prompt("却下理由を入力してください（必須）:");
      if (!comment || !comment.trim()) {
        alert("却下理由を入力してください。");
        return;
      }
    }
    const confirmMsg = action === "APPROVED" ? `${approveLabel}しますか？` : "この申請を却下しますか？";
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // targetStepId を常に送信（総務による代理承認でも自身の承認でも対応）
      const body: any = { action, comment, targetStepId: step.id };
      const res = await fetch(`/api/requests/${step.request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        alert(action === "APPROVED" ? `${approveLabel}しました` : "却下しました");
        onActionDone();
      } else {
        const err = await res.json();
        alert(`エラー: ${err.error}`);
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
      <button
        onClick={() => handleAction("APPROVED")}
        disabled={loading}
        style={{
          flex: 1,
          padding: "0.55rem 1rem",
          background: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: "0.85rem",
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "処理中..." : `✓ ${approveLabel}`}
      </button>
      <button
        onClick={() => handleAction("REJECTED")}
        disabled={loading}
        style={{
          flex: 1,
          padding: "0.55rem 1rem",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: "0.85rem",
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "処理中..." : "✗ 却下する"}
      </button>
    </div>
  );
}

// ===== 申請カード (汎用) =====
function RequestCard({
  req,
  router,
  actionStep,
  onActionDone,
  approveLabel,
}: {
  req: RequestType;
  router: any;
  actionStep?: ApprovalStepType;
  onActionDone?: () => void;
  approveLabel?: string;
}) {
  const borderColor =
    req.status === "APPROVED" || req.status === "REPORTED"
      ? "#166534"
      : req.status === "REJECTED"
      ? "#991b1b"
      : "#eab308";

  const getStatusBadgeLabel = () => {
    if (req.status === "APPROVED") return "承認済";
    if (req.status === "REPORTED") return "報告済";
    if (req.status === "REJECTED") return "却下";
    return "審査中";
  };

  return (
    <div
      className={styles.card}
      style={{
        borderLeft: "5px solid",
        borderLeftColor: borderColor,
        padding: "1.25rem 1.5rem",
        background: "white",
        marginBottom: "1rem",
        cursor: actionStep ? "default" : "pointer",
      }}
      onClick={actionStep ? undefined : () => router.push(`/requests/${req.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h4
          style={{ margin: 0, fontSize: "1rem", color: "#1e293b", cursor: "pointer" }}
          onClick={() => router.push(`/requests/${req.id}`)}
        >
          {req.facilityName || req.title}
        </h4>
        <span
          className={`${styles.statusBadge} ${getStatusClass(req.status, styles)}`}
          style={{ fontSize: "0.7rem" }}
        >
          {getStatusBadgeLabel()}
        </span>
      </div>
      <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
        <strong>申請者:</strong> {req.applicantEmail.split("@")[0]}（アカウント: {req.applicantEmail}）
      </p>
      {req.startDate && (
        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
          <strong>日程:</strong> {new Date(req.startDate).toLocaleDateString("ja-JP")} 〜{" "}
          {req.endDate ? new Date(req.endDate).toLocaleDateString("ja-JP") : ""}
        </p>
      )}
      {req.companions && (
        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
          <strong>利用者・同伴者:</strong> 取引先A社 {req.companions}
        </p>
      )}
      {req.peopleCount && (
        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
          <strong>利用人数:</strong> {req.peopleCount}名
        </p>
      )}
      {req.purpose && (
        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
          <strong>利用目的:</strong> {req.purpose === "BUSINESS" ? "接待利用" : "私的利用"}
        </p>
      )}
      {req.applicantComment && (
        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
          <strong>備考:</strong> {req.applicantComment}
        </p>
      )}

      {/* 承認ボタン */}
      {actionStep && onActionDone && (
        <ApprovalCardButtons
          step={actionStep}
          onActionDone={onActionDone}
          approveLabel={approveLabel}
        />
      )}
    </div>
  );
}

// ===== 総務ビュー =====
function AdminView({
  allRequests,
  onRefresh,
  router,
}: {
  allRequests: RequestType[];
  onRefresh: () => void;
  router: any;
}) {
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>("pending-admin");

  // ステータス別に分類
  const pendingAdmin = allRequests.filter((r) => {
    const steps = r.approvalSteps || [];
    const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
    return steps.some((s) => s.approverEmail === ADMIN_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound);
  });

  const pendingDirector = allRequests.filter((r) => {
    const steps = r.approvalSteps || [];
    const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
    const adminStep = steps.find((s) => s.approverEmail === ADMIN_EMAIL && (s.round || 1) === maxRound);
    return (
      adminStep?.status === "APPROVED" &&
      steps.some((s) => s.approverEmail === DIRECTOR_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound)
    );
  });

  const pendingExec = allRequests.filter((r) => {
    const steps = r.approvalSteps || [];
    const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
    const adminStep = steps.find((s) => s.approverEmail === ADMIN_EMAIL && (s.round || 1) === maxRound);
    return (
      adminStep?.status === "APPROVED" &&
      steps.some((s) => s.approverEmail === EXEC_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound)
    );
  });

  const approved = allRequests.filter((r) => r.status === "APPROVED");
  const rejected = allRequests.filter((r) => r.status === "REJECTED");
  const reported = allRequests.filter((r) => r.status === "REPORTED" || (r.status === "APPROVED" && r.report));

  const tabItems: { key: AdminStatusFilter; label: string; count: number }[] = [
    { key: "pending-admin", label: "確認待ち", count: pendingAdmin.length },
    { key: "pending-director", label: "部長承認待ち", count: pendingDirector.length },
    { key: "pending-exec", label: "事務長承認待ち", count: pendingExec.length },
    { key: "approved", label: "承認済", count: approved.length },
    { key: "rejected", label: "却下済", count: rejected.length },
    { key: "all", label: "すべて", count: allRequests.length },
  ];

  const displayRequests: RequestType[] =
    statusFilter === "pending-admin"
      ? pendingAdmin
      : statusFilter === "pending-director"
      ? pendingDirector
      : statusFilter === "pending-exec"
      ? pendingExec
      : statusFilter === "approved"
      ? approved
      : statusFilter === "rejected"
      ? rejected
      : allRequests;

  const getActionStep = (req: RequestType): ApprovalStepType | undefined => {
    const steps = req.approvalSteps || [];
    const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
    let rawStep: any;
    if (statusFilter === "pending-admin") {
      rawStep = steps.find((s: any) => s.approverEmail === ADMIN_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound);
    } else if (statusFilter === "pending-director") {
      rawStep = steps.find((s: any) => s.approverEmail === DIRECTOR_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound);
    } else if (statusFilter === "pending-exec") {
      rawStep = steps.find((s: any) => s.approverEmail === EXEC_EMAIL && s.status === "PENDING" && (s.round || 1) === maxRound);
    }
    // approvalSteps の生データには request が含まれないため、親の req を付与する
    return rawStep ? { ...rawStep, request: req } as ApprovalStepType : undefined;
  };

  const getActionLabel = (req: RequestType): string => {
    if (statusFilter === "pending-admin") {
      // 利用目的に応じて次の承認者へ振り分けるボタン表示
      return req.purpose === "BUSINESS" ? "部長へ承認依頼" : "事務長へ承認依頼";
    }
    if (statusFilter === "pending-director") return "部長承認（代理）";
    if (statusFilter === "pending-exec") return "事務長承認（代理）";
    return "承認";
  };

  return (
    <div>
      <h2 className={styles.sectionTitle} style={{ marginBottom: "1.25rem" }}>
        申請一覧（全フロー・利用状況）
      </h2>

      {/* ステータスフィルタータブ */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {tabItems.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "9999px",
              border: "1px solid",
              borderColor: statusFilter === t.key ? "#2563eb" : "#e2e8f0",
              background: statusFilter === t.key ? "#2563eb" : "white",
              color: statusFilter === t.key ? "white" : "#334155",
              fontWeight: 600,
              fontSize: "0.8rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{
                  background: statusFilter === t.key ? "rgba(255,255,255,0.35)" : "#fee2e2",
                  color: statusFilter === t.key ? "white" : "#ef4444",
                  borderRadius: "9999px",
                  padding: "0 0.45rem",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  minWidth: "18px",
                  textAlign: "center",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* カード一覧 */}
      {displayRequests.length === 0 ? (
        <p style={{ color: "#64748b" }}>該当する申請はありません。</p>
      ) : (
        displayRequests.map((req) => {
          const actionStep = getActionStep(req);
          const actionLabel = getActionLabel(req);
          const proxyMode = statusFilter === "pending-director" || statusFilter === "pending-exec";

          return (
            <RequestCard
              key={req.id}
              req={req}
              router={router}
              actionStep={actionStep}
              onActionDone={onRefresh}
              approveLabel={actionLabel}
            />
          );
        })
      )}
    </div>
  );
}

// ===== 部長/事務長ビュー =====
function ApproverView({
  pendingSteps,
  onRefresh,
  router,
  title,
  emptyMessage,
}: {
  pendingSteps: ApprovalStepType[];
  onRefresh: () => void;
  router: any;
  title: string;
  emptyMessage?: string;
}) {
  return (
    <div>
      <h2 className={styles.sectionTitle} style={{ marginBottom: "1.25rem" }}>
        {title}
      </h2>
      {pendingSteps.length === 0 ? (
        <p style={{ color: "#64748b" }}>{emptyMessage || "現在、承認待ちの案件はありません。"}</p>
      ) : (
        pendingSteps.map((step) => (
          <RequestCard
            key={step.id}
            req={step.request}
            router={router}
            actionStep={step}
            onActionDone={onRefresh}
            approveLabel="承認する"
          />
        ))
      )}
    </div>
  );
}

// ===== 総務が見る部長/事務長ビュー（代理承認用）=====
function AdminProxyView({
  allRequests,
  approverEmail,
  title,
  onRefresh,
  router,
}: {
  allRequests: RequestType[];
  approverEmail: string;
  title: string;
  onRefresh: () => void;
  router: any;
}) {
  // 総務確認済み（adminステップがAPPROVED）かつ対象承認者がPENDINGの案件
  const pendingRequests = allRequests.filter((r) => {
    const steps = r.approvalSteps || [];
    const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
    const adminStep = steps.find((s) => s.approverEmail === ADMIN_EMAIL && (s.round || 1) === maxRound);
    return (
      adminStep?.status === "APPROVED" &&
      steps.some((s) => s.approverEmail === approverEmail && s.status === "PENDING" && (s.round || 1) === maxRound)
    );
  });

  return (
    <div>
      <h2 className={styles.sectionTitle} style={{ marginBottom: "1.25rem" }}>
        {title}
      </h2>
      {pendingRequests.length === 0 ? (
        <p style={{ color: "#64748b" }}>承認待ちの案件はありません。</p>
      ) : (
        pendingRequests.map((req) => {
          const steps = req.approvalSteps || [];
          const maxRound = steps.reduce((m, s) => Math.max(m, s.round || 1), 1);
          const rawStep = steps.find(
            (s: any) => s.approverEmail === approverEmail && s.status === "PENDING" && (s.round || 1) === maxRound
          );
          // approvalSteps の生データには request が含まれないため、親の req を付与する
          const actionStep = rawStep ? { ...rawStep, request: req } as ApprovalStepType : undefined;
          return (
            <RequestCard
              key={req.id}
              req={req}
              router={router}
              actionStep={actionStep}
              onActionDone={onRefresh}
              approveLabel="承認（代理）"
            />
          );
        })
      )}
    </div>
  );
}

// ===== メインコンポーネント =====
export default function WelfarePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const userEmail = (session?.user?.email || "").toLowerCase();
  const role = getRole(userEmail);

  // 初期タブを権限で決定
  const getInitialTab = (): ActiveTab => {
    if (role === "admin") return "admin-view";
    if (role === "director") return "director-view";
    if (role === "exec") return "exec-view";
    return "employee";
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab());
  const [myRequests, setMyRequests] = useState<RequestType[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalStepType[]>([]);
  const [pastApprovals, setPastApprovals] = useState<ApprovalStepType[]>([]);
  const [calendarRequests, setCalendarRequests] = useState<RequestType[]>([]);
  const [allRequests, setAllRequests] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);

    const promises: Promise<void>[] = [];

    if (role === "admin") {
      // 総務: 全件取得
      const p1 = fetch(`/api/requests?category=facility&adminView=true`)
        .then((r) => r.json())
        .then((data) => {
          setAllRequests(data.allRequests || []);
        });

      // カレンダー用
      const p2 = fetch(`/api/requests?category=facility&all=true`)
        .then((r) => r.json())
        .then((calData) => {
          const calReqs = [
            ...(calData.myRequests || []),
            ...(calData.pendingApprovals?.map((s: any) => s.request) || []),
            ...(calData.pastApprovals?.map((s: any) => s.request) || []),
          ];
          const unique = Array.from(new Map(calReqs.map((r) => [r.id, r])).values());
          setCalendarRequests(unique);
        });
      promises.push(p1, p2);
    } else {
      // 一般社員・部長・事務長
      const listUrl = `/api/requests?category=facility&page=1&limit=100&myPage=1&myLimit=100`;
      const calUrl = `/api/requests?category=facility&all=true`;

      const p1 = Promise.all([
        fetch(listUrl).then((r) => r.json()),
        fetch(calUrl).then((r) => r.json()),
      ]).then(([listData, calData]) => {
        setMyRequests(listData.myRequests || []);
        setPendingApprovals(listData.pendingApprovals || []);
        setPastApprovals(listData.pastApprovals || []);

        const calReqs = [
          ...(calData.myRequests || []),
          ...(calData.pendingApprovals?.map((s: any) => s.request) || []),
          ...(calData.pastApprovals?.map((s: any) => s.request) || []),
        ];
        const unique = Array.from(new Map(calReqs.map((r) => [r.id, r])).values());
        setCalendarRequests(unique);
      });
      promises.push(p1);
    }

    Promise.all(promises)
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setInitialLoading(false);
      });
  }, [status, role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // roleが確定したらinitialTabを設定 (セッション取得後)
  useEffect(() => {
    if (status === "authenticated") {
      setActiveTab(getInitialTab());
    }
  }, [status, userEmail]);

  const handleSubmitReport = async (id: string) => {
    const reportContent = window.prompt("施設の利用報告を入力してください（例: 特に問題なく綺麗に利用できました）:");
    if (!reportContent || !reportContent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: reportContent }),
      });
      if (res.ok) {
        alert("利用報告を提出しました！");
        fetchData();
      } else {
        const err = await res.json();
        alert(`エラーが発生しました: ${err.error || "詳細不明"}`);
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const generateGCalUrl = (req: RequestType) => {
    const title = encodeURIComponent(`【利用】${req.facilityName}`);
    let startStr = "";
    let endStr = "";
    if (req.startDate) startStr = new Date(req.startDate).toISOString().split("T")[0].replace(/-/g, "");
    if (req.endDate) {
      const d = new Date(req.endDate);
      d.setDate(d.getDate() + 1);
      endStr = d.toISOString().split("T")[0].replace(/-/g, "");
    }
    const dates = `${startStr}/${endStr}`;
    const details = encodeURIComponent(
      `利用者: ${req.applicantEmail.split("@")[0]}\n同伴者: ${req.companions || "なし"}\n利用人数: ${req.peopleCount || 1}名\n目的: ${req.purpose === "BUSINESS" ? "接待利用" : "私的利用"}\n備考: ${req.applicantComment || ""}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  };

  const formatText = (text: string) =>
    text.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ));

  const thStyle = {
    width: "150px",
    textAlign: "left" as const,
    padding: "0.75rem",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    verticalAlign: "top" as const,
    color: "#2563eb",
    fontWeight: "bold",
  };
  const tdStyle = {
    padding: "0.75rem",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    verticalAlign: "top" as const,
    color: "#334155",
    lineHeight: "1.5",
  };

  if (initialLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  // 今年度の利用回数
  const now = new Date();
  const fiscalYearStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  const myRequestsThisYear = myRequests.filter((req) => {
    const d = new Date(req.createdAt || req.startDate || "");
    return d >= fiscalYearStart && req.status !== "REJECTED";
  });

  // 部長/事務長向けのペンディングステップ
  const directorPendingSteps = pendingApprovals.filter((s) => s.request.type === "FACILITY");
  const execPendingSteps = pendingApprovals.filter((s) => s.request.type === "FACILITY");

  // ===== タブ定義 (権限別) =====
  const renderTabs = () => {
    const tabStyle = (key: ActiveTab) => ({
      padding: "0.6rem 1.1rem",
      borderRadius: "7px",
      border: "none",
      background: activeTab === key ? "#2563eb" : "transparent",
      color: activeTab === key ? "white" : "#64748b",
      fontWeight: 600 as const,
      fontSize: "0.875rem",
      cursor: "pointer" as const,
      transition: "all 0.15s",
    });

    if (role === "admin") {
      return (
        <div className={styles.facilityTabs}>
          <button style={tabStyle("employee")} onClick={() => setActiveTab("employee")}>🏢 施設・申請</button>
          <button style={tabStyle("calendar")} onClick={() => setActiveTab("calendar")}>📅 カレンダー（全件）</button>
          <button style={tabStyle("rules")} onClick={() => setActiveTab("rules")}>📖 利用ルール</button>
          <button style={tabStyle("admin-view")} onClick={() => setActiveTab("admin-view")}>📋 総務ビュー</button>
          <button style={tabStyle("director-view")} onClick={() => setActiveTab("director-view")}>👤 部長ビュー</button>
          <button style={tabStyle("exec-view")} onClick={() => setActiveTab("exec-view")}>👤 事務長ビュー</button>
        </div>
      );
    }
    if (role === "director") {
      return (
        <div className={styles.facilityTabs}>
          <button style={tabStyle("employee")} onClick={() => setActiveTab("employee")}>🏢 施設・申請</button>
          <button style={tabStyle("calendar")} onClick={() => setActiveTab("calendar")}>📅 予約カレンダー</button>
          <button style={tabStyle("rules")} onClick={() => setActiveTab("rules")}>📖 利用ルール</button>
          <button style={tabStyle("director-view")} onClick={() => setActiveTab("director-view")}>✅ 部長ビュー</button>
        </div>
      );
    }
    if (role === "exec") {
      return (
        <div className={styles.facilityTabs}>
          <button style={tabStyle("employee")} onClick={() => setActiveTab("employee")}>🏢 施設・申請</button>
          <button style={tabStyle("calendar")} onClick={() => setActiveTab("calendar")}>📅 予約カレンダー</button>
          <button style={tabStyle("rules")} onClick={() => setActiveTab("rules")}>📖 利用ルール</button>
          <button style={tabStyle("exec-view")} onClick={() => setActiveTab("exec-view")}>✅ 事務長ビュー</button>
        </div>
      );
    }
    // 一般社員
    return (
      <div className={styles.facilityTabs}>
        <button style={tabStyle("employee")} onClick={() => setActiveTab("employee")}>🏢 施設・申請</button>
        <button style={tabStyle("calendar")} onClick={() => setActiveTab("calendar")}>📅 予約カレンダー</button>
        <button style={tabStyle("rules")} onClick={() => setActiveTab("rules")}>📖 利用ルール</button>
        {pendingApprovals.length > 0 && (
          <button style={tabStyle("approvals")} onClick={() => setActiveTab("approvals")}>✅ 承認ビュー</button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container} style={{ opacity: loading ? 0.7 : 1, transition: "opacity 0.2s" }}>
      <header className={styles.header}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
          <h1 className={styles.title}>福利厚生施設 利用承認ワークフロー</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
            {userEmail}
            {role !== "employee" && (
              <span
                style={{
                  marginLeft: "0.5rem",
                  background: role === "admin" ? "#dbeafe" : "#f0fdf4",
                  color: role === "admin" ? "#1d4ed8" : "#166534",
                  padding: "0.1rem 0.5rem",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {role === "admin" ? "総務" : role === "director" ? "部長" : "事務長"}
              </span>
            )}
          </span>
          <button className={styles.buttonOutline} onClick={() => signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      {renderTabs()}

      <main>
        {/* ===== 施設・申請タブ ===== */}
        {activeTab === "employee" && (
          <div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>施設一覧</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
              {facilities.map((fac) => (
                <div key={fac.id} className={styles.card} style={{ padding: "1.5rem", background: "white", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "220px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 1rem 0", color: "#1e3a8a", fontSize: "1.25rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>{fac.name}</h3>
                    <p style={{ margin: "0.4rem 0", fontSize: "0.9rem", color: "#475569" }}><strong>種別:</strong> {fac.category}</p>
                    <p style={{ margin: "0.4rem 0", fontSize: "0.9rem", color: "#475569" }}><strong>所在地:</strong> {fac.location}</p>
                    <p style={{ margin: "0.4rem 0", fontSize: "0.9rem", color: "#475569" }}><strong>契約形態:</strong> {fac.contractType}</p>
                    <p style={{ margin: "0.4rem 0", fontSize: "0.9rem", color: "#475569" }}><strong>予約方法:</strong> {fac.bookingMethod}</p>
                  </div>
                  <button
                    className={styles.button}
                    style={{ marginTop: "1rem", width: "100%", padding: "0.6rem", fontSize: "0.9rem" }}
                    onClick={() => router.push(`/requests/new?type=FACILITY&facilityName=${encodeURIComponent(fac.name)}`)}
                  >
                    この施設を利用申請する
                  </button>
                </div>
              ))}
            </div>

            <h2 className={styles.sectionTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3.5rem", marginBottom: "1.5rem" }}>
              <span>あなたの申請履歴</span>
              <span style={{ fontSize: "1rem", fontWeight: "normal", color: "#64748b" }}>
                今年度の利用回数: <strong style={{ color: "#2563eb", fontSize: "1.2rem" }}>{myRequestsThisYear.length}</strong>回
              </span>
            </h2>

            {myRequests.length === 0 ? (
              <p style={{ color: "#64748b" }}>申請履歴はありません。</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className={styles.card}
                    style={{
                      borderLeft: "5px solid",
                      borderLeftColor: req.status === "APPROVED" || req.status === "REPORTED" ? "#166534" : req.status === "REJECTED" ? "#991b1b" : "#eab308",
                      padding: "1.5rem",
                      background: "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b" }}>{req.facilityName}</h4>
                      <span className={`${styles.statusBadge} ${getStatusClass(req.status, styles)}`}>
                        {req.status === "APPROVED" ? "承認済" : req.status === "REJECTED" ? "却下" : req.status === "REPORTED" ? "報告済" : "審査中"}
                      </span>
                    </div>
                    <p style={{ margin: "0.5rem 0", fontSize: "0.875rem", color: "#64748b" }}>
                      <strong>利用日程:</strong> {req.startDate ? new Date(req.startDate).toLocaleDateString("ja-JP") : ""} 〜 {req.endDate ? new Date(req.endDate).toLocaleDateString("ja-JP") : ""}
                    </p>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#334155" }}>
                      <strong>利用目的:</strong> {req.purpose === "BUSINESS" ? "接待利用" : "私的利用"}
                    </p>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#334155" }}>
                      <strong>利用人数:</strong> {req.peopleCount || 1}名 {req.companions ? `(同伴者: ${req.companions})` : ""}
                    </p>

                    {req.status === "REJECTED" && (
                      <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "#fee2e2", color: "#ef4444", borderRadius: "4px", fontSize: "0.875rem" }}>
                        <strong>却下されました。</strong>
                      </div>
                    )}

                    {req.status === "APPROVED" && (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
                        <a
                          href={generateGCalUrl(req)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", background: "#4285F4", color: "white", border: "none", textDecoration: "none", borderRadius: "6px", fontWeight: "bold", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                        >
                          📅 カレンダーに追加
                        </a>
                        <button
                          onClick={() => handleSubmitReport(req.id)}
                          style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                        >
                          📝 利用報告を提出
                        </button>
                      </div>
                    )}

                    {req.status === "REPORTED" && req.report && (
                      <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#ecfdf5", color: "#059669", borderRadius: "6px", fontSize: "0.875rem", border: "1px solid #a7f3d0" }}>
                        <strong>📝 提出済みの報告:</strong>
                        <p style={{ margin: "0.25rem 0 0 0", whiteSpace: "pre-wrap" }}>{req.report}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== カレンダータブ ===== */}
        {activeTab === "calendar" && (
          <div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>予約カレンダー</h2>
            <CalendarComponent
              requests={calendarRequests}
              userEmail={userEmail}
              isAdminOrApprover={role !== "employee"}
            />
          </div>
        )}

        {/* ===== 利用ルールタブ ===== */}
        {activeTab === "rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <h2 className={styles.sectionTitle}>施設利用ルール</h2>
            {rules.map((rule, idx) => (
              <div key={idx} className={styles.card} style={{ padding: "1.5rem", background: "white", borderRadius: "12px" }}>
                <h3 style={{ borderBottom: "2px solid #2563eb", paddingBottom: "0.5rem", marginBottom: "1rem", color: "#1e3a8a", fontSize: "1.25rem" }}>{rule.facilityName}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <tbody>
                    <tr><th style={thStyle}>対象施設</th><td style={tdStyle}>{rule.target}</td></tr>
                    <tr><th style={thStyle}>利用上限</th><td style={tdStyle}>{formatText(rule.limit)}</td></tr>
                    <tr><th style={thStyle}>費用負担</th><td style={tdStyle}>{formatText(rule.cost)}</td></tr>
                    {rule.cancel && <tr><th style={thStyle}>キャンセル</th><td style={tdStyle}>{formatText(rule.cancel)}</td></tr>}
                    <tr><th style={thStyle}>利用条件</th><td style={tdStyle}>{formatText(rule.conditions)}</td></tr>
                    <tr><th style={thStyle}>禁止事項</th><td style={tdStyle}>{formatText(rule.prohibited)}</td></tr>
                    {rule.remarks && <tr><th style={thStyle}>備考</th><td style={tdStyle}>{formatText(rule.remarks)}</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* ===== 総務ビュー ===== */}
        {activeTab === "admin-view" && role === "admin" && (
          <AdminView allRequests={allRequests} onRefresh={fetchData} router={router} />
        )}

        {/* ===== 部長ビュー (総務から見た部長ビュー・代理承認) ===== */}
        {activeTab === "director-view" && role === "admin" && (
          <AdminProxyView
            allRequests={allRequests}
            approverEmail={DIRECTOR_EMAIL}
            title="部長ビュー（接待利用・総務確認済み案件）"
            onRefresh={fetchData}
            router={router}
          />
        )}

        {/* ===== 事務長ビュー (総務から見た事務長ビュー・代理承認) ===== */}
        {activeTab === "exec-view" && role === "admin" && (
          <AdminProxyView
            allRequests={allRequests}
            approverEmail={EXEC_EMAIL}
            title="事務長ビュー（私的利用・総務確認済み案件）"
            onRefresh={fetchData}
            router={router}
          />
        )}

        {/* ===== 部長ビュー (部長自身) ===== */}
        {activeTab === "director-view" && role === "director" && (
          <ApproverView
            pendingSteps={directorPendingSteps}
            onRefresh={fetchData}
            router={router}
            title="部長承認待ち（接待利用）"
            emptyMessage="現在、承認が必要な接待利用の案件はありません。"
          />
        )}

        {/* ===== 事務長ビュー (事務長自身) ===== */}
        {activeTab === "exec-view" && role === "exec" && (
          <ApproverView
            pendingSteps={execPendingSteps}
            onRefresh={fetchData}
            router={router}
            title="事務長承認待ち（私的利用）"
            emptyMessage="現在、承認が必要な私的利用の案件はありません。"
          />
        )}

        {/* ===== 一般社員の承認ビュー ===== */}
        {activeTab === "approvals" && role === "employee" && (
          <div className={styles.dashboardGrid}>
            <div>
              <section style={{ marginBottom: "2.5rem" }}>
                <h2 className={styles.sectionTitle}>要対応の承認依頼</h2>
                {pendingApprovals.length === 0 ? (
                  <p style={{ color: "#64748b" }}>現在、対応が必要な承認はありません。</p>
                ) : (
                  pendingApprovals.map((step) => (
                    <div key={step.id} className={styles.card} onClick={() => router.push(`/requests/${step.request.id}`)}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span className={`${styles.statusBadge} ${styles.statusPending}`}>確認待ち</span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>{step.request.facilityName}</span>
                      </div>
                      <h3 className={styles.cardTitle}>{step.request.title}</h3>
                      <div className={styles.cardMeta}>
                        <span>申請者: {step.request.applicantEmail}</span>
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
                    <div key={step.id} className={styles.card} onClick={() => router.push(`/requests/${step.request.id}`)} style={{ opacity: 0.8, borderLeftColor: step.status === "APPROVED" ? "#10b981" : "#ef4444" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span className={`${styles.statusBadge} ${step.status === "APPROVED" ? styles.statusApproved : styles.statusRejected}`}>
                          {step.status === "APPROVED" ? "承認済" : "却下"}
                        </span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>{step.request.facilityName}</span>
                      </div>
                      <h3 className={styles.cardTitle}>{step.request.title}</h3>
                      <div className={styles.cardMeta} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>申請者: {step.request.applicantEmail}</span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>時刻: {new Date(step.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>自分の申請状況</h2>
              {myRequests.length === 0 ? (
                <p style={{ color: "#64748b" }}>条件に一致する申請はありません。</p>
              ) : (
                myRequests.map((req) => (
                  <div key={req.id} className={styles.card} onClick={() => router.push(`/requests/${req.id}`)} style={{ borderLeftColor: req.status === "APPROVED" ? "#166534" : req.status === "REJECTED" ? "#991b1b" : "#eab308" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span className={`${styles.statusBadge} ${getStatusClass(req.status, styles)}`}>
                        {req.status === "APPROVED" ? "承認済" : req.status === "REJECTED" ? "却下" : "審査中"}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "bold" }}>{req.facilityName}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{req.title}</h3>
                    <div className={styles.cardMeta}>
                      <span>時刻: {new Date(req.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
