interface ResultsViewProps {
  onProcessMore: () => void;
}

export function ResultsView({ onProcessMore }: ResultsViewProps) {
  return (
    <div className="w-full max-w-3xl px-4 text-center space-y-6">
      <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-8 space-y-4">
        <div className="text-[1.25rem] tracking-[-0.02em] opacity-90">Processing Complete</div>
        <p className="tracking-[-0.01em] opacity-50 text-[0.9rem]">
          Your CSV file has been downloaded.
        </p>
        <button
          onClick={onProcessMore}
          className="grain-gradient px-8 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group"
        >
          <span className="relative z-10">Process More Images</span>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
