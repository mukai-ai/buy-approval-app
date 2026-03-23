"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../requests.module.css";

export default function ActionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "APPROVED" | "REJECTED") => {
    if (action === "REJECTED" && !comment.trim()) {
      alert("却下する場合はコメント（理由）を入力してください。");
      return;
    }
    
    if (!confirm(action === "APPROVED" ? "この申請を承認しますか？" : "この申請を却下しますか？")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (res.ok) {
        alert(action === "APPROVED" ? "承認しました" : "却下しました");
        router.refresh(); 
      } else {
        const err = await res.json();
        alert(`エラーが発生しました: ${err.error}`);
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "2rem", padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "white", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)" }}>
      <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#0f172a" }}>承認アクション</h3>
      <textarea
        className={styles.textarea}
        rows={3}
        placeholder="承認コメントや却下理由を入力してください（任意、ただし却下時は必須）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginBottom: "1rem" }}
      />
      <div style={{ display: "flex", gap: "1rem" }}>
        <button className={styles.buttonApprove} onClick={() => handleAction("APPROVED")} disabled={loading}>
          {loading ? "処理中..." : "✓ 承認する"}
        </button>
        <button className={styles.buttonReject} onClick={() => handleAction("REJECTED")} disabled={loading}>
          {loading ? "処理中..." : "✗ 却下する"}
        </button>
      </div>
    </div>
  );
}
