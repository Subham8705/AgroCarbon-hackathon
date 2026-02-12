import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Project } from '@/types';
import { Users, Leaf, ArrowRight, FolderOpen, Loader2, Ruler, MapPin, Check } from 'lucide-react';

// Extend Project type for display if needed, or use existing
interface DisplayProject extends Project {
    companyName?: string;
}

export default function AgentProjects() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<DisplayProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchProjects();
        }
    }, [user]);

    const fetchProjects = async () => {
        try {
            // Fetch Companies (treated as Projects in Farmer view)
            const q = query(collection(db, 'users'), where('role', '==', 'company'));
            const snap = await getDocs(q);

            const fetchedProjects: DisplayProject[] = [];

            // Fetch counts in parallel
            await Promise.all(snap.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const companyId = docSnap.id;

                // Get real farmer count for this project/company
                let farmerCount = 0;
                try {
                    const qCount = query(collection(db, 'farmers'), where('projectId', '==', companyId));
                    const countSnap = await getDocs(qCount);
                    farmerCount = countSnap.size;
                } catch (e) {
                    console.error("Error fetching count for", companyId, e);
                }

                // Map Company User to Project Display
                fetchedProjects.push({
                    id: companyId,
                    companyId: companyId, // The company IS the project source
                    companyName: data.companyName || data.name || 'Unnamed Company',
                    name: data.companyName || data.name || 'Unnamed Project', // Use company name as project name
                    minAcres: data.minAcres || 0,
                    maxFarmers: data.capacity || 1000,
                    farmers: Array(farmerCount).fill(null), // Dummy array to represent count since interface expects array
                    batches: [],
                    status: 'open', // Assume open if it exists
                    createdAt: data.createdAt // User creation time
                } as any);
            }));

            setProjects(fetchedProjects);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="agent">
            <div className="p-6 lg:p-8 space-y-8">
                <div>
                    <h1 className="text-3xl font-display font-bold">Available Projects</h1>
                    <p className="text-muted-foreground mt-1">Browse and assign your farmers to company carbon projects</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        No available projects found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {projects.map(project => (
                            <div
                                key={project.id}
                                className="card-elevated overflow-hidden flex flex-col hover:border-primary/50 transition-colors"
                            >
                                <div className="p-4 gradient-company text-white flex justify-between items-center">
                                    <h3 className="text-lg font-bold">{project.name}</h3>
                                    <span className="bg-white/20 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Open
                                    </span>
                                </div>
                                <div className="p-6 flex-1 space-y-4">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="w-full text-xs text-muted-foreground uppercase tracking-wider mb-1">Company</div>
                                            <div className="font-medium text-sm truncate" title={project.companyName}>
                                                {project.companyName}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="w-full text-xs text-muted-foreground uppercase tracking-wider mb-1">Min. Acres</div>
                                            <div className="font-medium text-sm flex items-center justify-center gap-1">
                                                <Ruler className="w-3 h-3" /> {project.minAcres}+
                                            </div>
                                        </div>
                                        <div>
                                            <div className="w-full text-xs text-muted-foreground uppercase tracking-wider mb-1">Farmers</div>
                                            <div className="font-medium text-sm flex items-center justify-center gap-1">
                                                <Users className="w-3 h-3" /> {project.farmers?.length || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-3 rounded text-sm text-center text-muted-foreground">
                                        Capacity: {project.maxFarmers} Farmers
                                    </div>
                                </div>
                                <div className="p-4 border-t bg-muted/10">
                                    <Button className="w-full gap-2" onClick={() => navigate(`/agent/projects/${project.id}`)}>
                                        View & Assign Farmers <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
