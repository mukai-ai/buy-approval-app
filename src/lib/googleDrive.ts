import prisma from "@/lib/prisma";
import { parseDrivePath, ParsedDrivePath } from "@/lib/drivePath";

// ファイル名・フォルダ構成の閲覧のみ（ファイルの中身は読めない）
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type ResolveResult =
  | { status: "ok"; url: string; isFolder: boolean; ambiguous?: boolean }
  | { status: "not_found" }
  | { status: "need_login" }
  | { status: "error" };

type DriveFile = {
  id: string;
  name: string;
  parents?: string[];
  driveId?: string;
  mimeType?: string;
  webViewLink?: string;
};

class NeedLoginError extends Error {}

// 閲覧者のGoogleアクセストークンを取得（期限切れならリフレッシュしてDBも更新）
async function getAccessToken(email: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { provider: "google", user: { email } },
  });
  if (!account?.access_token || !account.scope?.includes(DRIVE_SCOPE)) {
    throw new NeedLoginError();
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token;
  }
  if (!account.refresh_token) throw new NeedLoginError();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Google token refresh failed:", res.status, await res.text());
    throw new NeedLoginError();
  }
  const data = await res.json();
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: now + (data.expires_in || 3600),
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  });
  return data.access_token;
}

async function driveGet(token: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ supportsAllDrives: "true", ...params });
  const res = await fetch(`${DRIVE_API}/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    // 権限不足（スコープ未付与）は再ログインで解決、個別ファイルの403は見つからない扱い
    if (res.status === 401 || body.includes("insufficient")) throw new NeedLoginError();
    return null;
  }
  if (!res.ok) return null;
  return res.json();
}

const sameName = (a: string, b: string) => a.normalize("NFC").trim() === b.normalize("NFC").trim();
const escapeQ = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findByPath(
  token: string,
  parsed: ParsedDrivePath
): Promise<{ file: DriveFile; ambiguous: boolean } | null> {
  const segments = parsed.segments;
  const leafName = segments[segments.length - 1];

  // 末端の名前で候補を探し、親フォルダを1つずつさかのぼってパスと一致するか確かめる
  const list = await driveGet(token, "files", {
    q: `name = '${escapeQ(leafName)}' and trashed = false`,
    corpora: parsed.kind === "shared" ? "allDrives" : "user",
    includeItemsFromAllDrives: "true",
    pageSize: "100",
    fields: "files(id,name,parents,driveId,mimeType,webViewLink)",
  });
  const candidates: DriveFile[] = list?.files || [];

  const cache = new Map<string, DriveFile | null>();
  const getFile = async (id: string): Promise<DriveFile | null> => {
    if (!cache.has(id)) {
      cache.set(id, await driveGet(token, `files/${id}`, { fields: "id,name,parents,driveId" }));
    }
    return cache.get(id) || null;
  };

  let myDriveRootId: string | null = null;
  if (parsed.kind === "my") {
    myDriveRootId = (await getFile("root"))?.id || null;
    if (!myDriveRootId) return null;
  }

  const matches: DriveFile[] = [];
  for (const candidate of candidates) {
    let cur: DriveFile | null = candidate;
    for (let i = segments.length - 2; i >= 0 && cur; i--) {
      const parentId: string | undefined = cur.parents?.[0];
      const parent: DriveFile | null = parentId ? await getFile(parentId) : null;
      cur = parent && sameName(parent.name, segments[i]) ? parent : null;
    }
    if (!cur) continue;

    const topParent = cur.parents?.[0];
    if (parsed.kind === "my") {
      if (topParent === myDriveRootId) return { file: candidate, ambiguous: false };
      continue;
    }

    // 共有ドライブ直下にあるか。
    // 共有ドライブ名は drive.metadata.readonly では取れない（ルートの名前は「ドライブ」になる）ため照合しない
    if (cur.driveId && topParent === cur.driveId) matches.push(candidate);
  }

  if (matches.length === 0) return null;
  // 別々の共有ドライブに同じパスがあると、どれがパスの共有ドライブか判別できない
  const ambiguous = new Set(matches.map((f) => f.driveId)).size > 1;
  return { file: matches[0], ambiguous };
}

// 同じ人が同じパスを何度も開いたときにDrive APIを叩きすぎないよう、結果を少しの間覚えておく
const resultCache = new Map<string, { at: number; result: ResolveResult }>();
const CACHE_MS = 10 * 60 * 1000;

export async function resolveDrivePath(email: string, rawPath: string): Promise<ResolveResult> {
  const parsed = parseDrivePath(rawPath);
  if (!parsed) return { status: "not_found" };

  const key = `${email}|${rawPath}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;

  try {
    const token = await getAccessToken(email);
    const found = await findByPath(token, parsed);
    const file = found?.file;
    const result: ResolveResult = !file
      ? { status: "not_found" }
      : found.ambiguous
        ? {
            status: "ok",
            isFolder: file.mimeType === FOLDER_MIME,
            ambiguous: true,
            url: `https://drive.google.com/drive/search?q=${encodeURIComponent(file.name)}`,
          }
        : {
            status: "ok",
            isFolder: file.mimeType === FOLDER_MIME,
            url:
              file.webViewLink ||
              (file.mimeType === FOLDER_MIME
                ? `https://drive.google.com/drive/folders/${file.id}`
                : `https://drive.google.com/file/d/${file.id}/view`),
          };
    resultCache.set(key, { at: Date.now(), result });
    return result;
  } catch (error) {
    if (error instanceof NeedLoginError) return { status: "need_login" };
    console.error("resolveDrivePath failed:", error);
    return { status: "error" };
  }
}
