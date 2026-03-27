let capturedRoutes: unknown[] = [];

vi.mock('react-router', () => ({
  createBrowserRouter: (routes: unknown[]) => {
    capturedRoutes = routes;
    return { routes };
  },
  Outlet: () => null,
}));

describe('Router Configuration', () => {
  beforeEach(() => {
    capturedRoutes = [];
    vi.resetModules();
  });

  async function loadRoutes() {
    const mod = await import('../client/src/routes');
    return mod.router;
  }

  it('should create a browser router', async () => {
    const router = await loadRoutes();
    expect(router).toBeDefined();
    expect(router.routes).toBeDefined();
  });

  it('should have a root route at /', async () => {
    await loadRoutes();
    expect(capturedRoutes).toHaveLength(1);
    const root = capturedRoutes[0] as { path: string; children: unknown[] };
    expect(root.path).toBe('/');
  });

  it('should define all required child routes', async () => {
    await loadRoutes();
    const root = capturedRoutes[0] as {
      path: string;
      children: Array<{ path?: string; index?: boolean }>;
    };
    const children = root.children;

    // Home (index route), login, signup, plans, account
    expect(children).toHaveLength(5);

    const homePath = children.find(c => c.index === true);
    expect(homePath).toBeDefined();

    const loginRoute = children.find(c => c.path === 'login');
    expect(loginRoute).toBeDefined();

    const signupRoute = children.find(c => c.path === 'signup');
    expect(signupRoute).toBeDefined();

    const plansRoute = children.find(c => c.path === 'plans');
    expect(plansRoute).toBeDefined();

    const accountRoute = children.find(c => c.path === 'account');
    expect(accountRoute).toBeDefined();
  });

  it('should define nested account routes', async () => {
    await loadRoutes();
    const root = capturedRoutes[0] as {
      children: Array<{ path?: string; children?: Array<{ path?: string; index?: boolean }> }>;
    };
    const accountRoute = root.children.find(c => c.path === 'account');

    expect(accountRoute).toBeDefined();
    expect(accountRoute!.children).toBeDefined();
    expect(accountRoute!.children).toHaveLength(3);

    const profileRoute = accountRoute!.children!.find(c => c.index === true);
    expect(profileRoute).toBeDefined();

    const historyRoute = accountRoute!.children!.find(c => c.path === 'history');
    expect(historyRoute).toBeDefined();

    const billingRoute = accountRoute!.children!.find(c => c.path === 'billing');
    expect(billingRoute).toBeDefined();
  });

  it('should assign Component to each route', async () => {
    await loadRoutes();
    const root = capturedRoutes[0] as {
      Component: unknown;
      children: Array<{ Component: unknown; children?: Array<{ Component: unknown }> }>;
    };

    // Root has a Component
    expect(root.Component).toBeDefined();

    // All children have Components
    for (const child of root.children) {
      expect(child.Component).toBeDefined();

      // Nested account children also have Components
      if ('children' in child && child.children) {
        for (const nested of child.children) {
          expect(nested.Component).toBeDefined();
        }
      }
    }
  });
});
