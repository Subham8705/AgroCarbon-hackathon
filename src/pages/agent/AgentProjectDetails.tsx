import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Project, Farmer } from '@/types';
import { ArrowLeft, Users, Leaf, CheckSquare, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function AgentProjectDetails() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [agentAssignedFarmers, setAgentAssignedFarmers] = useState<Farmer[]>([]);
    const [unassignedFarmers, setUnassignedFarmers] = useState<Farmer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedFarmers, setSelectedFarmers] = useState<string[]>([]);
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        if (id && user?.id) {
            fetchProjectDetails();
        }
    }, [id, user]);

    const fetchProjectDetails = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Fetch Project (which is actually a Company User)
            const docRef = doc(db, 'users', id);
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                alert("Project/Company not found");
                navigate('/agent/projects');
                return;
            }
            const data = snap.data();
            const projData = {
                id: snap.id,
                companyId: snap.id, // Self referencing as it's the company
                name: data.companyName || data.name,
                minAcres: data.minAcres || 0,
                maxFarmers: data.capacity || 1000,
                status: 'open',
                farmers: [] // We won't have this on the user doc
            } as any as Project;

            setProject(projData);
            setCompanyName(data.companyName || data.name || 'Unknown');

            // 2. Fetch Farmers assigned to THIS project (Company) BY THIS AGENT
            // Query farmers where projectId == id (which is company ID here)
            const qAssigned = query(
                collection(db, 'farmers'),
                where('projectId', '==', id),
                where('agentId', '==', user?.id)
            );
            const assignedSnap = await getDocs(qAssigned);
            setAgentAssignedFarmers(assignedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Farmer[]);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnassignedFarmers = async () => {
        if (!user || !project) return; // Ensure project is loaded
        try {
            // 3. Fetch Unassigned Farmers (Managed by this Agent)
            const qUnassigned = query(
                collection(db, 'farmers'),
                where('agentId', '==', user?.id)
            );
            const unassignedSnap = await getDocs(qUnassigned);
            const allManagedFarmers = unassignedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Farmer[];

            // Filter: Must not have a projectId OR if they do, status must be 'rejected' (allow re-try)
            const eligible = allManagedFarmers.filter(f => {
                // Check if acres match requirement
                if ((f.acres || 0) < project.minAcres) return false; // Use 'project' state here

                // Check availability: No Project OR Rejected/Removed from Project
                const isAvailable = !f.projectId || f.projectStatus?.status === 'rejected' || f.projectStatus?.status === 'removed';

                return isAvailable;
            });

            setUnassignedFarmers(eligible);
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenAdd = () => {
        fetchUnassignedFarmers();
        setIsAddOpen(true);
        setSelectedFarmers([]);
    };

    const handleToggleSelect = (farmerId: string) => {
        setSelectedFarmers(prev =>
            prev.includes(farmerId) ? prev.filter(id => id !== farmerId) : [...prev, farmerId]
        );
    };

    const handleAddFarmers = async () => {
        if (!project || selectedFarmers.length === 0) return;

        try {
            const batch = writeBatch(db);

            // 1. Update each farmer: link to this project and company
            selectedFarmers.forEach(fid => {
                const farmerRef = doc(db, 'farmers', fid);
                batch.update(farmerRef, {
                    projectId: project.id,
                    companyId: project.companyId,
                    'projectStatus.status': 'pending', // Set to pending initially, company approves
                    'projectStatus.appliedProjectId': project.id
                });

                // Create Application Request for Company Dashboard
                const applicationRef = doc(collection(db, 'project_applications'));
                // Need to find the farmer object to get name/acres/etc - we can use unassignedFarmers list
                const farmerData = unassignedFarmers.find(f => f.id === fid);

                if (farmerData) {
                    batch.set(applicationRef, {
                        projectId: project.id,
                        projectName: project.name,
                        companyId: project.companyId,
                        companyName: companyName,
                        farmerId: fid,
                        farmerName: farmerData.name,
                        farmerAcres: farmerData.acres,
                        farmerTotalCO2: farmerData.estimates?.projectCO2 || 0,
                        farmerBaseCO2: farmerData.estimates?.baselineCO2 || 0,
                        status: 'pending',
                        createdAt: serverTimestamp(),
                        agentId: user?.id // Track who submitted
                    });
                }

                // Audit Log
                const auditRef = doc(collection(db, 'audit_logs'));
                batch.set(auditRef, {
                    agentId: user?.id,
                    action: 'assign_project_request',
                    targetFarmerId: fid,
                    projectId: project.id,
                    applicationId: applicationRef.id,
                    timestamp: serverTimestamp(),
                });
            });

            await batch.commit();

            // Note: Since 'Project' is a Company User, we might not update a 'farmers' array on the User doc 
            // unless that's part of the schema. For now, we rely on the Farmer's projectId/companyId link.
            // If explicit application tracking is needed (like FarmerProjects), we'd create 'project_applications' docs.
            // But the prompt says "agent should not create projects it will group farmers... basic assignment".
            // Direct assignment on Farmer record seems sufficient per previous instruction.

            setIsAddOpen(false);
            fetchProjectDetails(); // Refresh list

        } catch (e) {
            console.error(e);
            alert("Failed to add farmers");
        }
    };

    // Calculate Agent's contribution to this project
    const agentStats = {
        farmers: agentAssignedFarmers.length,
        acres: agentAssignedFarmers.reduce((s, f) => s + (f.acres || 0), 0),
        co2: agentAssignedFarmers.reduce((s, f) => s + (f.estimates?.projectCO2 || 0), 0)
    };

    if (loading) return <DashboardLayout role="agent"><div>Loading...</div></DashboardLayout>;
    if (!project) return null;

    return (
        <DashboardLayout role="agent">
            <div className="p-6 lg:p-8 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4 border-b pb-6">
                    <Button variant="ghost" onClick={() => navigate('/agent/projects')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-display font-bold">{project.name}</h1>
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium border border-primary/20">
                                {project.status.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Owned by <span className="font-semibold text-foreground">{companyName}</span>
                        </p>
                    </div>
                </div>

                {/* Project Overview (Read Only) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="md:col-span-1 bg-muted/20 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Requirements</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>Min Acres:</span> <span className="font-medium">{project.minAcres}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Max Farmers:</span> <span className="font-medium">{project.maxFarmers}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent Contribution Stats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">My Assigned Farmers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agentStats.farmers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">My Contributed Acres</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agentStats.acres.toFixed(1)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Carbon Credits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                {agentStats.co2.toFixed(1)} <Leaf className="w-4 h-4 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Area */}
                <Card className="border-primary/20 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-primary/5 border-b border-primary/10">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">Manage Enrollment</CardTitle>
                            <p className="text-sm text-muted-foreground">Enroll your farmers into this project.</p>
                        </div>
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={handleOpenAdd} className="gap-2 shadow-md">
                                    <Plus className="w-4 h-4" /> Enroll Farmers
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Enroll Farmers to {project.name}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800 flex gap-2 items-start">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p>
                                            Farmers must have at least <strong>{project.minAcres} acres</strong> to be eligible.
                                            Only unassigned farmers are shown.
                                        </p>
                                    </div>

                                    {unassignedFarmers.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                                            No eligible unassigned farmers found.
                                        </div>
                                    ) : (
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[50px]">Select</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Acres</TableHead>
                                                        <TableHead>Est. CO2</TableHead>
                                                        <TableHead>Eligible?</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {unassignedFarmers.map(f => {
                                                        const isEligible = (f.acres || 0) >= project.minAcres;
                                                        return (
                                                            <TableRow key={f.id} className={!isEligible ? 'opacity-50' : ''}>
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={selectedFarmers.includes(f.id)}
                                                                        onCheckedChange={() => isEligible && handleToggleSelect(f.id)}
                                                                        disabled={!isEligible}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{f.name}</TableCell>
                                                                <TableCell>{f.acres}</TableCell>
                                                                <TableCell>{f.estimates?.projectCO2?.toFixed(1) || 0}</TableCell>
                                                                <TableCell>
                                                                    {isEligible ? (
                                                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Yes</Badge>
                                                                    ) : (
                                                                        <Badge variant="destructive" className="py-0 px-1 text-[10px]">No (&lt; {project.minAcres})</Badge>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <div className="flex-1 flex justify-between items-center">
                                        <div className="text-sm text-muted-foreground">
                                            {selectedFarmers.length} selected
                                        </div>
                                        <Button onClick={handleAddFarmers} disabled={selectedFarmers.length === 0}>
                                            Confirm Enrollment
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>

                    <CardContent className="pt-6">
                        {agentAssignedFarmers.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                No farmers from your registry have been added to this project yet.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Farmer Name</TableHead>
                                        <TableHead>Acres</TableHead>
                                        <TableHead>Est. Credits</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Enrolled At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agentAssignedFarmers.map(f => (
                                        <TableRow key={f.id}>
                                            <TableCell className="font-medium">{f.name}</TableCell>
                                            <TableCell>{f.acres}</TableCell>
                                            <TableCell>{f.estimates?.projectCO2?.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{f.onboardingStatus}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                Today
                                                {/* Timestamp would be good here if we stored enrollment time on farmer, but audit log has it */}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
