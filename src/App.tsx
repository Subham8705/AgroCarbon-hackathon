import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyFarmers from './pages/company/CompanyFarmers';
import CompanyBatches from './pages/company/CompanyBatches';
import CompanyVerification from './pages/company/CompanyVerification';
import ProjectDesignDocument from './pages/company/ProjectDesignDocument';
import MyPDD from './pages/company/MyPDD';
import CompanyRequests from './pages/company/CompanyRequests';
import CompanyCredits from './pages/company/CompanyCredits';
import CompanySales from './pages/company/CompanySales';
import RegistryDashboard from './pages/registry/RegistryDashboard';
import RegistryIssuances from './pages/registry/RegistryIssuances';
import ProjectApprovals from './pages/registry/ProjectApprovals';
import VerifierDashboard from './pages/verifier/VerifierDashboard';
import VerifierRequests from './pages/verifier/VerifierRequests';
import VerifierVerified from './pages/verifier/VerifierVerified';
import VerifierVerify from './pages/verifier/VerifierVerify';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import FarmerDashboard from './pages/farmer/FarmerDashboard';
import FarmerEstimate from './pages/farmer/FarmerEstimate';
import FarmerProjects from './pages/farmer/FarmerProjects';
import FarmerMyProject from './pages/farmer/FarmerMyProject';
import RegistryPDDRequests from './pages/registry/PDDRequests';

import RegistryValidationRequests from './pages/registry/RegistryValidationRequests';
import BuyerDashboard from './pages/buyer/BuyerDashboard';
import Marketplace from './pages/buyer/Marketplace';
import BuyerPurchases from './pages/buyer/BuyerPurchases';
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentRegisterFarmer from './pages/agent/AgentRegisterFarmer';
import AgentProjects from './pages/agent/AgentProjects';
import AgentProjectDetails from './pages/agent/AgentProjectDetails';
import AgentMyProjects from './pages/agent/AgentMyProjects';
import AgentFarmerMap from './pages/agent/AgentFarmerMap';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Farmer Routes */}
          <Route path="/farmer/dashboard" element={<ProtectedRoute allowedRoles={['farmer']}><FarmerDashboard /></ProtectedRoute>} />
          <Route path="/farmer/estimate" element={<ProtectedRoute allowedRoles={['farmer']}><FarmerEstimate /></ProtectedRoute>} />
          <Route path="/farmer/projects" element={<ProtectedRoute allowedRoles={['farmer']}><FarmerProjects /></ProtectedRoute>} />
          <Route path="/farmer/my-project" element={<ProtectedRoute allowedRoles={['farmer']}><FarmerMyProject /></ProtectedRoute>} />
          <Route path="/farmer" element={<Navigate to="/farmer/dashboard" replace />} />

          {/* Company Routes */}
          <Route path="/company/dashboard" element={<ProtectedRoute allowedRoles={['company']}><CompanyDashboard /></ProtectedRoute>} />
          <Route path="/company/farmers" element={<ProtectedRoute allowedRoles={['company']}><CompanyFarmers /></ProtectedRoute>} />
          <Route path="/company/batches" element={<ProtectedRoute allowedRoles={['company']}><CompanyBatches /></ProtectedRoute>} />
          <Route path="/company/requests" element={<ProtectedRoute allowedRoles={['company']}><CompanyRequests /></ProtectedRoute>} />
          <Route path="/company/verification" element={<ProtectedRoute allowedRoles={['company']}><CompanyVerification /></ProtectedRoute>} />
          <Route path="/company/pdd" element={<ProtectedRoute allowedRoles={['company']}><ProjectDesignDocument /></ProtectedRoute>} />
          <Route path="/company/my-pdd" element={<ProtectedRoute allowedRoles={['company']}><MyPDD /></ProtectedRoute>} />
          <Route path="/company/credits" element={<ProtectedRoute allowedRoles={['company']}><CompanyCredits /></ProtectedRoute>} />
          <Route path="/company/sales" element={<ProtectedRoute allowedRoles={['company']}><CompanySales /></ProtectedRoute>} />
          <Route path="/company" element={<Navigate to="/company/dashboard" replace />} />

          {/* Registry Routes */}
          <Route path="/registry/dashboard" element={<ProtectedRoute allowedRoles={['registry']}><RegistryDashboard /></ProtectedRoute>} />
          <Route path="/registry/pdd-requests" element={<ProtectedRoute allowedRoles={['registry']}><RegistryPDDRequests /></ProtectedRoute>} />
          <Route path="/registry/validation-reviews" element={<ProtectedRoute allowedRoles={['registry']}><RegistryValidationRequests /></ProtectedRoute>} />
          <Route path="/registry/approvals" element={<ProtectedRoute allowedRoles={['registry']}><ProjectApprovals /></ProtectedRoute>} />
          <Route path="/registry/issuances" element={<ProtectedRoute allowedRoles={['registry']}><RegistryIssuances /></ProtectedRoute>} />
          <Route path="/registry" element={<Navigate to="/registry/dashboard" replace />} />

          {/* Verifier Routes */}
          <Route path="/verifier/dashboard" element={<ProtectedRoute allowedRoles={['verifier']}><VerifierDashboard /></ProtectedRoute>} />
          <Route path="/verifier/requests" element={<ProtectedRoute allowedRoles={['verifier']}><VerifierRequests /></ProtectedRoute>} />
          <Route path="/verifier/verified" element={<ProtectedRoute allowedRoles={['verifier']}><VerifierVerified /></ProtectedRoute>} />
          <Route path="/verifier/verify/:id" element={<ProtectedRoute allowedRoles={['verifier']}><VerifierVerify /></ProtectedRoute>} />
          <Route path="/verifier" element={<Navigate to="/verifier/dashboard" replace />} />


          {/* Buyer Routes */}
          <Route path="/buyer/dashboard" element={<ProtectedRoute allowedRoles={['buyer']}><BuyerDashboard /></ProtectedRoute>} />
          <Route path="/buyer/marketplace" element={<ProtectedRoute allowedRoles={['buyer']}><Marketplace /></ProtectedRoute>} />
          <Route path="/buyer/purchases" element={<ProtectedRoute allowedRoles={['buyer']}><BuyerPurchases /></ProtectedRoute>} />
          <Route path="/buyer" element={<Navigate to="/buyer/dashboard" replace />} />

          {/* Agent Routes */}
          <Route path="/agent/dashboard" element={<ProtectedRoute allowedRoles={['agent']}><AgentDashboard /></ProtectedRoute>} />
          <Route path="/agent/farmers" element={<ProtectedRoute allowedRoles={['agent']}><AgentDashboard /></ProtectedRoute>} />
          <Route path="/agent/map" element={<ProtectedRoute allowedRoles={['agent']}><AgentFarmerMap /></ProtectedRoute>} />
          <Route path="/agent/register" element={<ProtectedRoute allowedRoles={['agent']}><AgentRegisterFarmer /></ProtectedRoute>} />
          <Route path="/agent/edit/:id" element={<ProtectedRoute allowedRoles={['agent']}><AgentRegisterFarmer /></ProtectedRoute>} />
          <Route path="/agent/projects" element={<ProtectedRoute allowedRoles={['agent']}><AgentProjects /></ProtectedRoute>} />
          <Route path="/agent/projects/:id" element={<ProtectedRoute allowedRoles={['agent']}><AgentProjectDetails /></ProtectedRoute>} />
          <Route path="/agent/my-projects" element={<ProtectedRoute allowedRoles={['agent']}><AgentMyProjects /></ProtectedRoute>} />
          <Route path="/agent" element={<Navigate to="/agent/dashboard" replace />} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes >
        <Toaster />
      </AuthProvider >
    </Router >
  );
}

// Routes verified
export default App;