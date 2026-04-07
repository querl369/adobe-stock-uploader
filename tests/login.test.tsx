// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Login } from '../client/src/pages/Login';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignIn = vi.fn();
let mockSupabaseValue: unknown = {
  auth: {
    signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
  },
};

vi.mock('../client/src/lib/supabase', () => ({
  get supabase() {
    return mockSupabaseValue;
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseValue = {
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      },
    };
  });

  it('renders form with Email, Password fields and Sign In button', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('shows "Email is required" error when submitting empty email', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows email validation error for invalid email format', () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'invalid-email' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('shows "Password is required" for empty password', () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('calls supabase.auth.signInWithPassword with correct params on valid submission', async () => {
    mockSignIn.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'alex@example.com',
        password: 'password123',
      });
    });
  });

  it('shows generic "Invalid email or password" on auth failure', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });

    // Must NOT expose the actual Supabase error message (prevents email enumeration)
    expect(screen.queryByText('Invalid login credentials')).not.toBeInTheDocument();
    // Must NOT navigate on failed login
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to / on successful login', async () => {
    mockSignIn.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows toast error when supabase client is null', async () => {
    const { toast } = await import('sonner');
    mockSupabaseValue = null;

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(toast.error).toHaveBeenCalledWith('Authentication service unavailable');
    // Must NOT navigate when supabase is unavailable
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables submit button during API call and shows loading text', async () => {
    let resolveSignIn!: (value: unknown) => void;
    mockSignIn.mockReturnValue(
      new Promise(resolve => {
        resolveSignIn = resolve;
      })
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    const button = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('Signing in...');
      expect(button).toBeDisabled();
    });

    resolveSignIn({ data: { user: {}, session: {} }, error: null });

    await waitFor(() => {
      expect(button).toHaveTextContent('Sign In');
      expect(button).not.toBeDisabled();
    });
  });

  it('renders "Forgot?" button and "Sign up" link to /signup', () => {
    renderLogin();

    const forgotButton = screen.getByRole('button', { name: 'Forgot?' });
    expect(forgotButton).toBeInTheDocument();
    expect(forgotButton.tagName).toBe('BUTTON');
    expect(forgotButton).toHaveAttribute('type', 'button');

    const signUpLink = screen.getByText('Sign up');
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink.closest('a')).toHaveAttribute('href', '/signup');
  });

  it('shows all validation errors when submitting completely empty form', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('clears server error when user edits a field', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'newpass' } });
    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
  });

  it('clears field errors when user corrects input', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'a' } });
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  it('shows generic error when login throws network error', async () => {
    mockSignIn.mockRejectedValue(new Error('Network request failed'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled();
  });
});
