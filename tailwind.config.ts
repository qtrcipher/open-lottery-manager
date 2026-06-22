import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        paper: "#f7f4ed",
        line: "#d9d2c3",
        moss: "#3f6f5f",
        gold: "#c7922b",
        brick: "#9e4f3f"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(23, 32, 38, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
