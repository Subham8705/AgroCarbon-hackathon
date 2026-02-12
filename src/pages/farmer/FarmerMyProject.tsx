import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Building, TreePine, MapPin, Leaf, Calendar, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface ProjectDetails {
    id: string; // Application ID
    companyId: string;
    companyName: string;
    projectName: string;
    status: string;
    documentsVerified: boolean;
    farmerAcres: number;
    farmerTotalCO2: number;
    farmerBaseCO2: number;
    createdAt: any;
}

export default function FarmerMyProject() {
    const { user } = useAuth();
    const [project, setProject] = useState<ProjectDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasProject, setHasProject] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'project_applications'),
                    where('farmerId', '==', user.id),
                    where('status', '==', 'accepted'),
                    where('documentsVerified', '==', true)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // Assuming one active project at a time
                    const docData = snapshot.docs[0].data();
                    setProject({
                        id: snapshot.docs[0].id,
                        companyId: docData.companyId,
                        companyName: docData.companyName,
                        projectName: docData.projectName,
                        status: docData.status,
                        documentsVerified: docData.documentsVerified || false,
                        farmerAcres: docData.farmerAcres,
                        farmerTotalCO2: docData.farmerTotalCO2,
                        farmerBaseCO2: docData.farmerBaseCO2,
                        createdAt: docData.createdAt
                    });
                    setHasProject(true);
                } else {
                    setHasProject(false);
                }
            } catch (error) {
                console.error("Error fetching project:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [user]);

    return (
        <DashboardLayout role="farmer">
            <div className="p-6 lg:p-8 space-y-6">
                <div className="animate-fade-in">
                    <h1 className="text-3xl font-display font-bold text-foreground">My Project</h1>
                    <p className="text-muted-foreground mt-1">Details of your enrolled carbon credit project</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : !hasProject ? (
                    <div className="card-elevated p-12 text-center animate-fade-in">
                        <TreePine className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No Active Project</h3>
                        <p className="text-muted-foreground mb-6">You haven't joined a project yet or your documents are pending verification.</p>
                        <Link to="/farmer/projects" className="btn-primary inline-flex">
                            Browse Projects
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        {/* Status Banner */}
                        <div className="bg-green-100 border border-green-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center text-green-700">
                                    <Check className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-green-900">Successfully Enrolled</h3>
                                    <p className="text-green-800">You are an official participant in this project.</p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-white/50 rounded-lg text-sm font-medium text-green-800">
                                Documents Verified
                            </div>
                        </div>

                        {/* Project Details Card */}
                        <div className="card-elevated overflow-hidden">
                            <div className="p-6 border-b border-border bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg gradient-company flex items-center justify-center text-white">
                                        <Building className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">{project?.companyName}</h2>
                                        <p className="text-sm text-muted-foreground">Managed by {project?.companyName}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Enrolled Land
                                    </div>
                                    <div className="text-2xl font-bold text-foreground">{project?.farmerAcres} Acres</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Leaf className="w-4 h-4" /> Baseline CO₂
                                    </div>
                                    <div className="text-2xl font-bold text-foreground">{project?.farmerBaseCO2?.toFixed(1)} tCO₂</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Leaf className="w-4 h-4 text-primary" /> Est. Project CO₂
                                    </div>
                                    <div className="text-2xl font-bold text-primary">{project?.farmerTotalCO2?.toFixed(1)} tCO₂</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Date Joined
                                    </div>
                                    <div className="text-lg font-medium text-foreground">
                                        {project?.createdAt ? format(project.createdAt.toDate(), 'MMMM do, yyyy') : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
