import { Link, Navigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export function Billing() {
  const { user } = useAuth();

  if (import.meta.env.VITE_FEATURE_PLANS_PAGE !== 'true') {
    return <Navigate to="/account" replace />;
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h2 className="tracking-[-0.02em] text-[1.5rem] font-medium">Billing & Plan</h2>
        <p className="opacity-40 tracking-[-0.01em] text-[0.875rem]">
          Manage your subscription and billing details
        </p>
      </div>

      <div className="grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="tracking-[-0.02em] text-[1.25rem] font-medium">Free Plan</h3>
              <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-[0.7rem] tracking-[-0.01em] font-medium uppercase">
                Active
              </span>
            </div>
            <p className="opacity-40 tracking-[-0.01em] text-[0.875rem]">
              500 images per month. Auto-renewal: N/A
            </p>
          </div>

          <Link
            to="/plans"
            className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-black/5 hover:bg-black/10 rounded-xl tracking-[-0.01em] text-[0.9rem] transition-colors font-medium"
          >
            Change Plan
          </Link>
        </div>

        <div className="relative z-10 mt-8 pt-8 border-t border-border/10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="block opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase mb-1">
              Payment Method
            </span>
            <span className="block tracking-[-0.01em] text-[0.9rem]">
              No payment method on file
            </span>
            <button
              onClick={() => toast('Payment methods coming soon!')}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl tracking-[-0.01em] text-[0.85rem] transition-colors font-medium"
            >
              Add Payment Method
            </button>
          </div>
          <div className="space-y-1">
            <span className="block opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase mb-1">
              Billing Email
            </span>
            <span className="block tracking-[-0.01em] text-[0.9rem]">{user.email}</span>
            <button
              onClick={() => toast('Coming soon!')}
              aria-label="Update billing email"
              className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl tracking-[-0.01em] text-[0.85rem] transition-colors font-medium"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="tracking-[-0.02em] text-[1rem] font-medium">Recent Invoices</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/10">
                <th className="pb-3 opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase font-medium">
                  Date
                </th>
                <th className="pb-3 opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase font-medium">
                  Description
                </th>
                <th className="pb-3 opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase font-medium">
                  Amount
                </th>
                <th className="pb-3 opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase font-medium text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="pt-8 pb-8 text-center opacity-40 tracking-[-0.01em] text-[0.9rem]"
                >
                  No invoices yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
