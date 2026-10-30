import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages project site: https://wsmacin.github.io/srez/
export default defineConfig({
  plugins: [react()],
  base: "/srez/",
});
