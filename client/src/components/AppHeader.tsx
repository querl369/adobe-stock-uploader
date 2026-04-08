import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AppHeader() {
  const { user } = useAuth();
  const showPricing = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 backdrop-blur-sm bg-gradient-to-b from-background/80 to-transparent">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
          <span className="tracking-[-0.02em] opacity-50 text-[13px]">AI Metadata</span>
        </Link>
        <nav aria-label="Main navigation" className="flex gap-2">
          {showPricing && (
            <Link
              to="/plans"
              className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] md:text-[15px]"
            >
              Pricing
            </Link>
          )}
          {!user && (
            <>
              <Link
                to="/login"
                className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] md:text-[15px]"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] md:text-[15px]"
              >
                Sign Up
              </Link>
            </>
          )}
          {user && (
            <Link
              to="/account"
              className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px] md:text-[15px]"
            >
              Account
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
