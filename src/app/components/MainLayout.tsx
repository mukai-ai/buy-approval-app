"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import styles from "../dashboard.module.css";
import { ReactNode } from "react";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // ログイン状態を検証している最中（初回ロード時のみ）
  if (status === "loading" && !session) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f1f5f9", fontFamily: "sans-serif", color: "#64748b" }}>
        読み込み中...
      </div>
    );
  }

  // 未ログイン時の表示
  if (status === "unauthenticated") {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 style={{ marginBottom: "1rem", color: "#2563eb" }}>承認ワークフロー</h1>
          <p style={{ color: "#64748b", marginBottom: "2rem", lineHeight: "1.6" }}>
            システムを利用するにはGoogleアカウント<br />でログインしてください。
          </p>
          <button className={styles.button} onClick={() => signIn("google", undefined, { prompt: "select_account" })}>
            Googleでログイン
          </button>
          
          <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>開発環境用ログインはこちら</p>
            <a 
              href="/api/auth/signin" 
              style={{ fontSize: "0.85rem", color: "#2563eb", textDecoration: "underline", fontWeight: "bold" }}
            >
              Local Login 画面へ
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ログイン済みの場合は、共通サイドバー ＋ 右側コンテンツを表示
  const isWelfare = pathname ? pathname.startsWith("/welfare") : false;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Sidebar (黄色枠固定) */}
      <aside style={{ width: "260px", background: "white", borderRight: "1px solid #e2e8f0", padding: "2rem 1rem", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: "bold", color: "#1e293b", fontSize: "1.2rem", marginBottom: "2rem", paddingLeft: "0.5rem" }}>
            システムメニュー
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button 
              onClick={() => router.push("/")}
              style={{ 
                textAlign: "left", 
                padding: "0.85rem 1rem", 
                background: !isWelfare ? "#eff6ff" : "transparent", 
                color: !isWelfare ? "#2563eb" : "#64748b", 
                borderRadius: "8px", 
                fontWeight: "bold", 
                border: "none", 
                cursor: "pointer", 
                fontSize: "0.95rem",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => {
                if (isWelfare) e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseOut={(e) => {
                if (isWelfare) e.currentTarget.style.background = "transparent";
              }}
            >
              🏠 ホーム(ダッシュボード)
            </button>
            <button 
              onClick={() => router.push("/")}
              style={{ 
                textAlign: "left", 
                padding: "0.85rem 1rem", 
                background: !isWelfare ? "#eff6ff" : "transparent", 
                color: !isWelfare ? "#2563eb" : "#64748b", 
                borderRadius: "8px", 
                fontWeight: "bold", 
                border: "none", 
                cursor: "pointer", 
                fontSize: "0.95rem",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => {
                if (isWelfare) e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseOut={(e) => {
                if (isWelfare) e.currentTarget.style.background = "transparent";
              }}
            >
              ✅ 承認ワークフロー
            </button>
            <button 
              onClick={() => router.push("/welfare")}
              style={{ 
                textAlign: "left", 
                padding: "0.85rem 1rem", 
                background: isWelfare ? "#eff6ff" : "transparent", 
                color: isWelfare ? "#2563eb" : "#64748b", 
                borderRadius: "8px", 
                fontWeight: "bold", 
                border: "none", 
                cursor: "pointer", 
                fontSize: "0.95rem", 
                transition: "background 0.2s", 
                lineHeight: "1.4" 
              }}
              onMouseOver={(e) => {
                if (!isWelfare) e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseOut={(e) => {
                if (!isWelfare) e.currentTarget.style.background = "transparent";
              }}
            >
              🏢 福利厚生施設利用<br />　 ワークフロー
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content (青枠部分) */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
