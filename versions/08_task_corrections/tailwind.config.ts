import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        graphite: "#374151",
        surface: "#ffffff",
        panel: "#ffffff",
        saffron: "#1f3cff",
        pine: "#1f3cff",
        berry: "#a03d63",
        sky: "#1f3cff",
      },
      boxShadow: {
        soft: "0 18px 46px rgba(31, 60, 255, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
