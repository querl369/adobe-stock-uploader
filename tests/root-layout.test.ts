vi.mock('react-router', () => ({
  Outlet: vi.fn(() => null),
}));

vi.mock('../client/src/components/AppHeader', () => ({
  AppHeader: vi.fn(() => null),
}));

vi.mock('../client/src/components/AppFooter', () => ({
  AppFooter: vi.fn(() => null),
}));

vi.mock('../client/src/components/ui/sonner', () => ({
  Toaster: vi.fn(() => null),
}));

import { Outlet } from 'react-router';
import { AppHeader } from '../client/src/components/AppHeader';
import { AppFooter } from '../client/src/components/AppFooter';
import { Toaster } from '../client/src/components/ui/sonner';
import { Root } from '../client/src/pages/Root';

function findInTree(element: unknown, target: unknown): boolean {
  if (!element || typeof element !== 'object') return false;
  const el = element as { type?: unknown; props?: { children?: unknown } };
  if (el.type === target) return true;
  const children = el.props?.children;
  if (Array.isArray(children)) {
    return children.some(child => findInTree(child, target));
  }
  return findInTree(children, target);
}

function findByType(element: unknown, type: string): unknown | null {
  if (!element || typeof element !== 'object') return null;
  const el = element as { type?: unknown; props?: { children?: unknown } };
  if (el.type === type) return el;
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByType(child, type);
      if (found) return found;
    }
  }
  return findByType(children, type);
}

describe('Root Layout', () => {
  it('should render AppHeader, Outlet, AppFooter, and Toaster', () => {
    const tree = Root();

    expect(findInTree(tree, AppHeader)).toBe(true);
    expect(findInTree(tree, Outlet)).toBe(true);
    expect(findInTree(tree, AppFooter)).toBe(true);
    expect(findInTree(tree, Toaster)).toBe(true);
  });

  it('should render Outlet inside a main element', () => {
    const tree = Root();
    const main = findByType(tree, 'main');

    expect(main).not.toBeNull();
    expect(findInTree(main, Outlet)).toBe(true);
  });

  it('should apply grain class and flex column layout on root div', () => {
    const tree = Root() as { props: { className: string } };

    expect(tree.props.className).toContain('grain');
    expect(tree.props.className).toContain('min-h-screen');
    expect(tree.props.className).toContain('flex');
    expect(tree.props.className).toContain('flex-col');
  });
});
