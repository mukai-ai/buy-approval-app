// 社内サーバー（Google Drive for desktop の G: ドライブ）のパス表記を扱うユーティリティ
// 画面側・サーバー側の両方から使う

// 文中から「G:\...」形式のパスを探す。引用符で囲まれていればその中だけ、無ければ行末まで
export const DRIVE_PATH_PATTERN = /["“「]?[A-Za-z]:\\[^\r\n"”」<>|?*]*["”」]?/g;

const SHARED_DRIVE_ROOTS = ["共有ドライブ", "shared drives"];
const MY_DRIVE_ROOTS = ["マイドライブ", "my drive"];

export type ParsedDrivePath =
  | { kind: "shared"; driveName: string; segments: string[] }
  | { kind: "my"; segments: string[] };

// 前後の引用符・空白・句読点を落とした表示用のパス
export const cleanDrivePath = (raw: string) =>
  raw.trim().replace(/^["“「]+/, "").replace(/["”」]+$/, "").replace(/[\s。、，,.]+$/, "");

export function parseDrivePath(raw: string): ParsedDrivePath | null {
  const path = cleanDrivePath(raw).replace(/\//g, "\\");
  const m = path.match(/^[A-Za-z]:\\(.+)$/);
  if (!m) return null;
  const parts = m[1].split("\\").map((p) => p.trim().normalize("NFC")).filter(Boolean);
  if (parts.length === 0) return null;

  const root = parts[0].toLowerCase();
  if (SHARED_DRIVE_ROOTS.includes(root)) {
    if (parts.length < 3) return null; // 共有ドライブ名の直下まで無いとフォルダを特定できない
    return { kind: "shared", driveName: parts[1], segments: parts.slice(2) };
  }
  if (MY_DRIVE_ROOTS.includes(root)) {
    if (parts.length < 2) return null;
    return { kind: "my", segments: parts.slice(1) };
  }
  return null;
}
