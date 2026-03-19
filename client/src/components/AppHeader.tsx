export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 backdrop-blur-sm bg-gradient-to-b from-background/80 to-transparent">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
          <span className="tracking-[-0.02em] opacity-50 text-[13px]">Adobe Stock Uploader</span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] opacity-30 cursor-default"
            disabled
            title="Coming soon"
          >
            About
          </button>
          <button
            className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] opacity-30 cursor-default"
            disabled
            title="Coming soon"
          >
            Help
          </button>
        </div>
      </div>
    </header>
  );
}
