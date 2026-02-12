export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-svh overflow-hidden bg-background dark">
      <main className="relative m-2 flex min-w-0 w-auto flex-1 flex-col overflow-hidden rounded-xl shadow-sm h-[calc(100svh-1rem)]">
        {children}
      </main>
    </div>
  )
}
