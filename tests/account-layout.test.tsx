// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Outlet } from 'react-router';

// --- Supabase mock (same pattern as header-navigation.test.tsx) ---
let mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
let mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
let mockSupabaseValue: unknown = {
  auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
};

vi.mock('../client/src/lib/supabase', () => ({
  get supabase() {
    return mockSupabaseValue;
  },
}));

// --- Mock Navigate and useNavigate for redirect/navigation detection ---
const mockNavigate = vi.fn();
const mockNavigateHook = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, { replace });
      return null;
    },
    useNavigate: () => mockNavigateHook,
  };
});

import { AuthProvider } from '../client/src/contexts/AuthContext';
import { ProtectedRoute } from '../client/src/components/ProtectedRoute';
import { AccountLayout } from '../client/src/pages/AccountLayout';

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  access_token: 'mock-token',
};

function setupAuthenticated() {
  mockGetSession.mockResolvedValue({ data: { session: mockSession } });
}

function setupUnauthenticated() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseValue = {
      auth: {
        getSession: (...args: unknown[]) => mockGetSession(...args),
        onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
    };
    vi.unstubAllEnvs();
  });

  it('renders Outlet when user is authenticated', async () => {
    setupAuthenticated();

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('redirects to /login when user is not authenticated', async () => {
    setupUnauthenticated();

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders nothing while isLoading is true', () => {
    // Make getSession never resolve to keep isLoading=true
    mockGetSession.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('AccountLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabaseValue = {
      auth: {
        getSession: (...args: unknown[]) => mockGetSession(...args),
        onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
    };
    vi.unstubAllEnvs();
  });

  function renderAccountLayout(initialPath = '/account') {
    setupAuthenticated();
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<div>Profile Content</div>} />
              <Route path="history" element={<div>History Content</div>} />
              <Route path="billing" element={<div>Billing Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  it('renders sidebar with Profile and History links', async () => {
    renderAccountLayout();

    await waitFor(() => {
      expect(screen.getByText('Account Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('shows Billing link when VITE_FEATURE_PLANS_PAGE=true', async () => {
    vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
    renderAccountLayout();

    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });
  });

  it('hides Billing link when feature flag is false/absent', async () => {
    renderAccountLayout();

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
  });

  it('Profile link has active styling when at /account', async () => {
    renderAccountLayout('/account');

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink?.className).toContain('font-medium');
    expect(profileLink?.className).toContain('text-foreground');
    expect(profileLink?.className).not.toContain('text-foreground/50');

    const historyLink = screen.getByText('History').closest('a');
    expect(historyLink?.className).not.toContain('font-medium');
    expect(historyLink?.className).toContain('text-foreground/50');
  });

  it('History link has active styling when at /account/history', async () => {
    renderAccountLayout('/account/history');

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyLink = screen.getByText('History').closest('a');
    expect(historyLink?.className).toContain('font-medium');
    expect(historyLink?.className).not.toContain('text-foreground/50');

    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink?.className).not.toContain('font-medium');
    expect(profileLink?.className).toContain('text-foreground/50');
  });

  it('Log out button calls signOut() and navigates to /', async () => {
    renderAccountLayout();

    await waitFor(() => {
      expect(screen.getByText('Log out')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText('Log out').click();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNavigateHook).toHaveBeenCalledWith('/');
  });

  it('renders subtitle text', async () => {
    renderAccountLayout();

    await waitFor(() => {
      expect(
        screen.getByText('Manage your personal information, history, and billing')
      ).toBeInTheDocument();
    });
  });

  it('Billing link has active styling when at /account/billing', async () => {
    vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
    renderAccountLayout('/account/billing');

    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    const billingLink = screen.getByText('Billing').closest('a');
    expect(billingLink?.className).toContain('font-medium');
    expect(billingLink?.className).not.toContain('text-foreground/50');

    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink?.className).not.toContain('font-medium');
    expect(profileLink?.className).toContain('text-foreground/50');
  });

  it('renders Outlet content area for nested routes', async () => {
    renderAccountLayout('/account');

    await waitFor(() => {
      expect(screen.getByText('Profile Content')).toBeInTheDocument();
    });
  });
});
