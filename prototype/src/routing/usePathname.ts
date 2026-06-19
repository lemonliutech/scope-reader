import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(fullPath: string): string {
  return fullPath.startsWith(BASE) ? fullPath.slice(BASE.length) || "/" : fullPath;
}

function resolveInitialPath(): string {
  // GitHub Pages SPA: 404.html redirects /scope-reader/library → /scope-reader/?p=/library
  const redirected = new URLSearchParams(window.location.search).get("p");
  if (redirected) {
    const restored = BASE + redirected;
    window.history.replaceState({}, "", restored);
    return redirected;
  }
  return stripBase(window.location.pathname);
}

export function usePathname() {
  const [pathname, setPathname] = useState(resolveInitialPath);

  useEffect(() => {
    const onPopState = (): void => setPathname(stripBase(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPath: string): void => {
    const fullPath = BASE + nextPath;
    if (fullPath === window.location.pathname) return;
    window.history.pushState({}, "", fullPath);
    setPathname(nextPath);
  };

  return { pathname, navigate };
}
