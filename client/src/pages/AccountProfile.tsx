import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function AccountProfile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [defaultInitials, setDefaultInitials] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !supabase) {
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    supabase
      .from('profiles')
      .select('full_name, email, default_initials')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load profile');
        } else if (data) {
          setFullName(data.full_name || '');
          setEmail(data.email || '');
          setDefaultInitials(data.default_initials || '');
        }
        setIsLoadingProfile(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!supabase) {
      toast.error('Service unavailable');
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, default_initials: defaultInitials })
        .eq('id', user.id);

      if (error) {
        toast.error('Failed to update profile');
      } else {
        toast.success('Profile updated');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h2 className="tracking-[-0.02em] text-[1.5rem] font-medium">Profile</h2>
        <p className="opacity-40 tracking-[-0.01em] text-[0.875rem]">
          Manage your personal information
        </p>
      </div>

      <div className="grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none" />

        <div className="space-y-6 relative z-10">
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
            >
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              disabled={isLoadingProfile}
              className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] focus:border-foreground/20 transition-all"
            />
          </div>

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
              value={email}
              readOnly
              className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] focus:border-foreground/20 transition-all opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="initials"
              className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
            >
              Default Initials
            </Label>
            <Input
              id="initials"
              type="text"
              value={defaultInitials}
              onChange={e => setDefaultInitials(e.target.value)}
              maxLength={5}
              disabled={isLoadingProfile}
              className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] focus:border-foreground/20 transition-all"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoadingProfile}
              className="grain-gradient px-8 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="relative z-10">{isSaving ? 'Saving...' : 'Save Changes'}</span>
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
