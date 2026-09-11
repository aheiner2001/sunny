import React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="min-w-0">
        <h2 className="sr-only">{title}</h2>
        {subtitle ? <p className="page-sub m-0">{subtitle}</p> : null}
      </div>
      {actions ? <div className="cluster shrink-0">{actions}</div> : null}
    </div>
  );
}
