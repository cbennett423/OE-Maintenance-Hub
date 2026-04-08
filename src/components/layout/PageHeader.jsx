export default function PageHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-cat-yellow rounded-sm" />
        <h2 className="font-display text-xl font-bold uppercase tracking-wider">
          {title}
        </h2>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
