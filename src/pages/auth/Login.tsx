import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Leaf, Phone, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Use generated email for login
      const email = `${formData.phone}@carbonconnect.local`;
      const user = await login(email, formData.password);

      if (user) {
        switch (user.role) {
          case 'farmer':
            navigate('/farmer/dashboard');
            break;
          case 'company':
            navigate('/company/dashboard');
            break;
          case 'verifier':
            navigate('/verifier/dashboard');
            break;
          case 'registry':
            navigate('/registry/dashboard');
            break;
          case 'buyer':
            navigate('/buyer/dashboard');
            break;
          case 'agent':
            navigate('/agent/dashboard');
            break;
          default:
            navigate('/');
        }
      } else {
        // Auth success but no userdoc (zombie account)
        setError('Account verification failed. Please try signing up again with a new phone number.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Invalid phone number or password');
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Leaf className="w-7 h-7" />
            </div>
            <span className="text-2xl font-display font-bold">TranspoCarbon</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-display font-bold leading-tight">
              Welcome Back
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Continue your journey towards sustainable agriculture and verified carbon credits.
            </p>

            <div className="flex items-center gap-4 pt-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-sm font-medium"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="font-medium">500+ Active Users</div>
                <div className="text-white/70">Join the community</div>
              </div>
            </div>
          </div>

          <div className="text-sm text-white/60">
            © 2024 TranspoCarbon. All rights reserved.
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -right-10 top-1/4 w-40 h-40 rounded-full bg-white/5" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">TranspoCarbon</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold text-foreground">Sign In</h2>
            <p className="mt-2 text-muted-foreground">Enter your credentials to access your dashboard</p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phone Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field pl-12"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button type="button" className="text-sm text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field pl-12 pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
