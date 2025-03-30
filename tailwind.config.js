/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class", // Enables class-based dark mode
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
      extend: {
        colors: {
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: "hsl(var(--primary))",
          secondary: "hsl(var(--secondary))",
          muted: "hsl(var(--muted))",
          accent: "hsl(var(--accent))",
          destructive: "hsl(var(--destructive))",
          success: "hsl(var(--success))",
          border: "hsl(var(--border))",
        },
        borderRadius: {
          DEFAULT: "var(--color-radius)",
        },
      },
    },
    plugins: [],
  };
  