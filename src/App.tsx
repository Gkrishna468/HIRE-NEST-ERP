import { checkIsAdmin, checkIsClient, checkIsVendor, checkIsRecruiter, checkIsIndependent, checkIsCandidate } from "./lib/permissions";
import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  MessageSquare,
  Settings,
  ShieldCheck,
  Shield,
  Brain,
  Bell,
  LogOut,
  ChevronRight,
  Activity,
  Network,
  UserCheck,
  Fingerprint,
  Cpu,
  Database,
  BrainCircuit,
  Menu,
  X,
  Zap,
  Target,
  DollarSign,
  FileText,
  Clock,
  Receipt,
  BookOpen,
  Search,
  TrendingUp,
  ShieldAlert,
  Globe2,
  Video,
  Star,
  Award,
  Terminal,
  Bot,
  CheckCircle2,
  Globe,
  MessageCircle,
  Store,
  ChevronDown,
  ChevronUp,
  Mail,
  UserRound
} from "lucide-react";
import { cn } from "./lib/utils";

// Import views
import DashboardTab from "./views/DashboardTab";
import AgentHQ from "./views/AgentHQ";
import CandidatesTab from "./views/CandidatesTab";
import JobsTab from "./views/JobsTab";
import NetworkDirectoryTab from "./views/NetworkDirectoryTab";
import Client360Tab from "./views/Client360Tab";
import AutonomousOperationsTab from "./views/AutonomousOperationsTab";
import WorkflowStudioTab from "./views/WorkflowStudioTab";
import ValidationCenterTab from "./views/ValidationCenterTab";
import SuccessIntelligenceTab from "./views/SuccessIntelligenceTab";
import Vendor360Tab from "./views/Vendor360Tab";
import VendorIntelligenceTab from "./views/VendorIntelligenceTab";
import KnowledgeIntelligenceTab from "./views/KnowledgeIntelligenceTab";
import EnterpriseCommandCenterTab from "./views/EnterpriseCommandCenterTab";
import AIOpsCenterTab from "./views/AIOpsCenterTab";
import { EnterpriseSearchModal } from "./components/EnterpriseSearchModal";
import { UniversalAIChatDrawer } from "./components/UniversalAIChatDrawer";
import AIAgentsTab from "./views/AIAgentsTab";
import FinanceOSTab from "./views/FinanceOSTab";
import AICopilotTab from "./views/AICopilotTab";
import RecruiterPerformanceTab from "./views/RecruiterPerformanceTab";
import RagIntelligenceTab from "./views/RagIntelligenceTab";
import PredictiveIntelligenceTab from "./views/PredictiveIntelligenceTab";
import DealRoomsTab from "./views/DealRoomsTab";
import InterviewsTab from "./views/InterviewsTab";
import { PlacementsTab } from "./views/PlacementsTab";
import InboxTab from "./views/InboxTab";

import WorkflowOperationsTab from "./views/WorkflowOperationsTab";
import OperationalHealthTab from "./views/OperationalHealthTab";
import FinancialsTab from "./views/FinancialsTab";
import MarketplaceTab from "./views/MarketplaceTab";
import RevenueIntelligenceTab from "./views/RevenueIntelligenceTab";
import TrustEngineTab from "./views/TrustEngineTab";
import NotificationsTab from "./views/NotificationsTab";
import Onboarding from "./views/Onboarding";
import MatchIntelligenceTab from "./views/MatchIntelligenceTab";
import AdminOverview from "./views/AdminOverview";
import NetworkTab from "./views/NetworkTab";
import AdminGovernanceDashboard from "./views/AdminGovernanceDashboard";
import AdminSecurityDashboard from "./views/AdminSecurityDashboard";
import AdminOpsDashboard from "./views/AdminOpsDashboard";
import AdminUsersManager from "./views/AdminUsersManager";
import TraceView from "./views/TraceView";
import MemoryMapView from "./views/MemoryMapView";
import TenantUsageDashboard from "./views/TenantUsageDashboard";
import WelcomeDemo from "./components/WelcomeDemo";
import SLAIntelligenceTab from "./views/SLAIntelligenceTab";
import ContractsTab from "./views/ContractsTab";
import TimesheetsTab from "./views/TimesheetsTab";
import InvoicesTab from "./views/InvoicesTab";
import OwnershipLedgerTab from "./views/OwnershipLedgerTab";
import { ExperienceEngine } from "./components/ExperienceEngine";
import { LiveToaster } from "./components/LiveToaster";
import SignalsTab from "./views/SignalsTab";
import { NotificationCenter } from "./components/NotificationCenter";
import LandingPage from "./views/LandingPage";
import AuthPage from "./views/AuthPage";
import { TermsPage, PrivacyPage } from "./views/LegalPages";

import { auth } from "./lib/firebase";
import { signOut } from "firebase/auth";
import { useSystemStore } from "./stores/SystemStore";

import SettingsTab from "./views/SettingsTab";

import BenchmarkDashboard from "./views/BenchmarkDashboard";
import CustomerSuccessDashboard from "./views/CustomerSuccessDashboard";
import AILearningLoopTab from "./views/AILearningLoopTab";
import EvidenceDashboard from "./views/EvidenceDashboard";
import FounderControlTower from "./views/FounderControlTower";
import CandidatePortalWorkspace from "./views/workspaces/CandidatePortalWorkspace";

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  onClick,
  id,
}: {
  to: string;
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  id?: string;
}) => (
  <Link
    to={to}
    id={id}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold uppercase tracking-wider",
      active
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
        : "text-slate-400 hover:bg-slate-50 hover:text-slate-900",
    )}
  >
    <Icon
      size={18}
      className={cn(
        active ? "text-white" : "text-slate-400 group-hover:text-indigo-600",
      )}
    />
    <span>{label}</span>
    {active && <ChevronRight size={14} className="ml-auto" />}
  </Link>
);

const SubSidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  to: string;
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-[13px] font-semibold tracking-wide",
      active
        ? "bg-indigo-50 text-indigo-700 font-bold"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
    )}
  >
    <Icon
      size={16}
      className={cn(
        active ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-600",
      )}
    />
    <span>{label}</span>
  </Link>
);

const AdminGlobalHQNav = ({
  location,
  closeMobileMenu,
}: {
  location: any;
  closeMobileMenu: () => void;
}) => {
  const adminRoutes = [
    '/emails',
    '/client-360',
    '/vendor-360',
    '/admin/candidate-360',
    '/admin/requirement-360'
  ];
  
  const isChildActive = adminRoutes.some(r => location.pathname === r);
  const [isExpanded, setIsExpanded] = React.useState(isChildActive);
  
  React.useEffect(() => {
    if (isChildActive) {
      setIsExpanded(true);
    }
  }, [isChildActive]);

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="admin-global-hq-menu"
        aria-label="Toggle Global HQ menu"
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold uppercase tracking-wider w-full text-left",
          isChildActive && !isExpanded
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
            : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <Globe
          size={18}
          className={cn(
            isChildActive && !isExpanded ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
          )}
        />
        <span>Global HQ</span>
        <div className="ml-auto">
          {isExpanded ? (
            <ChevronUp size={16} className={isChildActive && !isExpanded ? "text-white" : "text-slate-400 group-hover:text-indigo-600"} />
          ) : (
            <ChevronDown size={16} className={isChildActive && !isExpanded ? "text-white" : "text-slate-400 group-hover:text-indigo-600"} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div id="admin-global-hq-menu" className="mt-2 flex flex-col gap-1 pl-4 border-l-2 border-slate-100 ml-6 overflow-hidden">
          <SubSidebarItem
            to="/emails"
            icon={Mail}
            label="Mail OS"
            active={location.pathname === "/emails"}
            onClick={closeMobileMenu}
          />
          <SubSidebarItem
            to="/client-360"
            icon={Building2}
            label="Client 360"
            active={location.pathname === "/client-360"}
            onClick={closeMobileMenu}
          />
          <SubSidebarItem
            to="/vendor-360"
            icon={Store}
            label="Vendor 360"
            active={location.pathname === "/vendor-360"}
            onClick={closeMobileMenu}
          />
          <SubSidebarItem
            to="/admin/candidate-360"
            icon={UserRound}
            label="Candidate 360"
            active={location.pathname === "/admin/candidate-360"}
            onClick={closeMobileMenu}
          />
          <SubSidebarItem
            to="/admin/requirement-360"
            icon={FileText}
            label="Requirement 360"
            active={location.pathname === "/admin/requirement-360"}
            onClick={closeMobileMenu}
          />
        </div>
      )}
    </div>
  );
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userData, loading, showDemo, pilotMode, initialize, closeDemo, togglePilotMode } =
    useSystemStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  React.useEffect(() => {
    const unsub = initialize();
    return () => {
      if (unsub) unsub();
    };
  }, [initialize]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Check if the user is typing in an input field to avoid interrupting text input
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as any).isContentEditable
      );

      // Cmd/Ctrl+K search modal toggle - ALWAYS active
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        return;
      }

      // If user is focused on an input field, do not trigger single key shortcuts
      if (isInput) return;

      // 2. Global AI Copilot toggle (Alt + A)
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setIsAIChatOpen(prev => !prev);
        return;
      }

      // 3. Simple Single Key Shortcuts
      switch (e.key.toLowerCase()) {
        case 'n': // New Requirement context
          e.preventDefault();
          navigate('/jobs');
          break;
        case 's': // Submit / Deal rooms context
          e.preventDefault();
          navigate('/deal-rooms');
          break;
        case 'i': // Schedule Interviews
          e.preventDefault();
          navigate('/interviews');
          break;
        case 'v': // Open Vendor SLA Directory
          e.preventDefault();
          navigate('/network');
          break;
        case 'c': // Open Candidate talent pool
          e.preventDefault();
          navigate('/candidates');
          break;
        case 'a': // Alternate fast shortcut to open Copilot chat drawer
          e.preventDefault();
          setIsAIChatOpen(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            Syncing Node Identity...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route
          path="/onboarding"
          element={
            <Onboarding
              onComplete={async () => {
                await auth.currentUser?.getIdToken(true);
                window.location.reload();
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const role = userData?.role || "guest";
  const isAdmin = checkIsAdmin(role);
  const isClient = checkIsClient(role);
  const isVendor = checkIsVendor(role);
  const isRecruiter = checkIsRecruiter(role);
  const isIndependent = checkIsIndependent(role);
  const isCandidate = checkIsCandidate(role);

  // Strictly route candidate users directly to their isolated Candidate Portal Workspace
  if (isCandidate) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <CandidatePortalWorkspace
          userName={userData?.displayName || userData?.name || user?.displayName || "Candidate"}
          orgId={userData?.organizationId || "ORG-CANDIDATE-COMMUNITY"}
          metrics={null}
        />
      </div>
    );
  }

  const hasCompletedOnboarding =
    userData?.onboardingCompleted === true ||
    (userData?.role &&
      userData?.role !== "PENDING_VERIFICATION" &&
      userData?.status === "ACTIVE" &&
      userData?.organizationId);

  const handleCloseDemo = async () => {
    await closeDemo();
  };

  if (user && !hasCompletedOnboarding && !isAdmin) {
    return (
      <Onboarding
        onComplete={async () => {
          await auth.currentUser?.getIdToken(true);
          window.location.reload();
        }}
      />
    );
  }

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      <LiveToaster orgId={userData?.organizationId} userRole={userData?.role} />
      {hasCompletedOnboarding && showDemo && (
        <WelcomeDemo
          type={isAdmin || isClient ? "client" : "vendor"}
          onClose={handleCloseDemo}
        />
      )}

      {hasCompletedOnboarding && (
        <ExperienceEngine
          user={user}
          userData={userData}
          isAdmin={isAdmin}
          isClient={isClient}
          isVendor={isVendor}
          isRecruiter={isRecruiter}
          isIndependent={isIndependent}
        />
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-72 bg-white border-r border-slate-100 flex flex-col p-6 shadow-sm z-50 fixed lg:relative h-full transition-transform duration-300 ease-in-out",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter">
                HireNest<span className="text-indigo-600">OS</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Enterprise Core
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-900"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          {/* RECRUITER NAVIGATION */}
          {isRecruiter && !isAdmin && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">
                Workspace
              </div>
              <SidebarItem
                to="/"
                icon={LayoutDashboard}
                label="Dashboard"
                active={location.pathname === "/"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-requirements"
                to="/jobs"
                icon={Briefcase}
                label="Requirements"
                active={location.pathname === "/jobs"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-candidates"
                to="/candidates"
                icon={Users}
                label="Candidates"
                active={location.pathname === "/candidates"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/matches"
                icon={Star}
                label="Match Intelligence"
                active={location.pathname === "/matches"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-submissions"
                to="/deal-rooms"
                icon={MessageSquare}
                label="Submissions"
                active={location.pathname === "/deal-rooms"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-interviews"
                to="/interviews"
                icon={Video}
                label="Interviews"
                active={location.pathname === "/interviews"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/marketplace"
                icon={Store}
                label="Marketplace"
                active={location.pathname === "/marketplace"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/network"
                icon={Building2}
                label="Vendors"
                active={location.pathname === "/network"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-reports"
                to="/financials"
                icon={FileText}
                label="Reports"
                active={location.pathname === "/financials"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/emails"
                icon={MessageSquare}
                label="Intake Dashboard"
                active={location.pathname === "/emails"}
                onClick={() => setIsMobileMenuOpen(false)}
              />

            </>
          )}

          {/* VENDOR NAVIGATION */}
          {isVendor && !isAdmin && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">
                Workspace
              </div>
              <SidebarItem
                to="/"
                icon={LayoutDashboard}
                label="Dashboard"
                active={location.pathname === "/"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-requirements"
                to="/jobs"
                icon={Briefcase}
                label="Open Requirements"
                active={location.pathname === "/jobs"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-candidates"
                to="/candidates"
                icon={Users}
                label="Candidates"
                active={location.pathname === "/candidates"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/matches"
                icon={Star}
                label="Match Intelligence"
                active={location.pathname === "/matches"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-submissions"
                to="/deal-rooms"
                icon={MessageSquare}
                label="Submissions"
                active={location.pathname === "/deal-rooms"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/interviews"
                icon={Video}
                label="Interviews"
                active={location.pathname === "/interviews"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}

          {/* CLIENT NAVIGATION */}
          {isClient && !isAdmin && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">
                Workspace
              </div>
              <SidebarItem
                to="/"
                icon={LayoutDashboard}
                label="Dashboard"
                active={location.pathname === "/"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-requirements"
                to="/jobs"
                icon={Briefcase}
                label="Requirements"
                active={location.pathname === "/jobs"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-candidates"
                to="/candidates"
                icon={Users}
                label="Candidates"
                active={location.pathname === "/candidates"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-interviews"
                to="/interviews"
                icon={Video}
                label="Interviews"
                active={location.pathname === "/interviews"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                id="tour-submissions"
                to="/placements"
                icon={Target}
                label="Placements"
                active={location.pathname === "/placements"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}

          {/* INDEPENDENT OR GUEST (Fallback) */}
          {!isAdmin && !isRecruiter && !isVendor && !isClient && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">
                Workspace
              </div>
              <SidebarItem
                to="/"
                icon={LayoutDashboard}
                label="Dashboard"
                active={location.pathname === "/"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/jobs"
                icon={Briefcase}
                label="Requirements"
                active={location.pathname === "/jobs"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/candidates"
                icon={Users}
                label="Candidates"
                active={location.pathname === "/candidates"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}

          {/* EXECUTIVE ADMIN NAVIGATION */}
          {isAdmin && (
            <>
              <SidebarItem
                to="/admin"
                icon={LayoutDashboard}
                label="Home"
                active={location.pathname === "/admin"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/autonomous-operations"
                icon={Activity}
                label="Mission Control"
                active={location.pathname === "/autonomous-operations"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/ai-operations"
                icon={Bot}
                label="AI Operations"
                active={location.pathname === "/ai-operations"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/ops"
                icon={Briefcase}
                label="Operations"
                active={location.pathname === "/ops"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <AdminGlobalHQNav 
                location={location} 
                closeMobileMenu={() => setIsMobileMenuOpen(false)} 
              />
              <SidebarItem
                to="/users"
                icon={Users}
                label="Users"
                active={location.pathname === "/users"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/settings"
                icon={Settings}
                label="Settings"
                active={location.pathname === "/settings"}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 space-y-2">
          <button
            onClick={() => signOut(auth)}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-bold uppercase tracking-wider cursor-pointer"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden w-full lg:w-auto">
        {/* Global Navigation Hub */}
        <header className="h-16 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between shrink-0 z-40">
          <div className="flex items-center gap-3 md:gap-6">
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-50"
            >
              <Menu size={24} />
            </button>
            <div className={cn(
              "text-white px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase italic hidden sm:block transition-colors",
              pilotMode ? "bg-indigo-600" : "bg-slate-900"
            )}>
              Node:{" "}
              {isAdmin
                ? "Global HQ"
                : isClient
                  ? "Client Workspace"
                  : isVendor
                    ? "Vendor Workspace"
                    : isRecruiter
                      ? "Recruiter Workspace"
                      : "User Workspace"}
              {pilotMode && " (Pilot)"}
            </div>

            {isAdmin && (
              <div className="hidden lg:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button 
                  onClick={() => togglePilotMode(false)}
                  className={cn(
                    "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                    !pilotMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Sandbox
                </button>
                <button 
                  onClick={() => togglePilotMode(true)}
                  className={cn(
                    "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                    pilotMode ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Pilot
                </button>
              </div>
            )}

            {/* Universal Search Bar */}
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 py-2 w-64 hover:bg-slate-100 transition-all cursor-text" onClick={() => setIsSearchOpen(true)}>
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search Knowledge Graph..."
                className="bg-transparent border-none outline-none text-xs font-medium w-full ml-2 text-slate-700 placeholder-slate-400 pointer-events-none"
                readOnly
              />
              <div className="ml-2 bg-slate-200 text-slate-500 text-[9px] rounded px-1.5 py-0.5 font-mono opacity-60 pointer-events-none">
                ⌘K
              </div>
            </div>

            <div className="flex items-center gap-2 hidden lg:flex">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Protocol Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Ask Copilot Button */}
            <button
              onClick={() => setIsAIChatOpen(true)}
              className="flex items-center gap-2 px-4 h-10 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-100 group shrink-0"
            >
              <Bot size={14} className="group-hover:animate-bounce" />
              <span>Ask Copilot</span>
              <div className="bg-white/20 text-white text-[8px] rounded px-1.5 py-0.5 font-mono">
                ⌥A
              </div>
            </button>

            <div className="hidden md:flex items-center bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100 gap-3">
              <ShieldCheck size={14} className="text-indigo-600" />
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                Authority: {userData?.role?.replace("_", " ") || "User"}
              </span>
            </div>
            {isAdmin && (
              <Link
                to="/client-360"
                className="hidden sm:flex bg-slate-900 text-white px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-200 items-center gap-2"
              >
                <Users size={14} />
                Clients & Vendors
              </Link>
            )}
            <NotificationCenter userRole={userData?.role} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardTab />} />
            {isAdmin && <Route path="/hq" element={<AgentHQ />} />}
            {isAdmin && <Route path="/signals" element={<SignalsTab />} />}
            {isAdmin && (
              <Route path="/rag-intel" element={<RagIntelligenceTab />} />
            )}
            {isAdmin && (
              <Route
                path="/predictive"
                element={
                  <PredictiveIntelligenceTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                  />
                }
              />
            )}
            <Route path="/candidates" element={<CandidatesTab />} />
            <Route path="/matches" element={<MatchIntelligenceTab />} />
            <Route path="/jobs" element={<JobsTab />} />
            <Route path="/pipeline" element={<CandidatesTab />} />
            {(isAdmin || isRecruiter) && (
              <Route path="/network" element={<NetworkTab />} />
            )}
            <Route path="/client-360" element={<Client360Tab userRole={role || ""} />} />
            <Route path="/vendor-360" element={<Vendor360Tab userRole={role || ""} />} />
            {isAdmin && (
              <Route path="/benchmarks" element={<BenchmarkDashboard />} />
            )}
            {isAdmin && (
              <Route path="/adoption" element={<CustomerSuccessDashboard />} />
            )}
            {isAdmin && (
              <Route path="/ai-learning" element={<AILearningLoopTab />} />
            )}
            {isAdmin && (
              <Route path="/evidence" element={<EvidenceDashboard />} />
            )}
            {isAdmin && (
              <Route path="/founder-tower" element={<FounderControlTower />} />
            )}
            {isAdmin && (
              <Route
                path="/health"
                element={
                  <OperationalHealthTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                    userId={user?.uid || ""}
                  />
                }
              />
            )}
            {(isAdmin || isRecruiter) && (
              <Route
                path="/financials"
                element={
                  <FinancialsTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                    userId={user?.uid || ""}
                  />
                }
              />
            )}
            {(isAdmin || isRecruiter) && (
              <Route
                path="/revenue-intelligence"
                element={
                  <RevenueIntelligenceTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                  />
                }
              />
            )}
            {(isAdmin || isRecruiter) && (
              <Route
                path="/client-360"
                element={<Client360Tab userRole={role || ""} />}
              />
            )}
            {(isAdmin || isRecruiter) && (
              <Route
                path="/vendor-360"
                element={<Vendor360Tab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/vendor-intelligence"
                element={<VendorIntelligenceTab />}
              />
            )}
            {isAdmin && (
              <Route
                path="/ai-copilot"
                element={<AICopilotTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/autonomous-operations"
                element={<AutonomousOperationsTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/workflow-studio"
                element={<WorkflowStudioTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/validation-center"
                element={<ValidationCenterTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/success-intelligence"
                element={<SuccessIntelligenceTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/knowledge-graph"
                element={<KnowledgeIntelligenceTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/ai-agents"
                element={<AIAgentsTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/ai-ops-center"
                element={<AIOpsCenterTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/ai-operations"
                element={<AIOpsCenterTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/enterprise-command-center"
                element={<EnterpriseCommandCenterTab userRole={role || ""} />}
              />
            )}
            {isAdmin && (
              <Route
                path="/finance-os"
                element={<FinanceOSTab userRole={role || ""} />}
              />
            )}
            {(isAdmin || isRecruiter) && (
              <Route
                path="/recruiter-performance"
                element={<RecruiterPerformanceTab userRole={role || ""} />}
              />
            )}
            {(isAdmin || isVendor) && (
              <Route
                path="/trust-sla"
                element={
                  <TrustEngineTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                  />
                }
              />
            )}
            <Route path="/deal-rooms" element={<DealRoomsTab />} />
            <Route path="/marketplace" element={<MarketplaceTab />} />
            <Route path="/placements" element={<PlacementsTab />} />
            <Route path="/interviews" element={<InterviewsTab />} />
            <Route path="/emails" element={<InboxTab />} />
            {isAdmin && (
              <Route
                path="/operations"
                element={
                  <WorkflowOperationsTab
                    userRole={role || ""}
                    orgId={userData?.organizationId || ""}
                  />
                }
              />
            )}
            {isAdmin && <Route path="/admin" element={<AdminOverview />} />}
            {isAdmin && (
              <Route
                path="/governance"
                element={<AdminGovernanceDashboard />}
              />
            )}
            {isAdmin && (
              <Route
                path="/users"
                element={<AdminUsersManager orgData={userData} />}
              />
            )}
            {isAdmin && <Route path="/trace" element={<TraceView />} />}
            {isAdmin && <Route path="/map" element={<MemoryMapView />} />}
            {isAdmin && <Route path="/ops" element={<AdminOpsDashboard />} />}
            {isAdmin && <Route path="/security" element={<AdminSecurityDashboard />} />}
            {isAdmin && <Route path="/sla" element={<SLAIntelligenceTab />} />}
            {(isAdmin || isVendor || isRecruiter) && (
              <Route path="/ownership" element={<OwnershipLedgerTab />} />
            )}
            {isAdmin && <Route path="/contracts" element={<ContractsTab />} />}
            <Route path="/timesheets" element={<TimesheetsTab />} />
            <Route path="/invoices" element={<InvoicesTab />} />
            {isAdmin && <Route path="/admin/candidate-360" element={<CandidatesTab />} />}
            {isAdmin && <Route path="/admin/requirement-360" element={<JobsTab />} />}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route
              path="/usage"
              element={<TenantUsageDashboard orgData={userData} />}
            />
            <Route
              path="/notifications"
              element={
                <NotificationsTab
                  org={{ id: userData?.organizationId }}
                  role={userData?.role}
                />
              }
            />
            <Route
              path="/onboarding"
              element={
                <Onboarding onComplete={() => window.location.reload()} />
              }
            />
            <Route
              path="/settings"
              element={
                user && !loading ? (
                  <SettingsTab />
                ) : (
                  <Navigate to="/dashboard" />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <EnterpriseSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onToggleAIChat={() => setIsAIChatOpen(true)}
      />

      <UniversalAIChatDrawer 
        isOpen={isAIChatOpen} 
        onClose={() => setIsAIChatOpen(false)} 
      />
    </div>
  );
};

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
