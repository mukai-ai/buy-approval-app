"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { DRIVE_PATH_PATTERN, cleanDrivePath, parseDrivePath } from "@/lib/drivePath";

type Resolved =
  | { status: "loading" }
  | { status: "ok"; url: string; isFolder: boolean; ambiguous?: boolean }
  | { status: "not_found" | "need_login" | "error" };

// 1つのパスの横に「Driveで開く」リンクを出す（パスの文字はそのまま残す）
function DrivePathLink({ path }: { path: string }) {
  const [resolved, setResolved] = useState<Resolved>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/drive/resolve?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => !cancelled && setResolved(data?.status ? data : { status: "error" }))
      .catch(() => !cancelled && setResolved({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  const linkStyle = {
    display: "inline-block",
    marginTop: "0.35rem",
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };

  if (resolved.status === "loading") {
    return <span style={{ ...linkStyle, color: "#94a3b8", padding: "0.35rem 0" }}>Driveのリンクを確認中…</span>;
  }
  if (resolved.status === "ok") {
    return (
      <a href={resolved.url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
        {resolved.ambiguous
          ? "🔍 Driveで探す（同名の候補が複数）"
          : resolved.isFolder
            ? "📁 Driveでフォルダを開く"
            : "📄 Driveでファイルを開く"}
      </a>
    );
  }
  if (resolved.status === "need_login") {
    return (
      <button
        type="button"
        onClick={() => signIn("google", undefined, { prompt: "select_account" })}
        style={{ ...linkStyle, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", cursor: "pointer" }}
      >
        🔑 Driveリンクを使うには再ログイン
      </button>
    );
  }
  return <span style={{ ...linkStyle, color: "#94a3b8", padding: "0.35rem 0", fontWeight: 400 }}>（Drive上で見つかりませんでした）</span>;
}

// スマホ（幅768px以下、またはタッチ操作のみの端末）かどうか。PCではG:ドライブのパスがそのまま使えるのでリンクは出さない
const MOBILE_QUERY = "(max-width: 768px), (hover: none) and (pointer: coarse)";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// 文中の「G:\共有ドライブ\...」をパス＋Driveリンクに置き換えて表示する（リンクはスマホのみ）
export default function DrivePathText({ text }: { text: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(DRIVE_PATH_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (!parseDrivePath(raw)) continue;
    if (start > last) nodes.push(text.slice(last, start));
    const path = cleanDrivePath(raw);
    nodes.push(
      <span key={start} style={{ display: "block", margin: "0.15rem 0" }}>
        <span style={{ wordBreak: "break-all" }}>{raw}</span>
        <br />
        <DrivePathLink path={path} />
      </span>
    );
    last = start + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
