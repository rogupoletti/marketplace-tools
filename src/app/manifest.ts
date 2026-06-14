import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Seller Dock",
        short_name: "Seller Dock",
        description: "Ferramentas operacionais para vendedores de marketplace.",
        start_url: "/returns/mobile",
        display: "standalone",
        background_color: "#f5f7fa",
        theme_color: "#2563eb",
        icons: [
            {
                src: "/favicon.png",
                sizes: "any",
                type: "image/png",
            },
        ],
    };
}
