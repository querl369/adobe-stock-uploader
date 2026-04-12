import { Check } from 'lucide-react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';

const tiers = [
  {
    name: 'First Tier',
    price: '5',
    images: '1,000',
    popular: false,
    features: ['1,000 images per month', 'Standard AI metadata', 'CSV exports', 'Email support'],
  },
  {
    name: 'Second Tier',
    price: '23',
    images: '5,000',
    popular: true,
    features: [
      '5,000 images per month',
      'Advanced AI metadata',
      'CSV + JSON exports',
      'Priority support',
    ],
  },
  {
    name: 'Third Tier',
    price: '40',
    images: '10,000',
    popular: false,
    features: ['10,000 images per month', 'Custom AI prompts', 'API access', '24/7 phone support'],
  },
];

export function Plans() {
  if (import.meta.env.VITE_FEATURE_PLANS_PAGE !== 'true') {
    return <Navigate to="/" replace />;
  }

  const handleGetStarted = () => {
    toast("Coming soon! We'll notify you when plans are available.");
  };

  return (
    <div className="flex flex-col items-center pt-32 pb-32 px-4 min-h-[90vh]">
      <div className="w-full max-w-5xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.1]">
            Simple, transparent pricing
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[1.1rem]">
            Choose the plan that best fits your workflow. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {tiers.map(tier => (
            <div
              key={tier.name}
              className={`
                relative grain-gradient rounded-[2.5rem] p-8 flex flex-col h-full transition-all duration-300 hover:-translate-y-1
                ${
                  tier.popular
                    ? 'border-2 border-foreground/20 bg-gradient-to-br from-white/90 to-white/50 shadow-2xl scale-105 z-10'
                    : 'border-2 border-border/20 bg-gradient-to-br from-white/60 to-transparent shadow-lg mt-0 md:mt-4'
                }
              `}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-foreground text-background text-[0.7rem] tracking-[-0.01em] font-medium uppercase shadow-lg whitespace-nowrap">
                  Most Popular
                </div>
              )}

              <div className="space-y-2 mb-8">
                <h3 className="tracking-[-0.02em] text-[1.25rem] font-medium">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="tracking-[-0.04em] text-[2.5rem] font-medium leading-none">
                    ${tier.price}
                  </span>
                  <span className="opacity-40 tracking-[-0.01em] text-[0.875rem]">/mo</span>
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                {tier.features.map(feat => (
                  <li
                    key={feat}
                    className="flex items-start gap-3 tracking-[-0.01em] text-[0.95rem] opacity-70"
                  >
                    <Check size={18} className="mt-0.5 opacity-50 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleGetStarted}
                aria-label={`Get Started with ${tier.name}`}
                className={`
                  w-full px-6 py-4 rounded-2xl tracking-[-0.01em] text-[0.95rem] transition-all duration-300
                  ${
                    tier.popular
                      ? 'lava-button grain-gradient relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group overflow-hidden'
                      : 'bg-black/5 hover:bg-black/10 text-foreground active:scale-[0.98] font-medium'
                  }
                `}
              >
                {tier.popular ? (
                  <>
                    <span className="relative z-10">Get Started</span>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none z-10" />
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center opacity-40 tracking-[-0.01em] text-[0.95rem]">
          Currently free — 500 images/month for all accounts
        </p>
      </div>
    </div>
  );
}
