import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function SignUp() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>(
    {}
  );
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const newErrors: { fullName?: string; email?: string; password?: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      navigate('/');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
            Create Account
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
            Process up to 500 images/month for free
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Alex Smith"
              value={fullName}
              onChange={e => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors(prev => ({ ...prev, fullName: undefined }));
              }}
            />
            {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
              }}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
              }}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
          </div>

          {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="lava-button w-full h-10 rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
          </button>
        </form>

        <p className="text-center text-sm opacity-60">
          Already have an account?{' '}
          <Link to="/login" className="underline hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
