import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
