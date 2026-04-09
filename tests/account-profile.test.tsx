// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

// --- Supabase mock ---
let mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
let mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'profiles') {
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  }
  return {};
});

let mockSupabaseValue: unknown = {
  auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
  from: mockFrom,
};

vi.mock('../client/src/lib/supabase', () => ({
  get supabase() {
    return mockSupabaseValue;
  },
}));

// --- Mock Navigate and useNavigate ---
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

// --- Mock sonner toast ---
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { AuthProvider } from '../client/src/contexts/AuthContext';
import { AccountProfile } from '../client/src/pages/AccountProfile';

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSession = { user: mockUser, access_token: 'mock-token' };

const defaultProfile = {
  full_name: 'Test User',
  email: 'test@example.com',
  default_initials: 'TU',
};

function setupAuthenticatedWithProfile(
  profile = defaultProfile,
  updateError: { message: string } | null = null
) {
  mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  mockOnAuthStateChange.mockImplementation((callback: Function) => {
    callback('SIGNED_IN', mockSession);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  // Chain: .select().eq().single()
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  });

  // Chain: .update().eq()
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  });
}

function renderAccountProfile() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AuthProvider>
        <Routes>
          <Route path="/account" element={<AccountProfile />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AccountProfile', () => {
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
      from: mockFrom,
    };
  });

  // Task 1 tests: Profile form renders with pre-filled data
  it('renders profile form with pre-filled Full Name from Supabase', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Test User');
    });
  });

  it('renders profile form with pre-filled Email (read-only)', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      expect(emailInput.value).toBe('test@example.com');
    });
  });

  it('renders profile form with pre-filled Default Initials', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      const initialsInput = screen.getByLabelText(/default initials/i) as HTMLInputElement;
      expect(initialsInput.value).toBe('TU');
    });
  });

  it('email input has readOnly attribute', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      expect(emailInput).toHaveAttribute('readonly');
    });
  });

  it('Default Initials input has maxLength of 5', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      const initialsInput = screen.getByLabelText(/default initials/i) as HTMLInputElement;
      expect(initialsInput).toHaveAttribute('maxLength', '5');
    });
  });

  it('shows loading state while fetching profile', async () => {
    // Make profile fetch never resolve
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback: Function) => {
      callback('SIGNED_IN', mockSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue(new Promise(() => {})),
      }),
    });

    renderAccountProfile();

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
      expect(nameInput).toBeDisabled();
    });
  });

  it('shows error toast when profile fetch fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback: Function) => {
      callback('SIGNED_IN', mockSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Fetch failed' } }),
      }),
    });

    renderAccountProfile();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load profile');
    });
  });

  // Task 2 tests: Save Changes functionality
  it('save button calls Supabase update with correct data', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Test User');
    });

    // Edit name
    const nameInput = screen.getByLabelText(/full name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
    });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: 'New Name',
      default_initials: 'TU',
    });
  });

  it('shows success toast after successful save', async () => {
    setupAuthenticatedWithProfile();
    renderAccountProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Test User');
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Profile updated');
    });
  });

  it('shows error toast when save fails', async () => {
    setupAuthenticatedWithProfile(defaultProfile, { message: 'Update failed' });
    renderAccountProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Test User');
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update profile');
    });
  });

  it('save button is disabled while saving (prevents double-submit)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback: Function) => {
      callback('SIGNED_IN', mockSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: defaultProfile, error: null }),
      }),
    });

    // Make update never resolve to keep saving state
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    renderAccountProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Test User');
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });
});
