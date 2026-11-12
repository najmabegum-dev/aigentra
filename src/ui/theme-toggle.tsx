"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Dark-first: default to dark unless explicitly set to 'light'
    const storedTheme = localStorage.getItem("theme");
    const isDarkMode = storedTheme ? storedTheme === "dark" : true;

    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-1.5 rounded-[4px] text-text-dim hover:text-text hover:bg-surface-2 border border-line transition-colors duration-150 flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-signal cursor-pointer"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-text" strokeWidth={1.25} />
      ) : (
        <Moon className="w-4 h-4 text-text" strokeWidth={1.25} />
      )}
    </button>
  );
}
