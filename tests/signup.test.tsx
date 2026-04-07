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
let mockSupabaseValue: unknown = {
  auth: {
    signUp: (...args: unknown[]) => mockSignUp(...args),
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
    mockSupabaseValue = {
      auth: {
        signUp: (...args: unknown[]) => mockSignUp(...args),
      },
    };
  });

  it('renders form with all required fields', () => {
    renderSignUp();

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('shows "Full name is required" error when submitting empty name', async () => {
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Full name is required')).toBeInTheDocument();
  });

  it('shows email validation error for invalid email', async () => {
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'invalid-email' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('shows password validation error for short password', async () => {
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('calls supabase.auth.signUp with correct parameters on valid submission', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
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
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeInTheDocument();
    });
  });

  it('navigates to / on successful signup', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows toast error when supabase client is null', async () => {
    const { toast } = await import('sonner');
    mockSupabaseValue = null;

    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(toast.error).toHaveBeenCalledWith('Authentication service unavailable');
  });

  it('shows generic error when signup throws network error', async () => {
    mockSignUp.mockRejectedValue(new Error('Network request failed'));
    renderSignUp();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Smith' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Create Account' })).not.toBeDisabled();
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
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'alex@example.com' },
    });
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

    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('clears field errors when user corrects input', async () => {
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText('Full name is required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'A' } });
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });
});
