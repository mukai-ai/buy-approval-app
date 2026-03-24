"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../requests.module.css";
import Link from "next/link";

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("BUY"); // "BUY" or "REFORM"
  const [title, setTitle] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attachmentLink, setAttachmentLink] = useState("");
  const [attachmentFile, setAttachmentFile] = useState("");

  useEffect(() => {
    // 再申請（コピー）時のパラメータ読み込み
    const copyId = searchParams.get("copy");
    if (copyId) {
      setType(searchParams.get("type") || "BUY");
      setTitle(`${searchParams.get("title")}（再申請）`);
      const amt = searchParams.get("amount");
      if (amt) {
        setAmount(Number(amt));
        setInputValue(amt); // 初期値としてセット
      }
      setCompanyName(searchParams.get("companyName") || "");
      setAttachmentLink(searchParams.get("attachmentLink") || "");
      setAttachmentFile(searchParams.get("attachmentFile") || "");
    }
  }, [searchParams]);

  // 日本語単位のパースロジック
  const handleAmountChange = (val: string) => {
    setInputValue(val);
    
    // 全角半角の正規化、カンマ削除、単位の変換
    let normalized = val.trim().replace(/,/g, '').replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!normalized) {
      setAmount("");
      return;
    }
    
    let match = normalized.match(/^(\d+(?:\.\d+)?)\s*([万|億|w|W])?$/);
    if (!match) {
      const num = parseFloat(normalized);
      setAmount(isNaN(num) ? "" : num);
      return;
    }

    let numValue = parseFloat(match[1]);
    let unit = match[2];

    if (unit === "万" || unit === "w" || unit === "W") numValue *= 10000;
    if (unit === "億") numValue *= 100000000;

    setAmount(numValue);
  };

  const formatToJapanese = (num: number | ""): string => {
    if (num === "" || isNaN(num)) return "";
    if (num === 0) return "0円";
    
    const oku = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const nokori = num % 10000;

    let result = "";
    if (oku > 0) result += `${oku.toLocaleString()}億`;
    if (man > 0) result += `${man.toLocaleString()}万`;
    if (nokori > 0) result += `${nokori.toLocaleString()}`;
    
    return result + "円";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount === "") {
      alert("金額を正しく入力してください");
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("title", title);
      formData.append("amount", amount.toString());
      if (attachmentLink) formData.append("attachmentLink", attachmentLink);
      if (attachmentFile) formData.append("attachmentFile", attachmentFile);

      if (type === "REFORM") {
        if (companyName) formData.append("companyName", companyName);
        if (startDate) formData.append("startDate", new Date(startDate).toISOString());
        if (endDate) formData.append("endDate", new Date(endDate).toISOString());
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        body: formData,
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
          <div style={{ position: "relative" }}>
            <input
              type="text"
              className={styles.input}
              required
              value={inputValue}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="例: 1500万 または 15000000"
            />
            {amount !== "" && (
              <div style={{
                marginTop: "0.5rem",
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#166534",
                padding: "0.5rem",
                backgroundColor: "#f0fdf4",
                borderRadius: "4px",
                border: "1px solid #bbf7d0"
              }}>
                プレビュー: {formatToJapanese(amount)} ({amount.toLocaleString()}円)
              </div>
            )}
          </div>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
            ※「万」や「億」を使った入力も可能です（例：1500万）。
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>参照リンク（Googleドライブ等）</label>
          <input
            type="url"
            className={styles.input}
            value={attachmentLink}
            onChange={(e) => setAttachmentLink(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>社内サーバーのファイルパス等</label>
          <input
            type="text"
            className={styles.input}
            value={attachmentFile}
            onChange={(e) => setAttachmentFile(e.target.value)}
            placeholder="例: Z:\プロジェクト資料\2024\見積書.pdf"
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

export default function NewRequestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewRequestForm />
    </Suspense>
  );
}
