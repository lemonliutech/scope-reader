import { useEffect, useState } from "react";

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = (): void => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPath: string): void => {
    if (nextPath === window.location.pathname) return;
    window.history.pushState({}, "", nextPath);
    setPathname(nextPath);
  };

  return { pathname, navigate };
}
