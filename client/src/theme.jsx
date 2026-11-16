import { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

const ThemeCtx = createContext({ theme: 'light', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('inboxly_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (user?.themePreference && (user.themePreference === 'dark' || user.themePreference === 'light')) {
      setTheme(user.themePreference);
    }
  }, [user?.themePreference]);

  useEffect(() => {
    localStorage.setItem('inboxly_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      try {
        await api.patch('/admin/preferences', { themePreference: next });
      } catch {
        // Keep local change if network fails
      }
    }
  };

  return <ThemeCtx.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white p-2 text-[#73706D] transition hover:border-[#D4D4D8] hover:text-[#171717] ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4 text-[#F59E0B]" /> : <Moon className="h-4 w-4 text-[#6366F1]" />}
    </button>
  );
}
