// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// --- Mock Navigate ---
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, { replace });
      return null;
    },
  };
});

// --- Mock sonner toast ---
const mockToast = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: mockToast,
}));

// --- Mock AuthContext ---
const mockUser = { id: 'user-123', email: 'test@example.com' };
vi.mock('../client/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}));

import { Billing } from '../client/src/pages/Billing';

describe('Billing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('when VITE_FEATURE_PLANS_PAGE=true', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
    });

    it('renders billing page content', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('Billing & Plan')).toBeInTheDocument();
      expect(screen.getByText('Manage your subscription and billing details')).toBeInTheDocument();
    });

    it('shows "Free Plan" plan name', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('Free Plan')).toBeInTheDocument();
    });

    it('shows "Active" status badge', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows auto-renewal as N/A for free tier', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText(/Auto-renewal: N\/A/)).toBeInTheDocument();
    });

    it('shows "Change Plan" link pointing to /plans', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      const link = screen.getByRole('link', { name: /change plan/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/plans');
    });

    it('shows "No payment method on file"', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('No payment method on file')).toBeInTheDocument();
    });

    it('"Add Payment Method" button shows toast on click', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /add payment method/i }));
      expect(mockToast).toHaveBeenCalledWith('Payment methods coming soon!');
    });

    it('displays user email from auth context', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('"Update" button shows toast on click', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /update billing email/i }));
      expect(mockToast).toHaveBeenCalledWith('Coming soon!');
    });

    it('shows "No invoices yet" empty state', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });

    it('shows invoice table column headers', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('when VITE_FEATURE_PLANS_PAGE=false', () => {
    it('redirects to /account when flag is false', () => {
      vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'false');

      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true });
      expect(screen.queryByText('Billing & Plan')).not.toBeInTheDocument();
    });

    it('redirects to /account when flag is absent', () => {
      render(
        <MemoryRouter>
          <Billing />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true });
      expect(screen.queryByText('Billing & Plan')).not.toBeInTheDocument();
    });
  });
});
