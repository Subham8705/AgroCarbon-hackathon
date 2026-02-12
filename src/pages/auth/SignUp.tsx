import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Leaf, User, Building2, Shield, Archive, Phone, Lock, ArrowRight, Eye, EyeOff, ShoppingBag, UserPlus } from 'lucide-react';

const roles: { value: UserRole; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'farmer', label: 'Farmer', icon: <User className="w-5 h-5" />, description: 'Estimate CO₂ and join projects' },
  { value: 'company', label: 'Project Company', icon: <Building2 className="w-5 h-5" />, description: 'Manage farmers and batches' },
  { value: 'verifier', label: 'Verifier', icon: <Shield className="w-5 h-5" />, description: 'Verify carbon credits' },
  { value: 'registry', label: 'Registry', icon: <Archive className="w-5 h-5" />, description: 'View issued credits' },
  { value: 'buyer', label: 'Buyer', icon: <ShoppingBag className="w-5 h-5" />, description: 'Purchase verified carbon credits' },
  { value: 'agent', label: 'Field Agent', icon: <UserPlus className="w-5 h-5" />, description: 'Manage and register farmers' },
];

export default function SignUp() {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    role: 'farmer' as UserRole,
    name: '',
    phone: '',
    email: '',
    password: '',
    companyName: '',
    organization: '',
    licenseNumber: '',
    minAcres: 0,
    capacity: 0,
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.phone || formData.phone.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      // Generate unique email from phone
      const generatedEmail = `${formData.phone}@carbonconnect.local`;

      await signup({
        ...formData,
        email: generatedEmail
      });

      // Navigate to appropriate dashboard
      switch (formData.role) {
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
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === 'auth/email-already-in-use' || err.message?.includes('auth/email-already-in-use')) {
        setError('Phone number already registered. Please login.');
      } else {
        setError('Failed to create account. ' + (err.message || ''));
      }
    }
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden h-full">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Leaf className="w-7 h-7" />
            </div>
            <span className="text-2xl font-display font-bold">AgroCarbon</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-display font-bold leading-tight">
              Join the Carbon<br />Credit Revolution
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Connect farmers, companies, and verifiers in a transparent carbon credit ecosystem. Make your agricultural practices count.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-8">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm text-white/70">Farmers Enrolled</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-3xl font-bold">12K</div>
                <div className="text-sm text-white/70">tCO₂ Verified</div>
              </div>
            </div>
          </div>

          <div className="text-sm text-white/60">
            © 2024 AgroCarbon. All rights reserved.
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -right-10 top-1/4 w-40 h-40 rounded-full bg-white/5" />
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 h-full overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">AgroCarbon</span>
            </div>

            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-display font-bold text-foreground">Create Account</h2>
              <p className="mt-2 text-muted-foreground">Select your role and get started</p>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Select Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: role.value })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${formData.role === role.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${formData.role === role.value
                        ? 'bg-primary text-white'
                        : 'bg-secondary text-muted-foreground'
                        }`}>
                        {role.icon}
                      </div>
                      <div className="font-medium text-foreground text-sm">{role.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formData.role === 'company' ? 'Contact Name' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter your name"
                />
              </div>

              {/* Company-specific fields */}
              {formData.role === 'company' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Company Name</label>
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="input-field"
                      placeholder="Enter company name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Min Acres Req.</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.minAcres}
                        onChange={(e) => setFormData({ ...formData, minAcres: parseInt(e.target.value) || 0 })}
                        className="input-field"
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Capacity (Farmers)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                        className="input-field"
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Verifier-specific fields */}
              {formData.role === 'verifier' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Organization</label>
                    <input
                      type="text"
                      required
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="input-field"
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">License Number</label>
                    <input
                      type="text"
                      required
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      className="input-field"
                      placeholder="VVB-XXXX"
                    />
                  </div>
                </>
              )}

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
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field pl-12 pr-12"
                    placeholder="Create password"
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
