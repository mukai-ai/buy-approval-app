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
  // スマホ幅ではサイドバーを上部の横並びメニューに切り替える（dashboard.module.css の .shell 系）
  const isWelfare = pathname ? pathname.startsWith("/welfare") : false;
  const navClass = (active: boolean) =>
    `${styles.shellNavBtn} ${active ? styles.shellNavBtnActive : ""}`;

  return (
    <div className={styles.shell}>
      {/* Sidebar (黄色枠固定) */}
      <aside className={styles.shellSide}>
        <div className={styles.shellSideTitle}>システムメニュー</div>
        <nav className={styles.shellNav}>
          <button onClick={() => router.push("/")} className={navClass(!isWelfare)}>
            🏠 <span className={styles.shellNavLabel}>ホーム(ダッシュボード)</span>
            <span className={styles.shellNavLabelShort}>ホーム</span>
          </button>
          <button onClick={() => router.push("/")} className={navClass(!isWelfare)}>
            ✅ <span className={styles.shellNavLabel}>承認ワークフロー</span>
            <span className={styles.shellNavLabelShort}>承認</span>
          </button>
          <button onClick={() => router.push("/welfare")} className={navClass(isWelfare)}>
            🏢 <span className={styles.shellNavLabel}>福利厚生施設利用<br />　 ワークフロー</span>
            <span className={styles.shellNavLabelShort}>福利厚生</span>
          </button>
        </nav>
      </aside>

      {/* Main Content (青枠部分) */}
      <div className={styles.shellMain}>
        {children}
      </div>
    </div>
  );
}
