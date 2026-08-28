import React from 'react';

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <div className="empty-title">{title}</div>
      <p>{children}</p>
      {action}
    </div>
  );
}
