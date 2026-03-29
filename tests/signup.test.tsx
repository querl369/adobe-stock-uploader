// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SignUp } from '../client/src/pages/SignUp';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignUp = vi.fn();
vi.mock('../client/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderSignUp() {
  return render(
    <MemoryRouter>
      <SignUp />
    </MemoryRouter>
  );
}

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with all required fields', () => {
    renderSignUp();

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeTruthy();
    expect(screen.getByLabelText('Full Name')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('shows "Full name is required" error when submitting empty name', async () => {
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Full name is required')).toBeTruthy();
  });

  it('shows email validation error for invalid email', async () => {
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    // Use form submit directly — jsdom's type="email" constraint blocks click-based submit
    const form = screen.getByRole('button').closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('shows password validation error for short password', async () => {
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
  });

  it('calls supabase.auth.signUp with correct parameters on valid submission', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'alex@example.com',
        password: 'password123',
        options: { data: { full_name: 'Alex Smith' } },
      });
    });
  });

  it('displays server-side error messages from Supabase', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeTruthy();
    });
  });

  it('shows error when signup returns no session', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(
        screen.getByText('Signup succeeded but no session was created. Please try logging in.')
      ).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to / on successful signup', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows toast error when supabase client is null', async () => {
    const { toast } = await import('sonner');

    // Use vi.mocked to safely override the supabase module for this test
    const supabaseModule = await import('../client/src/lib/supabase');
    const original = supabaseModule.supabase;

    try {
      Object.defineProperty(supabaseModule, 'supabase', { value: null, writable: true });

      renderSignUp();

      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(toast.error).toHaveBeenCalledWith('Authentication service unavailable');
    } finally {
      Object.defineProperty(supabaseModule, 'supabase', { value: original, writable: true });
    }
  });

  it('disables submit button during API call', async () => {
    let resolveSignUp!: (value: unknown) => void;
    mockSignUp.mockReturnValue(
      new Promise(resolve => {
        resolveSignUp = resolve;
      })
    );
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('Creating account...');
      expect(button).toBeDisabled();
    });

    resolveSignUp({ data: { user: {}, session: {} }, error: null });

    await waitFor(() => {
      expect(button).toHaveTextContent('Create Account');
      expect(button).not.toBeDisabled();
    });
  });

  it('shows all validation errors when submitting completely empty form', () => {
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Full name is required')).toBeTruthy();
    expect(screen.getByText('Email is required')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
  });

  it('rejects email with single-character TLD', () => {
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@domain.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    const form = screen.getByRole('button').closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('renders error messages with role="alert" for screen readers', () => {
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(3);
  });

  it('clears field errors when user corrects input', async () => {
    renderSignUp();

    // Submit empty form to trigger errors
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText('Full name is required')).toBeTruthy();

    // Type in the field to clear error
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'A' } });
    expect(screen.queryByText('Full name is required')).toBeNull();
  });
});
