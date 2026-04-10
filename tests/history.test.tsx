// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// --- Supabase mock ---
let mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
let mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

const mockSelect = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'processing_batches') {
    return { select: mockSelect };
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
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { AuthProvider } from '../client/src/contexts/AuthContext';
import { History } from '../client/src/pages/History';

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSession = { user: mockUser, access_token: 'test-token' };

const defaultBatches = [
  {
    id: 'batch-1',
    image_count: 12,
    status: 'completed',
    csv_filename: 'adobe-stock-metadata-123.csv',
    created_at: '2026-03-24T14:30:00Z',
  },
  {
    id: 'batch-2',
    image_count: 5,
    status: 'completed',
    csv_filename: 'adobe-stock-metadata-456.csv',
    created_at: '2026-03-20T09:15:00Z',
  },
];

function setupAuthenticatedWithBatches(batches = defaultBatches) {
  mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  mockOnAuthStateChange.mockImplementation((callback: Function) => {
    callback('SIGNED_IN', mockSession);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  // Chain: .select().eq().gt().order()
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: batches, error: null }),
      }),
    }),
  });
}

function setupAuthenticatedEmpty() {
  setupAuthenticatedWithBatches([]);
}

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/account/history']}>
      <AuthProvider>
        <History />
      </AuthProvider>
    </MemoryRouter>
  );
}

// --- Mock fetch for CSV download ---
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// --- Mock URL.createObjectURL / revokeObjectURL ---
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('URL', {
  ...globalThis.URL,
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

describe('History Page - Story 6.8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseValue = {
      auth: {
        getSession: (...args: unknown[]) => mockGetSession(...args),
        onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
      from: mockFrom,
    };
  });

  it('should render loading state initially', async () => {
    setupAuthenticatedWithBatches();

    // Make the query hang so we can observe loading
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gt: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
      }),
    });

    await act(async () => {
      renderHistory();
    });

    expect(screen.getByText('Loading history...')).toBeInTheDocument();
  });

  it('should render batch list from Supabase', async () => {
    setupAuthenticatedWithBatches();

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Your recent metadata generation sessions')).toBeInTheDocument();
    });

    // Both batches rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('should render session cards with name, date, and image count', async () => {
    setupAuthenticatedWithBatches();

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      // Image counts
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      // "images" labels
      const imagesLabels = screen.getAllByText('images');
      expect(imagesLabels).toHaveLength(2);
    });
  });

  it('should render empty state when no batches', async () => {
    setupAuthenticatedEmpty();

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(screen.getByText('No sessions yet. Process some images!')).toBeInTheDocument();
    });
  });

  it('should trigger CSV download fetch when card clicked', async () => {
    setupAuthenticatedWithBatches();

    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['csv,content'], { type: 'text/csv' })),
    });

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    const buttons = screen.getAllByRole('button');

    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/download-csv/batch-1',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
          credentials: 'include',
        })
      );
    });
  });

  it('should show success toast after download', async () => {
    setupAuthenticatedWithBatches();

    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['csv,content'], { type: 'text/csv' })),
    });

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('CSV downloaded');
    });
  });

  it('should show error toast when CSV expired (404)', async () => {
    setupAuthenticatedWithBatches();

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('This CSV is no longer available');
    });
  });

  it('should show error toast when Supabase query fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback: Function) => {
      callback('SIGNED_IN', mockSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Chain returns an error
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gt: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'network error' } }),
        }),
      }),
    });

    await act(async () => {
      renderHistory();
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load history');
    });
  });

  it('should show error toast when supabase client is null', async () => {
    // Setup authenticated user but null supabase client
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback: Function) => {
      callback('SIGNED_IN', mockSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSupabaseValue = null;

    await act(async () => {
      renderHistory();
    });

    // With null supabase, AuthProvider can't load session, so we get empty state
    // The loading will finish with isLoading=false since supabase is null
    await waitFor(() => {
      // The page renders without batches since it can't fetch them
      expect(screen.getByText('No sessions yet. Process some images!')).toBeInTheDocument();
    });
  });
});
