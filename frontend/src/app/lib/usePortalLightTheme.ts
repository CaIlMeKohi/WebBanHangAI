import { useLayoutEffect } from "react";

export function usePortalLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const hadDarkTheme = root.classList.contains("dark");
    const hadLightTheme = root.classList.contains("light");
    const previousColorScheme = root.style.colorScheme;

    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";

    return () => {
      root.classList.remove("light", "dark");
      if (hadDarkTheme) root.classList.add("dark");
      if (hadLightTheme) root.classList.add("light");
      root.style.colorScheme = previousColorScheme;
    };
  }, []);
}
