"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../requests.module.css";
import Link from "next/link";
import { CONFIRMATION_TYPES, getTypeLabel, getDateLabel } from "@/lib/requestTypes";
import { facilities, Facility } from "@/lib/facilities";

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
  const [applicantComment, setApplicantComment] = useState("");

  // 福利厚生用のState
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [companions, setCompanions] = useState("");
  const [purpose, setPurpose] = useState("PRIVATE"); // PRIVATE or BUSINESS

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
    } else {
      const qType = searchParams.get("type");
      if (qType) {
        setType(qType);
        if (qType === "FACILITY") {
          const qFacility = searchParams.get("facilityName");
          if (qFacility) {
            const found = facilities.find(f => f.name === qFacility);
            if (found) {
              setSelectedFacility(found);
            }
          }
        }
      }
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
    if (type === "FACILITY") {
      if (!selectedFacility || !startDate || !endDate) {
        alert("必須項目を正しく入力してください");
        return;
      }
    } else if (!title || (!CONFIRMATION_TYPES.includes(type) && amount === "")) {
      alert("必須項目を正しく入力してください");
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", type);

      if (type === "FACILITY") {
        const titleText = `${selectedFacility!.name} 利用申請 (${startDate}〜${endDate})`;
        formData.append("title", titleText);
        formData.append("amount", "0");
        formData.append("facilityName", selectedFacility!.name);
        formData.append("startDate", new Date(startDate).toISOString());
        formData.append("endDate", new Date(endDate).toISOString());
        formData.append("peopleCount", peopleCount.toString());
        if (companions) formData.append("companions", companions);
        formData.append("purpose", purpose);
        if (applicantComment) formData.append("applicantComment", applicantComment);
      } else {
        formData.append("title", title);
        formData.append("amount", CONFIRMATION_TYPES.includes(type) ? "0" : amount.toString());
        if (attachmentLink) formData.append("attachmentLink", attachmentLink);
        if (attachmentFile) formData.append("attachmentFile", attachmentFile);
        if (type === "BUY") {
          formData.append("applicantComment", applicantComment);
        }

        if (type === "REFORM") {
          if (companyName) formData.append("companyName", companyName);
          if (startDate) formData.append("startDate", new Date(startDate).toISOString());
          if (endDate) formData.append("endDate", new Date(endDate).toISOString());
        }
        if (CONFIRMATION_TYPES.includes(type)) {
          if (startDate) formData.append("startDate", new Date(startDate).toISOString());
        }
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
        {type === "FACILITY" ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>申請区分</label>
            <input
              type="text"
              className={styles.input}
              value="福利厚生施設利用申請"
              disabled
            />
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.label}>申請区分</label>
            <select
              className={styles.select}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="BUY">買付承認</option>
              <option value="REFORM">リフォーム承認</option>
              <option value="CONTRACT">仕入契約確認表</option>
              <option value="PURCHASE_SETTLEMENT">仕入決済確認表</option>
              <option value="BROKER_CONTRACT">仲介契約確認表</option>
              <option value="BROKER_SETTLEMENT">仲介決済確認表</option>
              <option value="SELL_CONTRACT">売却契約確認表</option>
              <option value="SELL_SETTLEMENT">売却決済確認表</option>
            </select>
          </div>
        )}

        {type !== "FACILITY" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>申請タイトル（プロジェクト名など）</label>
            <input
              type="text"
              className={styles.input}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`例: ${type === "BUY" ? "港区〇〇ビル 買付" : CONFIRMATION_TYPES.includes(type) ? "〇〇プロジェクト " + getTypeLabel(type) : "港区〇〇ビル 内装リフォーム"}`}
            />
          </div>
        )}

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

        {CONFIRMATION_TYPES.includes(type) && (
          <div className={styles.formGroup}>
            <label className={styles.label}>{getDateLabel(type)}</label>
            <input
              type="date"
              className={styles.input}
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        )}

        {!CONFIRMATION_TYPES.includes(type) && type !== "FACILITY" && (
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
        )}

        {type !== "FACILITY" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>{CONFIRMATION_TYPES.includes(type) ? "添付資料のファイルorフォルダのパス" : "社内サーバーのファイルパス等"}</label>
            <input
              type="text"
              className={styles.input}
              value={attachmentFile}
              onChange={(e) => setAttachmentFile(e.target.value)}
              placeholder="例: Z:\プロジェクト資料\2024\見積書.pdf"
            />
          </div>
        )}
        
        {type === "BUY" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>承認者へのコメント（任意）</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={applicantComment}
              onChange={(e) => setApplicantComment(e.target.value)}
              placeholder="承認者へ伝えたいことがあれば入力してください"
            />
          </div>
        )}

        {type === "FACILITY" && (
          <div style={{ marginTop: "1.5rem", padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
            {!selectedFacility ? (
              <div>
                <label className={styles.label} style={{ fontWeight: "bold", marginBottom: "1rem" }}>利用する施設を選択してください</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
                  {facilities.map((fac) => (
                    <div key={fac.id} className={styles.card} style={{ cursor: "default", padding: "1.25rem", background: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <h3 style={{ margin: "0 0 0.5rem 0", color: "#2563eb", fontSize: "1.1rem" }}>{fac.name}</h3>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "#475569" }}><strong>種別:</strong> {fac.category}</p>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "#475569" }}><strong>所在地:</strong> {fac.location}</p>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "#475569" }}><strong>予約方法:</strong> {fac.bookingMethod}</p>
                      <button 
                        type="button" 
                        className={styles.button} 
                        style={{ marginTop: "1rem", width: "100%", padding: "0.5rem", fontSize: "0.9rem" }}
                        onClick={() => setSelectedFacility(fac)}
                      >
                        選択する
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <h3 style={{ margin: 0, color: "#1e3a8a", fontSize: "1.2rem" }}>{selectedFacility.name} の利用申請</h3>
                  <button 
                    type="button" 
                    className={styles.buttonSecondary} 
                    style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
                    onClick={() => setSelectedFacility(null)}
                  >
                    施設を変更する
                  </button>
                </div>

                <div style={{ display: "flex", gap: "1rem" }} className={styles.formGroup}>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>利用開始日 *</label>
                    <input 
                      type="date" 
                      className={styles.input} 
                      required 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>利用終了日 *</label>
                    <input 
                      type="date" 
                      className={styles.input} 
                      required 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>利用人数 *</label>
                  <input 
                    type="number" 
                    className={styles.input} 
                    min="1" 
                    required 
                    value={peopleCount} 
                    onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)} 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>同伴者氏名（任意・複数の場合は読点区切り）</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={companions} 
                    onChange={(e) => setCompanions(e.target.value)} 
                    placeholder="例: 山田花子、鈴木一郎" 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>利用目的 *</label>
                  <select 
                    className={styles.select} 
                    value={purpose} 
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    <option value="PRIVATE">私的利用</option>
                    <option value="BUSINESS">接待利用（上長承認が必要）</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>備考・追加コメント（任意）</label>
                  <textarea 
                    className={styles.textarea} 
                    rows={4} 
                    value={applicantComment} 
                    onChange={(e) => setApplicantComment(e.target.value)} 
                    placeholder="特記事項があれば入力してください" 
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className={styles.buttonGroup}>
          {(type !== "FACILITY" || selectedFacility) && (
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "送信中..." : "申請する"}
            </button>
          )}
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
