import { Outlet } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { AppFooter } from '../components/AppFooter';
import { Toaster } from '../components/ui/sonner';

export function Root() {
  return (
    <div className="grain min-h-screen flex flex-col bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
      <AppHeader />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <AppFooter />
      <Toaster position="bottom-right" richColors closeButton duration={5000} />
    </div>
  );
}
