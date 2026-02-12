import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Farmer } from '@/types';
import { Leaf, Users, ArrowRight, Loader2, FolderOpen } from 'lucide-react';

interface ProjectGroup {
    id: string; // Company / Project ID
    name: string;
    farmerCount: number;
    totalAcres: number;
    totalCO2: number;
}

export default function AgentMyProjects() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchMyProjects();
        }
    }, [user]);

    const fetchMyProjects = async () => {
        try {
            // Find all farmers managed by this agent that have a projectId assigned
            const q = query(collection(db, 'farmers'), where('agentId', '==', user?.id));
            const snap = await getDocs(q);
            const farmers = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Farmer[];

            const assignedFarmers = farmers.filter(f => f.projectId);

            // Group by projectId
            const groups: Record<string, ProjectGroup> = {};

            for (const f of assignedFarmers) {
                const pid = f.projectId!;
                if (!groups[pid]) {
                    // Initialize group
                    groups[pid] = {
                        id: pid,
                        name: 'Loading...',
                        farmerCount: 0,
                        totalAcres: 0,
                        totalCO2: 0
                    };
                }
                groups[pid].farmerCount++;
                groups[pid].totalAcres += (f.acres || 0);
                groups[pid].totalCO2 += (f.estimates?.projectCO2 || 0);
            }

            // Fetch Project/Company Names for these groups
            const groupList = Object.values(groups);
            for (const g of groupList) {
                try {
                    // Try fetch from users (Company)
                    const userSnap = await getDoc(doc(db, 'users', g.id));
                    if (userSnap.exists()) {
                        const d = userSnap.data();
                        g.name = d.companyName || d.name || 'Unnamed Company';
                    } else {
                        // Try fetch from projects (if legacy exists)
                        const projSnap = await getDoc(doc(db, 'projects', g.id));
                        if (projSnap.exists()) {
                            g.name = projSnap.data().name || 'Unnamed Project';
                        } else {
                            g.name = 'Unknown Project (' + g.id + ')';
                        }
                    }
                } catch (e) {
                    g.name = 'Error Loading Name';
                }
            }

            setProjectGroups(groupList);
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
                    <h1 className="text-3xl font-display font-bold">My Assigned Projects</h1>
                    <p className="text-muted-foreground mt-1">Projects where you have successfully enrolled farmers.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : projectGroups.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        You haven't assigned any farmers to projects yet.
                        <div className="mt-4">
                            <Button variant="outline" onClick={() => navigate('/agent/projects')}>
                                Browse Available Projects
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projectGroups.map(group => (
                            <Card key={group.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/agent/projects/${group.id}`)}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start">
                                        <span className="truncate" title={group.name}>{group.name}</span>
                                        <Leaf className="w-5 h-5 text-green-600 shrink-0" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <div className="text-muted-foreground text-xs uppercase tracking-wider">Farmers</div>
                                                <div className="font-semibold text-lg flex items-center gap-1">
                                                    <Users className="w-4 h-4 text-primary" /> {group.farmerCount}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground text-xs uppercase tracking-wider">Acres</div>
                                                <div className="font-semibold text-lg">
                                                    {group.totalAcres.toFixed(1)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t mt-2">
                                            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Total Carbon Contribution</div>
                                            <div className="font-mono text-xl font-bold text-green-700">
                                                {group.totalCO2.toFixed(2)} tCO2e
                                            </div>
                                        </div>

                                        <Button variant="ghost" className="w-full text-primary h-8 p-0 hover:bg-transparent hover:underline justify-start">
                                            View Details & Add More <ArrowRight className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
