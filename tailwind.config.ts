import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        line: "#d8dee8",
        paper: "#f7f9fc",
        brand: "#1752a6"
      }
    }
  },
  plugins: []
};

export default config;
