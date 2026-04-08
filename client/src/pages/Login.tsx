import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const inputClassName =
  'grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] placeholder:opacity-30 focus:border-foreground/20 transition-all';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!validateForm()) return;

    if (!supabase) {
      toast.error('Authentication service unavailable');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setFormError('Invalid email or password');
        return;
      }

      navigate('/');
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
            Welcome Back
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[1rem]">
            Sign in to access your metadata history
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 space-y-6 shadow-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none" />

          <div className="space-y-4 relative z-10">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={inputClassName}
                onChange={e => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                  if (formError) setFormError('');
                }}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-500">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
                >
                  Password
                </Label>
                <button
                  type="button"
                  className="text-[0.75rem] opacity-40 hover:opacity-100 transition-opacity tracking-[-0.01em] underline underline-offset-2"
                >
                  Forgot?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={inputClassName}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                  if (formError) setFormError('');
                }}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-red-500">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500 text-center relative z-10">{formError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="lava-button w-full grain-gradient relative z-10 px-6 py-5 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] group overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="relative z-10 tracking-[-0.02em] text-[1rem]">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none z-10" />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none z-10" />
          </button>

          <div className="text-center relative z-10">
            <span className="opacity-40 tracking-[-0.01em] text-[0.875rem]">
              Don't have an account?{' '}
            </span>
            <Link
              to="/signup"
              className="tracking-[-0.01em] text-[0.875rem] opacity-80 hover:opacity-100 underline underline-offset-2 transition-opacity"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
