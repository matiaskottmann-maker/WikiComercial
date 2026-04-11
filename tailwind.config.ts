import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "uc-blue": "#003F8A",
        "uc-blue-light": "#0055B8",
        "uc-blue-dark": "#002D63",
      },
    },
  },
  plugins: [],
};
export default config;
