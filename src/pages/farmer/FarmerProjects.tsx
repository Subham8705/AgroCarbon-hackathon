import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { FolderOpen, MapPin, Users, Ruler, ArrowRight, Check, Clock, X, Loader2, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import { toast } from 'sonner';

// Extend User type locally to include Company fields if not already in global types
interface CompanyProject extends User {
  companyName: string;
  minAcres: number;
  capacity: number;
}

// Define the shape of the estimate data we expect
interface EstimateData {
  acres: number;
  // We keep these just in case we need to display them, but eligibility is now just acres
  tillage?: string;
  coverCrop?: boolean;
  trees?: number;
  totalCO2?: number;
  baseGain?: number;
}

export default function FarmerProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<CompanyProject[]>([]);
  const [loading, setLoading] = useState(true);
  // Store full estimate data instead of just acres
  const [farmerEstimate, setFarmerEstimate] = useState<EstimateData | null>(null);
  const [appliedProjects, setAppliedProjects] = useState<Set<string>>(new Set());
  const [hasAnyApplication, setHasAnyApplication] = useState(false);
  const [applicationStatuses, setApplicationStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        // 1. Fetch Projects (Companies)
        const q = query(collection(db, 'users'), where('role', '==', 'company'));
        const querySnapshot = await getDocs(q);
        const fetchedProjects: CompanyProject[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.companyName) {
            fetchedProjects.push({ id: doc.id, ...data } as CompanyProject);
          }
        });

        setProjects(fetchedProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();

    // 2. Real-time Listener for Farmer's Estimate
    if (user) {
      const estimateQ = query(collection(db, 'estimates'), where('userId', '==', user.id));
      const unsubscribe = onSnapshot(estimateQ, (snapshot) => {
        if (!snapshot.empty) {
          // Client-side sort to get the latest (same logic as Dashboard)
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          docs.sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });

          const data = docs[0];
          setFarmerEstimate({
            acres: data.acres || 0,
            tillage: data.tillage,
            coverCrop: data.coverCrop,
            trees: data.trees,
            totalCO2: data.totalCO2,
            baseGain: data.baseGain
          });
        }
      }, (error) => {
        console.error("Error listening to estimate:", error);
      });

      return () => unsubscribe();
    }
  }, [user]);

  // Check for existing applications
  useEffect(() => {
    const checkApplications = async () => {
      if (!user) return;

      try {
        const appQuery = query(
          collection(db, 'project_applications'),
          where('farmerId', '==', user.id)
        );
        const appSnapshot = await getDocs(appQuery);
        const appliedSet = new Set<string>();
        const statusMap = new Map<string, string>();
        let hasActiveApplication = false;

        appSnapshot.forEach((doc) => {
          const data = doc.data();
          appliedSet.add(data.projectId);
          statusMap.set(data.projectId, data.status || 'pending');

          // Only count pending or accepted applications as "active"
          if (data.status === 'pending' || data.status === 'accepted') {
            hasActiveApplication = true;
          }
        });

        setAppliedProjects(appliedSet);
        setApplicationStatuses(statusMap); // This might need type update if we want to store objects, or use a separate map.
        // Let's use a separate map for application details to avoid breaking changes in other places if any
        // Actually, let's just use a new state for application details
        const detailsMap = new Map<string, any>();
        appSnapshot.forEach((doc) => {
          const data = doc.data();
          detailsMap.set(data.projectId, data);
        });
        setApplicationDetails(detailsMap);

        setHasAnyApplication(hasActiveApplication);
      } catch (error) {
        console.error("Error checking applications:", error);
      }
    };

    checkApplications();
  }, [user]);

  const [applicationDetails, setApplicationDetails] = useState<Map<string, any>>(new Map());

  const handleApply = async (project: CompanyProject) => {
    if (!user || !farmerEstimate) return;

    // Prevent applying if already applied to any project
    if (hasAnyApplication) {
      toast.error("You have already applied to a project. You can only apply to one project at a time.");
      return;
    }

    try {
      // Create application
      const applicationData = {
        projectId: project.id,
        projectName: project.companyName, // Usually project name but using Company Name for now as per current structure
        companyId: project.id, // In this simplified model, comp ID is user ID. Ideally project.id might be sub-doc. Assuming mapped correctly.
        companyName: project.companyName,
        farmerId: user.id,
        farmerName: user.name,
        farmerAcres: farmerEstimate.acres,
        farmerTotalCO2: farmerEstimate.totalCO2,
        farmerBaseCO2: farmerEstimate.baseGain,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'project_applications'), applicationData);

      toast.success("Application submitted successfully!");
      setAppliedProjects(new Set([...appliedProjects, project.id]));
      setApplicationStatuses(new Map(applicationStatuses.set(project.id, 'pending')));
      setApplicationDetails(new Map(applicationDetails.set(project.id, { ...applicationData, status: 'pending' })));
      setHasAnyApplication(true); // Mark that farmer now has an application
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application.");
    }
  };

  return (
    <DashboardLayout role="farmer">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Available Projects</h1>
          <p className="text-muted-foreground mt-1">Browse and apply to carbon credit projects</p>
        </div>

        {/* Info Banner */}
        <div className="card-elevated p-4 border-l-4 border-l-primary animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start gap-3">
            <FolderOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground">
                <strong>Before applying:</strong> Make sure you've completed your CO₂ estimation to check eligibility.
                {farmerEstimate && (
                  <span className="block mt-1 font-medium text-green-700">
                    Your Profile: {farmerEstimate.acres} Acres
                  </span>
                )}
              </p>
              <Link to="/farmer/estimate" className="text-sm text-primary font-medium hover:underline mt-1 inline-block">
                {farmerEstimate ? "Update Estimation →" : "Go to Estimation →"}
              </Link>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {projects.map((project, index) => {
              const isApplied = appliedProjects.has(project.id);
              const minAcres = project.minAcres || 0;
              const maxFarmers = project.capacity || 1000;
              const farmerCount = 0;
              const appDetails = applicationDetails.get(project.id);

              // Simplified Eligibility Check: Acres ONLY
              const isEligible = farmerEstimate ? farmerEstimate.acres >= minAcres : false;

              return (
                <div
                  key={project.id}
                  className={`card-elevated overflow-hidden animate-fade-in`}
                  style={{ animationDelay: `${0.1 + index * 0.1}s` }}
                >
                  {/* Project Header */}
                  <div className={`p-4 gradient-company text-white`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-display font-bold">{project.companyName}</h3>
                      <span className="status-badge bg-white/20 text-white">
                        <Check className="w-3 h-3" /> Open
                      </span>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-lg font-bold text-foreground">{farmerCount}</div>
                        <div className="text-xs text-muted-foreground">Farmers Joined</div>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-2">
                          <Ruler className="w-5 h-5 text-accent" />
                        </div>
                        <div className="text-lg font-bold text-foreground">{minAcres}+</div>
                        <div className="text-xs text-muted-foreground">Min Acres</div>
                      </div>
                      <div className="text-center">
                        {/* Display a key requirement instead of just capacity if relevant, or keep capacity */}
                        <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mx-auto mb-2">
                          <MapPin className="w-5 h-5 text-info" />
                        </div>
                        <div className="text-lg font-bold text-foreground">{maxFarmers}</div>
                        <div className="text-xs text-muted-foreground">Max Capacity</div>
                      </div>
                    </div>

                    {/* Eligibility Warning */}
                    {!isEligible && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {farmerEstimate ? (
                          <span>Not Eligible: Requires {minAcres} acres (You have {farmerEstimate.acres})</span>
                        ) : (
                          <span>Estimation required to check eligibility</span>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    {isApplied ? (
                      <>
                        {appDetails?.status === 'accepted' ? (
                          <div className="space-y-3">
                            {appDetails.documentsVerified ? (
                              <div className="flex items-center justify-center gap-2 py-3 bg-green-100 rounded-lg text-green-800 font-medium">
                                <Check className="w-5 h-5" />
                                Project Joined
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-center gap-2 py-3 bg-green-100 rounded-lg text-green-800 font-medium">
                                  <Check className="w-5 h-5" />
                                  Application Accepted
                                </div>
                                {appDetails.meetingDate && appDetails.meetingSlot && (
                                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                                    <div className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
                                      <Clock className="w-4 h-4" /> Document Verification Scheduled
                                    </div>
                                    <div className="text-blue-800">
                                      Please bring your original documents on:
                                    </div>
                                    <div className="font-medium text-blue-900 mt-1">
                                      {format(new Date(appDetails.meetingDate), 'do MMMM yyyy')} at {appDetails.meetingSlot}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : appDetails?.status === 'rejected' ? (
                          <div className="flex items-center justify-center gap-2 py-3 bg-red-100 rounded-lg text-red-800 font-medium">
                            <X className="w-5 h-5" />
                            Application Rejected
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-3 bg-primary/10 rounded-lg text-primary font-medium">
                            <Clock className="w-5 h-5" />
                            Application Pending
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleApply(project)}
                        disabled={!isEligible || hasAnyApplication}
                        className="btn-primary w-full gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {hasAnyApplication ? "Already Applied to Another Project" : isEligible ? "Apply to Project" : "Not Eligible"}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Projects Found</h3>
            <p className="text-muted-foreground">There are no project companies registered yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
