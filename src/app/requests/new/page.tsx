"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../requests.module.css";
import Link from "next/link";

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("BUY"); // "BUY" or "REFORM"
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attachmentLink, setAttachmentLink] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // 再申請（コピー）時のパラメータ読み込み
    const copyId = searchParams.get("copy");
    if (copyId) {
      setType(searchParams.get("type") || "BUY");
      setTitle(`${searchParams.get("title")}（再申請）`);
      const amt = searchParams.get("amount");
      if (amt) setAmount(Number(amt));
      setCompanyName(searchParams.get("companyName") || "");
      setAttachmentLink(searchParams.get("attachmentLink") || "");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount === "") {
      alert("必須項目を入力してください");
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("title", title);
      formData.append("amount", amount.toString());
      if (attachmentLink) formData.append("attachmentLink", attachmentLink);
      if (file) formData.append("file", file);

      if (type === "REFORM") {
        if (companyName) formData.append("companyName", companyName);
        if (startDate) formData.append("startDate", new Date(startDate).toISOString());
        if (endDate) formData.append("endDate", new Date(endDate).toISOString());
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        body: formData, // FormDataをそのまま送る
      });

      if (res.ok) {
        alert("申請が完了しました！");
        router.push("/");
      } else {
        const err = await res.json();
        alert(`エラーが発生しました: ${err.error || "詳細不明"}`);
      }
    } catch (error) {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>新規承認申請</h1>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>申請区分</label>
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="BUY">買付承認</option>
            <option value="REFORM">リフォーム承認</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>申請タイトル（プロジェクト名など）</label>
          <input
            type="text"
            className={styles.input}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`例: ${type === "BUY" ? "港区〇〇ビル 買付" : "港区〇〇ビル 内装リフォーム"}`}
          />
        </div>

        {type === "REFORM" && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>業者名</label>
              <input
                type="text"
                className={styles.input}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例: 株式会社〇〇工務店"
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

        <div className={styles.formGroup}>
          <label className={styles.label}>金額（円）</label>
          <input
            type="number"
            className={styles.input}
            required
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            placeholder="例: 15000000"
          />
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
            ※金額によって承認フローが自動的に決定されます。
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>添付資料（外部のリンク等がある場合）</label>
          <input
            type="url"
            className={styles.input}
            value={attachmentLink}
            onChange={(e) => setAttachmentLink(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>添付ファイル（PCからアップロード）</label>
          <input
            type="file"
            className={styles.input}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "送信中..." : "申請する"}
          </button>
          <Link href="/">
            <button type="button" className={styles.buttonSecondary}>キャンセル</button>
          </Link>
        </div>
      </form>
    </div>
  );
}
