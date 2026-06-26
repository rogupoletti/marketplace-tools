import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dash",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/cadastros",
        destination: "/catalog",
        permanent: false,
      },
      {
        source: "/reposicao-full",
        destination: "/full-replenishment/meli",
        permanent: false,
      },
      {
        source: "/reposicao-full/:path*",
        destination: "/full-replenishment/:path*",
        permanent: false,
      },
      {
        source: "/shopee",
        destination: "/calculators/shopee",
        permanent: false,
      },
      {
        source: "/meli",
        destination: "/calculators/meli",
        permanent: false,
      },
      {
        source: "/amazon",
        destination: "/calculators/amazon",
        permanent: false,
      },
      {
        source: "/api/cadastros/:path*",
        destination: "/api/catalog/:path*",
        permanent: false,
      },
      {
        source: "/api/reposicao-full/:path*",
        destination: "/api/full-replenishment/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
