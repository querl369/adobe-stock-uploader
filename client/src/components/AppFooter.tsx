export function AppFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 px-8 py-6 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span className="tracking-[-0.01em] opacity-25 text-[11px]">
          &copy; {new Date().getFullYear()}
        </span>
        <div className="flex gap-6">
          <button
            className="tracking-[-0.01em] opacity-30 transition-opacity text-[11px] cursor-default"
            disabled
            title="Coming soon"
          >
            GitHub
          </button>
          <button
            className="tracking-[-0.01em] opacity-30 transition-opacity text-[11px] cursor-default"
            disabled
            title="Coming soon"
          >
            Twitter
          </button>
        </div>
      </div>
    </footer>
  );
}
