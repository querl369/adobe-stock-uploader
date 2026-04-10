import { useState, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ProcessingBatch {
  id: string;
  image_count: number;
  status: string;
  csv_filename: string | null;
  created_at: string;
}

export function History() {
  const { user, session } = useAuth();
  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .from('processing_batches')
      .select('id, image_count, status, csv_filename, created_at')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load history');
        } else if (data) {
          setBatches(data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load history');
        setIsLoading(false);
      });
  }, [user]);

  const handleDownload = async (batchId: string, csvFilename: string | null) => {
    if (!supabase) {
      toast.error('Service unavailable');
      return;
    }

    setDownloadingId(batchId);

    try {
      const response = await fetch(`/api/download-csv/${batchId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('This CSV is no longer available');
        } else {
          toast.error('Download failed');
        }
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = csvFilename || 'metadata.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin mx-auto" />
          <p className="opacity-40 tracking-[-0.01em] text-[0.875rem]">Loading history...</p>
        </div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
            History
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
            No sessions yet. Process some images!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h2 className="tracking-[-0.02em] text-[1.5rem] font-medium">History</h2>
        <p className="opacity-40 tracking-[-0.01em] text-[0.875rem]">
          Your recent metadata generation sessions
        </p>
      </div>

      <div className="space-y-3">
        {batches.map(batch => (
          <button
            key={batch.id}
            onClick={() => handleDownload(batch.id, batch.csv_filename)}
            disabled={downloadingId === batch.id}
            className="w-full group grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 hover:border-border/40 rounded-2xl p-4 flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] text-left overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-foreground/50 group-hover:bg-black group-hover:text-white transition-colors duration-300 shrink-0">
                <FileText size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="tracking-[-0.01em] font-medium text-[0.95rem]">
                  Session &mdash; {formatDate(batch.created_at)}
                </h3>
                <div className="flex items-center gap-2 opacity-40 text-[0.75rem] tracking-[-0.01em]">
                  <span>{formatDate(batch.created_at)}</span>
                  <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                  <span>{formatTime(batch.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 relative z-10">
              <div className="text-right hidden sm:block">
                <span className="block tracking-[-0.01em] font-medium text-[0.95rem]">
                  {batch.image_count}
                </span>
                <span className="block opacity-40 text-[0.75rem] tracking-[-0.01em]">images</span>
              </div>
              <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-300 shrink-0 bg-white">
                {downloadingId === batch.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
