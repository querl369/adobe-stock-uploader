import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AccountLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const showBilling = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';

  const navItems = [
    { path: '/account', label: 'Profile', exact: true },
    { path: '/account/history', label: 'History', exact: false },
  ];

  if (showBilling) {
    navItems.push({ path: '/account/billing', label: 'Billing', exact: false });
  }

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // signOut cleans up state via its own try/finally
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col items-center pt-32 pb-32 px-4">
      <div className="w-full max-w-4xl space-y-12">
        {/* Header */}
        <div className="space-y-2 border-b border-border/10 pb-8">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
            Account Details
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[1rem]">
            Manage your personal information, history, and billing
          </p>
        </div>

        <div className="grid md:grid-cols-[200px_1fr] gap-12">
          {/* Sidebar */}
          <nav className="space-y-2" aria-label="Account navigation">
            {navItems.map(item => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block w-full text-left px-4 py-3 rounded-xl tracking-[-0.01em] text-[0.875rem] transition-colors ${
                    isActive
                      ? 'bg-black/5 text-foreground font-medium'
                      : 'hover:bg-black/5 text-foreground/50 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500/50 hover:text-red-500 tracking-[-0.01em] text-[0.875rem] transition-colors mt-8"
            >
              Log out
            </button>
          </nav>

          {/* Content */}
          <div>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
