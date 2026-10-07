import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Better Together",
    short_name: "Together",
    description: "A shared home operating system.",
    start_url: "/",
    display: "standalone",
    background_color: "#F9F6F2",
    theme_color: "#F9F6F2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
