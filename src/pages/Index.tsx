import { Link } from 'react-router-dom';
import { Leaf, ArrowRight, User, Building2, Shield, Archive, Check } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="gradient-hero text-white">
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf className="w-6 h-6" />
            </div>
            <span className="text-xl font-display font-bold">AgroCarbon</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-white/80 hover:text-white transition-colors">Sign In</Link>
            <Link to="/signup" className="bg-white text-primary px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
              Get Started
            </Link>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
            Carbon Credits for<br />Sustainable Agriculture
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
            Connect farmers, companies, and verifiers in a transparent ecosystem. Calculate, verify, and monetize carbon sequestration.
          </p>
          <Link to="/signup" className="btn-accent gap-2 text-lg">
            Start Your Journey <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Role Cards */}
      <div className="container mx-auto px-6 -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: User, title: 'Farmer', desc: 'Estimate CO₂ & join projects', gradient: 'gradient-farmer' },
            { icon: Building2, title: 'Company', desc: 'Manage farmers & batches', gradient: 'gradient-company' },
            { icon: Shield, title: 'Verifier', desc: 'Verify carbon credits', gradient: 'gradient-verifier' },
            { icon: Archive, title: 'Registry', desc: 'Track all issuances', gradient: 'gradient-registry' },
          ].map((role) => (
            <div key={role.title} className="card-elevated p-6 text-center hover:shadow-lg transition-shadow">
              <div className={`w-14 h-14 rounded-2xl ${role.gradient} flex items-center justify-center mx-auto mb-4`}>
                <role.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-bold text-foreground mb-1">{role.title}</h3>
              <p className="text-sm text-muted-foreground">{role.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-display font-bold text-center text-foreground mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Map & Estimate', desc: 'Farmers draw their farm on the map, enter practices, and get instant CO₂ estimates using SOC, NDVI & rainfall data.' },
            { step: '2', title: 'Join & Batch', desc: 'Apply to projects. Companies group farmers into monthly batches and send them for third-party verification.' },
            { step: '3', title: 'Verify & Issue', desc: 'Verifiers review plots and submit verified credits. Registry tracks all issued carbon credits transparently.' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-display font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2024 AgroCarbon. Empowering sustainable agriculture through carbon credits.
        </div>
      </footer>
    </div>
  );
}
