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

import { Plans } from '../client/src/pages/Plans';

describe('Plans page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('when VITE_FEATURE_PLANS_PAGE=true', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
    });

    it('renders page title and subtitle', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Choose the plan that best fits your workflow. Upgrade or downgrade at any time.'
        )
      ).toBeInTheDocument();
    });

    it('renders 3 pricing tier cards', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(screen.getByText('First Tier')).toBeInTheDocument();
      expect(screen.getByText('Second Tier')).toBeInTheDocument();
      expect(screen.getByText('Third Tier')).toBeInTheDocument();
    });

    it('displays correct prices with /mo suffix', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(screen.getByText('$5')).toBeInTheDocument();
      expect(screen.getByText('$23')).toBeInTheDocument();
      expect(screen.getByText('$40')).toBeInTheDocument();
      expect(screen.getAllByText('/mo')).toHaveLength(3);
    });

    it('shows "Most Popular" badge on second tier', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('renders feature lists for each tier', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      // First Tier features
      expect(screen.getByText('1,000 images per month')).toBeInTheDocument();
      expect(screen.getByText('Standard AI metadata')).toBeInTheDocument();
      expect(screen.getByText('CSV exports')).toBeInTheDocument();
      expect(screen.getByText('Email support')).toBeInTheDocument();

      // Second Tier features
      expect(screen.getByText('5,000 images per month')).toBeInTheDocument();
      expect(screen.getByText('Advanced AI metadata')).toBeInTheDocument();
      expect(screen.getByText('CSV + JSON exports')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();

      // Third Tier features
      expect(screen.getByText('10,000 images per month')).toBeInTheDocument();
      expect(screen.getByText('Custom AI prompts')).toBeInTheDocument();
      expect(screen.getByText('API access')).toBeInTheDocument();
      expect(screen.getByText('24/7 phone support')).toBeInTheDocument();
    });

    it('renders "Get Started" CTA buttons for all tiers', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      const buttons = screen.getAllByRole('button', { name: /Get Started/ });
      expect(buttons).toHaveLength(3);
    });

    it('shows toast when any CTA button is clicked', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      const buttons = screen.getAllByRole('button', { name: /Get Started/ });
      fireEvent.click(buttons[0]);
      expect(mockToast).toHaveBeenCalledWith(
        "Coming soon! We'll notify you when plans are available."
      );

      fireEvent.click(buttons[1]);
      expect(mockToast).toHaveBeenCalledTimes(2);

      fireEvent.click(buttons[2]);
      expect(mockToast).toHaveBeenCalledTimes(3);
    });

    it('shows free tier mention', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(
        screen.getByText('Currently free — 500 images/month for all accounts')
      ).toBeInTheDocument();
    });
  });

  describe('when VITE_FEATURE_PLANS_PAGE=false', () => {
    it('redirects to / when flag is false', () => {
      vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'false');

      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(screen.queryByText('Simple, transparent pricing')).not.toBeInTheDocument();
    });

    it('redirects to / when flag is absent', () => {
      render(
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(screen.queryByText('Simple, transparent pricing')).not.toBeInTheDocument();
    });
  });
});
