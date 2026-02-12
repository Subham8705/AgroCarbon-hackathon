export type UserRole = 'farmer' | 'company' | 'verifier' | 'registry' | 'buyer' | 'agent';

export interface User {
  id: string;
  role: UserRole;
  phone: string;
  name: string;
  email?: string;
  createdAt: Date;
}

export interface Farmer {
  id: string;
  userId?: string; // Optional now, as farmers managed by agents might not have a login user initially
  agentId?: string; // IF managed by an agent
  companyId?: string; // Optional (undefined until assigned to a project)
  projectId?: string; // Single active project assignment
  name: string;
  phone: string;
  location: {
    lat: number;
    lon: number;
  };
  plotCoordinates?: { lat: number, lon: number }[]; // For polygon plotting
  plotHistory?: {
    coordinates: { lat: number, lon: number }[];
    updatedAt: Date;
    updatedBy: string;
  }[];
  acres: number;
  practices: {
    tillage: 'ploughing' | 'reduced' | 'no-till';
    coverCrop: boolean;
    trees: number;
    yearsFollowed: number;
  };
  consent?: {
    type: 'otp' | 'recording';
    timestamp: Date;
    evidence?: string; // URL to recording or OTP reference ID
  };
  onboardingStatus: 'submitted' | 'verified' | 'rejected';
  autoData: {
    soc: number;
    ndvi: number;
    rainfall: number;
  };
  estimates: {
    baselineCO2: number;
    projectCO2: number;
    perAcreCO2: number;
  };
  projectStatus: {
    appliedProjectId?: string;
    status: 'none' | 'applied' | 'approved' | 'rejected' | 'removed';
    meetingDate?: string;
    meetingSlot?: string;
  };
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  agentId: string;
  action: 'create_farmer' | 'update_farmer' | 'submit_farmer';
  targetFarmerId: string;
  timestamp: Date;
  changes?: any;
}

export interface ProjectCompany {
  id: string;
  userId: string;
  companyName: string;
  minAcresRequired: number;
  region: string;
  projects: string[];
  createdAt: Date;
}

export interface Project {
  id: string;
  companyId: string;
  agentId?: string; // Agent who manages this project grouping
  name: string;
  minAcres: number;
  maxFarmers: number;
  farmers: string[];
  batches: Batch[];
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface Batch {
  id: string;
  month: string;
  farmerIds: string[];
  baselineTotal: number;
  projectTotal: number;
  status: 'pending' | 'pendingVerification' | 'verified';
}

export interface Verifier {
  id: string;
  userId: string;
  name: string;
  organization: string;
  licenseNumber: string;
  approved: boolean;
  createdAt: Date;
}

export interface VerificationRequest {
  id: string;
  projectId: string;
  projectName: string;
  batchId: string;
  companyId: string;
  companyName: string;
  plotList: {
    farmerId: string;
    farmerName: string;
    acres: number;
    location: { lat: number; lon: number };
  }[];
  status: 'pending' | 'inReview' | 'verified';
  createdAt: Date;
}

export interface VerificationResult {
  id: string;
  requestId: string;
  verifiedCredits: Record<string, number>;
  verifierId: string;
  verifierName: string;
  reportURL?: string;
  submittedAt: Date;
}

export interface RegistryIssuance {
  id: string;
  projectId: string;
  projectName: string;
  companyName: string;
  batchId: string;
  totalIssuedCredits: number;
  serialRange: string;
  issuedTo: Record<string, number>;
  issuedAt: Date;
}

export interface CO2EstimationParams {
  soc: number;
  ndvi: number;
  rainfall: number;
  tillage: 'ploughing' | 'reduced' | 'no-till';
  coverCrop: boolean;
  trees: number;
  yearsFollowed: number;
  acres: number;
  plotCoordinates?: { lat: number, lon: number }[];
}

export type PDDStatus = 'draft' | 'submitted' | 'registered' | 'rejected' | 'validated';

export interface PDDRequest {
  id: string;
  companyId: string;
  companyName: string;
  registryName: 'Verra' | 'Gold Standard' | 'EcoRegistry' | 'Other';
  status: PDDStatus;
  submittedAt: Date;
  registeredAt?: Date;
  registryProjectId?: string; // Assigned by registry
  rejectionReason?: string;
  documentUrl?: string; // Mock URL for the PDF
}
