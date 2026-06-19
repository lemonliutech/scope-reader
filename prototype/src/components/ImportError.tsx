import { useEffect, useRef } from "react";
import type { ScopeIssue } from "../domain/scopeError";

type ImportErrorProps = { issues: ScopeIssue[] };

export function ImportError({ issues }: ImportErrorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const blocking = issues.filter((i) => i.blocking);
  const warnings = issues.filter((i) => !i.blocking);

  useEffect(() => {
    if (blocking.length > 0) ref.current?.focus();
  }, [blocking.length]);

  if (issues.length === 0) return null;

  return (
    <div className="import-error-container">
      {blocking.length > 0 && (
        <section
          ref={ref}
          className="import-error import-error--blocking"
          role="alert"
          tabIndex={-1}
        >
          <h2>导入失败</h2>
          {blocking.map((issue) => (
            <div key={issue.code} className="import-error-item">
              <h3>{issue.userMessage}</h3>
              <p>{issue.suggestion}</p>
              <code>{issue.code}</code>
            </div>
          ))}
        </section>
      )}
      {warnings.length > 0 && (
        <section className="import-error import-error--warning" role="status">
          <h2>导入警告</h2>
          {warnings.map((issue) => (
            <div key={issue.code} className="import-error-item">
              <h3>{issue.userMessage}</h3>
              <p>{issue.suggestion}</p>
              <code>{issue.code}</code>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
