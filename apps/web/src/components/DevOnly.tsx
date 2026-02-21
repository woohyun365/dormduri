interface DevOnlyProps {
  children: React.ReactNode;
}

export function DevOnly({ children }: DevOnlyProps) {
  if (process.env.NODE_ENV !== 'development') return null;

  return <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">{children}</div>;
}
