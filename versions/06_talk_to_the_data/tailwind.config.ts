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
        ink: "#1f2933",
        graphite: "#394150",
        surface: "#f7f4ee",
        panel: "#fffdf8",
        saffron: "#d8912b",
        pine: "#26705d",
        berry: "#a03d63",
        sky: "#3276b1",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(31, 41, 51, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
