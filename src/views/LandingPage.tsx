import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HireNestBrandLogo } from '../components/brand/HireNestBrandLogo';
import { 
  ShieldCheck, 
  Zap, 
  Bot, 
  Globe, 
  CheckCircle2, 
  ArrowRight, 
  Mail, 
  Building2, 
  Users, 
  Activity,
  ChevronRight,
  Shield,
  MessageSquare,
  Lock,
  Menu,
  X,
  Sparkles,
  UploadCloud,
  Briefcase,
  UserCheck,
  Star
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { CandidateRegisterModal } from '../components/CandidateRegisterModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateModalMode, setCandidateModalMode] = useState<"REGISTER" | "LOGIN">("REGISTER");

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    companyEmail: '',
    phone: '',
    plan: 'Professional'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const openCandidateRegister = () => {
    setCandidateModalMode("REGISTER");
    setCandidateModalOpen(true);
  };

  const openCandidateLogin = () => {
    navigate('/login?role=candidate');
  };

  const handlePlanSelection = (planName: string) => {
    setFormData(prev => ({ ...prev, plan: planName }));
    const element = document.getElementById('early-access');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      console.log("[LandingPage] Submitting lead to server...");
      
      const response = await fetch('/api/public/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      // Read the body as text first — the server (or a proxy in front of
      // it) can occasionally return a non-JSON error body, and calling
      // response.json() directly on that throws a confusing SyntaxError
      // instead of the actual failure reason.
      const rawBody = await response.text();
      let payload: any = {};
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          console.warn("[LandingPage] Non-JSON response body:", rawBody.slice(0, 200));
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || `Failed to submit via server (status ${response.status})`);
      }

      console.log("[LandingPage] Lead submitted successfully!");
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("[LandingPage] Error submitting lead:", err);
      setError("Submission failed. Please email us at info@hirenestworkforce.com");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <HireNestBrandLogo size="md" theme="dark" showSubtitle />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Pricing</a>
            
            {/* Candidate Portal First-Class Action */}
            <div className="flex items-center gap-2 bg-indigo-950/60 p-1 rounded-2xl border border-indigo-500/30">
              <button 
                onClick={openCandidateRegister}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-900/30"
              >
                <Sparkles size={14} /> Candidate Register (CV Match)
              </button>
              <Link 
                to="/login?role=candidate" 
                className="text-xs font-bold uppercase tracking-wider text-indigo-300 hover:text-white px-3 py-2 transition-colors"
              >
                Candidate Login
              </Link>
            </div>

            <Link to="/login" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Enterprise Login</Link>
            <button 
              onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/10"
            >
              Get Access
            </button>
          </div>

          {/* Mobile Actions: Always show Login, and a menu toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={openCandidateRegister}
              className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl transition-all"
            >
              Upload CV
            </button>
            <Link to="/login" className="text-[10px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl border border-white/10 transition-all">
              Login
            </Link>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl border border-white/5"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950 border-b border-white/5 px-6 py-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">Candidate Entry Point</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openCandidateRegister();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Sparkles size={14} /> Register CV & AI Match
              </button>
              <Link
                to="/login?role=candidate"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center text-xs font-bold text-indigo-300 py-1"
              >
                Candidate Login →
              </Link>
            </div>

            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
            >
              Features
            </a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
            >
              Pricing
            </a>
            <div className="pt-2 border-t border-white/5 flex flex-col gap-3">
              <Link 
                to="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all border border-white/5"
              >
                Enterprise Login
              </Link>
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3 bg-white hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-950 transition-all text-center"
              >
                Get Early Access
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-indigo-600/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              <Zap size={14} className="text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">AI-Native • Automate • Scale</span>
            </div>
            
            <h2 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9]">
              Run Your Staffing <br />
              Business on <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Autopilot</span>
            </h2>
            
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg font-medium">
              The Enterprise Recruitment Intelligence OS. A layered AI-native workforce platform unifying knowledge, tools, skills, and agents.
            </p>

            <div className="flex flex-wrap gap-6 pt-4">
              {[
                { icon: CheckCircle2, text: "Autonomous Workflows" },
                { icon: CheckCircle2, text: "Real-time Intelligence" },
                { icon: CheckCircle2, text: "Direct Candidate Portal" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <item.icon size={16} className="text-indigo-500" />
                  {item.text}
                </div>
              ))}
            </div>

            {/* Candidate & Enterprise Dual CTAs */}
            <div className="pt-6 space-y-4">
              <div className="p-6 bg-gradient-to-r from-indigo-950/80 to-purple-950/60 border border-indigo-500/30 rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">For Candidates & Job Seekers</h4>
                      <p className="text-[11px] text-indigo-300 font-medium">Instant AI Fitment • Full-Time & C2H Roles</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    Direct Apply
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button 
                    onClick={openCandidateRegister}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:scale-[1.02] transition-all"
                  >
                    <UploadCloud size={16} /> Register CV & Instant Match
                  </button>
                  <Link 
                    to="/login?role=candidate"
                    className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all text-center"
                  >
                    Candidate Login
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group flex items-center gap-3 bg-white text-slate-950 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                >
                  Join Early Access <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </button>
                <Link
                  to="/login"
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all"
                >
                  Enterprise Login →
                </Link>
              </div>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-right duration-1000 delay-300">
            <div className="relative bg-slate-900 border border-white/10 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden shadow-indigo-500/10">
              <img 
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop" 
                alt="Dashboard Mockup" 
                className="w-full h-auto rounded-[2rem] opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              
              <div className="absolute bottom-10 left-10 right-10 p-8 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-3xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase">Mission Control</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active System Projection</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-3/4 animate-pulse" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>AI EFFICIENCY</span>
                    <span className="text-indigo-400">94.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By / Partner Network */}
      <section className="py-24 border-y border-white/5 bg-slate-950/20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">The Network</p>
            <h3 className="text-2xl font-black tracking-tighter text-white">Trusted by IT Staffing Partners</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Partner 1: Mapout */}
            <div className="group p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center justify-center text-center gap-6">
              <div className="h-16 w-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Globe size={32} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-lg font-black tracking-tight text-white mb-1">Mapout Inc</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">Global Client Partner</p>
              </div>
            </div>

            {/* Partner 2: Worknexa */}
            <div className="group p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center justify-center text-center gap-6">
              <div className="h-16 w-16 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                <Users size={32} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-lg font-black tracking-tight text-white mb-1">Worknexa</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-purple-400 transition-colors">Strategic Vendor</p>
              </div>
            </div>

            {/* Partner 3: Shreeji */}
            <div className="group p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center justify-center text-center gap-6">
              <div className="h-16 w-16 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                <Building2 size={32} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-lg font-black tracking-tight text-white mb-1">Shreeji Consulting</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-400 transition-colors">Platform Beta Partner</p>
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-slate-950 bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-500">
                  +
                </div>
              ))}
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">
              100+ Vendors & Clients joining the ecosystem soon
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-4">The Operating System</h3>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">Everything You Need. All in One OS.</h2>
            <p className="text-slate-400 font-medium leading-relaxed">Ditch the siloed tools. HireNestOS unifies every stakeholder in your staffing ecosystem with AI-powered intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Mail, title: "Knowledge Layer", desc: "Enterprise memory & RAG across your entire organizational history." },
              { icon: Zap, title: "Intelligence Layer", desc: "Reusable recruitment skills from fillability scoring to rank prediction." },
              { icon: Bot, title: "Agent Workforce", desc: "Coordinated autonomous AI agents collaborating with human teams." },
              { icon: Activity, title: "Deep Integration", desc: "Seamless connectors linking Gmail, ATS, billing, and operational data." }
            ].map((feature, i) => (
              <div key={i} className="group p-8 bg-slate-900/50 border border-white/5 rounded-[2rem] hover:bg-slate-900 hover:border-indigo-500/20 transition-all">
                <div className="h-12 w-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={24} />
                </div>
                <h4 className="text-lg font-black mb-3">{feature.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-slate-950/50 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-4">Pricing</h3>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">Scale with AI Intelligence</h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              An affordable AI-native Staffing Operating System combining ATS, CRM, VMS, and AI Matching in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free */}
            <div className="p-8 bg-slate-900/30 border border-white/5 rounded-[2rem] flex flex-col hover:bg-slate-900 hover:border-white/10 transition-all">
              <div className="mb-8">
                <h4 className="text-lg font-black mb-2">Free</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹0</span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/month</span>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">Explore the platform</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "1 Recruiter",
                  "50 Candidates",
                  "5 Requirements",
                  "Basic AI Matching"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handlePlanSelection('Free')}
                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Professional */}
            <div className="p-8 bg-slate-900 border border-indigo-500/30 rounded-[2rem] flex flex-col relative transform lg:-translate-y-4 shadow-2xl shadow-indigo-500/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                ⭐ Most Popular
              </div>
              <div className="mb-8">
                <h4 className="text-lg font-black mb-2 text-indigo-400">Professional</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">₹499</span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/month</span>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">Flagship plan for growing agencies</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "5 Recruiters",
                  "Vendor OS",
                  "Client OS",
                  "MailOS",
                  "AI Copilot",
                  "Workflow Automation",
                  "Calendar Integration"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handlePlanSelection('Professional')}
                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xl shadow-indigo-900/40"
              >
                Start Free Trial
              </button>
            </div>

            {/* Business */}
            <div className="p-8 bg-slate-900/30 border border-white/5 rounded-[2rem] flex flex-col hover:bg-slate-900 hover:border-white/10 transition-all">
              <div className="mb-8">
                <h4 className="text-lg font-black mb-2">Business</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹999</span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/month</span>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">For scaling agencies</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "20 Recruiters",
                  "AI Workforce",
                  "Vendor Intelligence",
                  "Client Intelligence",
                  "Executive Dashboard",
                  "Priority Support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handlePlanSelection('Business (Book Demo)')}
                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-colors"
              >
                Book Demo
              </button>
            </div>

            {/* Enterprise AI */}
            <div className="p-8 bg-slate-900/30 border border-white/5 rounded-[2rem] flex flex-col hover:bg-slate-900 hover:border-white/10 transition-all">
              <div className="mb-8">
                <h4 className="text-lg font-black mb-2">Enterprise AI</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹1,999</span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/month</span>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">Large staffing firms & GCC partners</p>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Unlimited Users",
                  "AI COO & Global HQ",
                  "Business Graph",
                  "White Label",
                  "API Access",
                  "Dedicated Success Manager"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a 
                href="mailto:info@hirenestworkforce.com?subject=Enterprise AI Inquiry"
                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-colors text-center"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Early Access Form */}
      <section id="early-access" className="py-32 px-6 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[100px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto bg-slate-900 border border-white/10 rounded-[3rem] p-8 md:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-6">
              <h2 className="text-4xl font-black tracking-tighter leading-none">Get Early Access</h2>
              <p className="text-slate-400 leading-relaxed font-medium">
                Join the future of staffing. Be among the first to experience AI-powered hiring at scale. We are currently rolling out access to selected partners.
              </p>
              
              <div className="space-y-4 pt-4">
                {[
                  "No Setup Fees",
                  "Dedicated Success Manager",
                  "Early Adopter Pricing",
                  "Priority Feature Requests"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-300">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div>
              {isSubmitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500">
                  <div className="h-20 w-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mb-2">Request Received</h3>
                    <p className="text-slate-400 text-sm font-medium">Thank you for your interest. Our success team will contact you within 24 hours at the provided email addresses.</p>
                  </div>
                  <button 
                    onClick={() => setIsSubmitted(false)}
                    className="text-indigo-400 text-xs font-black uppercase tracking-widest hover:text-indigo-300"
                  >
                    Submit another response
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                      <input 
                        type="text" 
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Plan Selection</label>
                      <select 
                        name="plan"
                        value={formData.plan}
                        onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors text-white appearance-none"
                      >
                        <option value="Free">Free</option>
                        <option value="Professional">Professional</option>
                        <option value="Business (Book Demo)">Business (Book Demo)</option>
                        <option value="Enterprise AI">Enterprise AI</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Company Name</label>
                      <input 
                        type="text" 
                        name="companyName"
                        required
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        placeholder="Acme Staffing"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Phone Number (Optional)</label>
                      <input 
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        placeholder="+91 XXXXX XXXXX"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Personal Email</label>
                      <input 
                        type="email" 
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        placeholder="john@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Company Email</label>
                      <input 
                        type="email" 
                        name="companyEmail"
                        required
                        value={formData.companyEmail}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                        placeholder="john@acme.com"
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-900/40"
                  >
                    {isSubmitting ? "Processing..." : "Secure Early Access"}
                  </button>

                  <p className="text-[10px] text-slate-500 text-center font-medium">
                    By joining, you agree to our <Link to="/terms" className="text-slate-400 underline">Terms</Link> and <Link to="/privacy" className="text-slate-400 underline">Privacy Policy</Link>.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pre-Footer CTAs */}
      <section className="py-24 px-6 border-t border-white/5 bg-slate-900/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
          <button 
            onClick={() => handlePlanSelection('Professional')}
            className="flex-1 p-8 rounded-2xl bg-slate-950 border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all text-left group flex flex-col"
          >
            <h3 className="text-xl font-black mb-2 flex items-center justify-between">
              Start Free Trial
              <ArrowRight className="w-5 h-5 text-indigo-500 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-sm text-slate-400 font-medium">14-day free trial. No credit card required.</p>
          </button>
          
          <button 
            onClick={() => handlePlanSelection('Business (Book Demo)')}
            className="flex-1 p-8 rounded-2xl bg-slate-950 border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all text-left group flex flex-col"
          >
            <h3 className="text-xl font-black mb-2 flex items-center justify-between">
              Book a Demo
              <ArrowRight className="w-5 h-5 text-indigo-500 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-sm text-slate-400 font-medium">See HireNestOS in action with our product experts.</p>
          </button>
          
          <button 
            onClick={() => {
              const element = document.getElementById('early-access');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex-1 p-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 transition-all text-left group flex flex-col shadow-xl shadow-indigo-900/20"
          >
            <h3 className="text-xl font-black mb-2 flex items-center justify-between text-white">
              Join Early Access
              <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-sm text-indigo-200 font-medium">Get priority access to new AI features and product releases.</p>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-24 pb-12 px-6 border-t border-white/5 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-20">
            {/* Brand & Description */}
            <div className="lg:col-span-2 space-y-6">
              <HireNestBrandLogo size="md" theme="dark" showSubtitle />
              <p className="text-sm text-slate-400 leading-relaxed font-medium">
                <strong className="text-slate-300">The Enterprise Recruitment Intelligence OS combining Knowledge, Data, Integrations, Skills, and Agents in one platform.</strong>
              </p>
              
              {/* Trust Badges */}
              <div className="pt-4 flex flex-wrap gap-2">
                {["Enterprise Ready", "AI Powered", "SOC 2 (Coming Soon)", "GDPR Ready"].map(badge => (
                  <span key={badge} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Links Columns */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-200">Platform</h4>
              <ul className="space-y-3">
                {["Recruiter OS", "Vendor OS", "Client OS", "AI Workforce", "Global HQ", "Pricing"].map(link => (
                  <li key={link}><a href="#" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">{link}</a></li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-200">Company</h4>
              <ul className="space-y-3">
                {["About", "Customers", "Partners", "Careers", "Blog", "Contact"].map(link => (
                  <li key={link}><a href="#" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">{link}</a></li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-200">Legal & Support</h4>
              <ul className="space-y-3">
                {["Help Center", "API Docs", "Privacy Policy", "Terms of Service", "Security"].map(link => (
                  <li key={link}><a href="#" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">{link}</a></li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Bottom Footer */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">
                <strong>HireNest Workforce Pvt. Ltd.</strong><br />
                📍 Hyderabad, Telangana, India<br />
                📧 <a href="mailto:support@hirenestworkforce.com" className="hover:text-indigo-400 transition-colors">support@hirenestworkforce.com</a>
              </p>
            </div>
            <div className="text-left md:text-right space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">© 2026 HireNest Workforce Pvt. Ltd. All rights reserved.</p>
              <div className="flex gap-4 md:justify-end mt-2">
                <a href="#" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">LinkedIn</a>
                <a href="#" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">X (Twitter)</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Candidate Registration & AI Matching Modal */}
      <CandidateRegisterModal
        isOpen={candidateModalOpen}
        onClose={() => setCandidateModalOpen(false)}
        initialMode={candidateModalMode}
        onSwitchToLogin={openCandidateLogin}
      />
    </div>
  );
}
