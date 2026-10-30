/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image は使っていないため、画像最適化API（/_next/image）を無効にして攻撃面を減らす
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 他サイトへの埋め込みを禁止（承認ボタンを押させるクリックジャッキング対策）
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
