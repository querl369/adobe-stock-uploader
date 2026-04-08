// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// --- Supabase mock ---
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

import { AuthProvider, useAuth } from '../client/src/contexts/AuthContext';
import { AppHeader } from '../client/src/components/AppHeader';

// --- Helper to render AppHeader with auth context ---
function renderHeader() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppHeader />
      </AuthProvider>
    </MemoryRouter>
  );
}

// --- Helper component to test useAuth hook ---
function AuthConsumer() {
  const { user, session, isLoading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="session">{session ? 'active' : 'null'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <button data-testid="sign-out" onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
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

  it('provides user, session, isLoading, signOut via useAuth()', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('session')).toHaveTextContent('null');
    expect(screen.getByTestId('sign-out')).toBeInTheDocument();
  });

  it('handles null supabase client (logged-out state)', async () => {
    mockSupabaseValue = null;

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('session')).toHaveTextContent('null');
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockOnAuthStateChange).not.toHaveBeenCalled();
  });

  it('signOut() calls supabase.auth.signOut() and clears state', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'mock-token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    await act(async () => {
      screen.getByTestId('sign-out').click();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('session')).toHaveTextContent('null');
  });

  it('unsubscribes from auth state changes on unmount', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('throws when useAuth() is used outside AuthProvider', () => {
    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<AuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});

describe('AppHeader navigation', () => {
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

  it('shows Login + Sign Up when logged out', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
  });

  it('shows Account when logged in', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'mock-token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
  });

  it('shows Pricing link when VITE_FEATURE_PLANS_PAGE=true', async () => {
    vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');

    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });

    const pricingLink = screen.getByText('Pricing').closest('a');
    expect(pricingLink).toHaveAttribute('href', '/plans');
  });

  it('hides Pricing link when feature flag is false', async () => {
    vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'false');

    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
  });

  it('hides Pricing link when feature flag is absent', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
  });

  it('Sign Up link has plain text styling matching Login', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    const signUpLink = screen.getByText('Sign Up').closest('a');
    const loginLink = screen.getByText('Login').closest('a');
    expect(signUpLink?.className).toContain('rounded-full');
    expect(signUpLink?.className).not.toContain('lava-button');
    expect(signUpLink?.className).not.toContain('text-white');
    expect(signUpLink?.className).toBe(loginLink?.className);
  });

  it('shows Pricing link alongside Account when logged in with feature flag', async () => {
    vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'mock-token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
  });

  it('Logo links to / with "AI Metadata" text', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByText('AI Metadata')).toBeInTheDocument();
    });

    const brandLink = screen.getByText('AI Metadata').closest('a');
    expect(brandLink).toHaveAttribute('href', '/');
  });
});
