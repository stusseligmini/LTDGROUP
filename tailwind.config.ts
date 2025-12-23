import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "cyan-primary": "var(--cyan-primary)",
        "cyan-secondary": "var(--cyan-secondary)",
        "cyan-accent": "var(--cyan-accent)",
        "purple-glow": "var(--purple-glow)",
        "purple-accent": "var(--purple-accent)",
        "dark-surface": "var(--dark-surface)",
        "dark-card": "var(--dark-card)",
        "dark-border": "var(--dark-border)",
      },
      boxShadow: {
        "neon": "var(--neon-glow)",
        "neon-xs": "0 0 2px #0af5d3, 0 0 4px rgba(10, 245, 211, 0.2)",
        "neon-sm": "0 0 5px #0af5d3, 0 0 10px rgba(10, 245, 211, 0.3)",
        "neon-lg": "0 0 15px #0af5d3, 0 0 30px rgba(10, 245, 211, 0.5)",
        "neon-purple": "var(--neon-purple-glow)",
        "neon-purple-xs": "0 0 2px #e31aff, 0 0 4px rgba(227, 26, 255, 0.2)",
        "neon-purple-sm": "0 0 5px #e31aff, 0 0 10px rgba(227, 26, 255, 0.3)",
        "neon-purple-lg": "0 0 15px #e31aff, 0 0 30px rgba(227, 26, 255, 0.5)",
      },
      textShadow: {
        "neon": "var(--neon-text-shadow)",
        "neon-purple": "var(--neon-purple-text-shadow)",
      },
      animation: {
        "neon-pulse": "neonPulse 2s infinite",
        "neon-border": "neonBorder 3s infinite",
        "gradient-flow": "gradientBackground 15s ease infinite",
        "scanline": "scanline 3s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    // Plugin for text shadow
    function ({ addUtilities }: { addUtilities: any }) {
      const newUtilities = {
        ".text-shadow-neon": {
          textShadow: "0 0 5px rgba(10, 245, 211, 0.8), 0 0 10px rgba(10, 245, 211, 0.4)",
        },
        ".text-shadow-neon-purple": {
          textShadow: "0 0 5px rgba(227, 26, 255, 0.8), 0 0 10px rgba(227, 26, 255, 0.4)",
        },
        ".text-shadow-neon-duo": {
          textShadow: "0 0 5px rgba(10, 245, 211, 0.7), 0 0 15px rgba(227, 26, 255, 0.7)",
        },
        ".text-shadow-none": {
          textShadow: "none",
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
export default config;