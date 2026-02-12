import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, CheckCircle2, XCircle, Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { PDDRequest } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import PDDDocument from '@/components/pdd/PDDDocument';

export default function PDDRequests() {
    const [requests, setRequests] = useState<PDDRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<PDDRequest | null>(null);
    const [newProjectId, setNewProjectId] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [viewDocumentOpen, setViewDocumentOpen] = useState(false);
    const [viewStats, setViewStats] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'pdd_requests'),
                orderBy('submittedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PDDRequest[];
            setRequests(data);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDocument = async (req: PDDRequest) => {
        // Fetch stats for the company associated with the request
        setActionLoading(true);
        try {
            const q = query(
                collection(db, 'project_applications'),
                where('companyId', '==', req.companyId),
                where('status', '==', 'accepted')
            );
            const snaps = await getDocs(q);

            let farmers = 0;
            let acres = 0;
            let co2 = 0;
            const fetchedPlots: any[] = [];

            for (const d of snaps.docs) {
                const data = d.data();
                farmers++;
                acres += (data.farmerAcres || 0);
                co2 += (data.farmerTotalCO2 || 0);

                // Fetch estimates for this farmer
                const qEstimates = query(
                    collection(db, 'estimates'),
                    where('userId', '==', data.farmerId)
                );
                const snapshotEstimates = await getDocs(qEstimates);

                if (!snapshotEstimates.empty) {
                    const estimatesDocs = snapshotEstimates.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    estimatesDocs.sort((a: any, b: any) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
                    const latestEstimate: any = estimatesDocs[0];

                    let polygons = [];
                    if (latestEstimate.polygons && Array.isArray(latestEstimate.polygons)) {
                        polygons = latestEstimate.polygons;
                    } else if (latestEstimate.polygonPoints && Array.isArray(latestEstimate.polygonPoints)) {
                        polygons = latestEstimate.polygonPoints.map((point: any, index: number) => ({
                            id: `polygon_${index}`,
                            points: [point],
                            area: latestEstimate.area || 0
                        }));
                    }

                    if (polygons.length > 0) {
                        polygons.forEach((polygon: any) => {
                            let area = polygon.area || latestEstimate.area || latestEstimate.acres || data.farmerAcres || 1;

                            // Recalculate or use stored values - Reuse simple calculation logic here or import if possible
                            // Since we are in a file that might not have the imports easily, let's assume we can import or just use stored values mostly
                            // For consistency, let's use the stored carbon values if available, else simplistic fallback
                            const baseCarbon = latestEstimate.baseCarbon || (area * 0.2);
                            const projectCarbon = latestEstimate.expectedCarbon || (area * 1.5);

                            fetchedPlots.push({
                                plotId: polygon.id || `PLOT-${Math.random().toString(36).substr(2, 5)}`,
                                farmerName: data.farmerName || 'Unknown',
                                areaAcres: area,
                                baseline: {
                                    practice: latestEstimate.baselinePractice || 'conventional',
                                    carbonEstimate: baseCarbon
                                },
                                project: {
                                    practice: 'no-till + cover crop',
                                    carbonEstimate: projectCarbon
                                }
                            });
                        });
                    } else {
                        const area = data.farmerAcres || 1;
                        fetchedPlots.push({
                            plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
                            farmerName: data.farmerName,
                            areaAcres: area,
                            baseline: { practice: 'conventional', carbonEstimate: area * 0.2 },
                            project: { practice: 'no-till + cover crop', carbonEstimate: area * 1.5 }
                        });
                    }
                } else {
                    const area = data.farmerAcres || 1;
                    fetchedPlots.push({
                        plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
                        farmerName: data.farmerName,
                        areaAcres: area,
                        baseline: { practice: 'conventional', carbonEstimate: area * 0.2 },
                        project: { practice: 'improved', carbonEstimate: area * 1.5 }
                    });
                }
            }


            setViewStats({
                companyName: req.companyName,
                region: 'Telangana, India', // Fallback
                startDate: req.submittedAt, // Use submit date as start date proxy
                totalFarmers: farmers,
                totalAcres: acres,
                estimatedCO2: co2,
                projectId: req.registryProjectId || '(pending)',
                registry: req.registryName || 'Verra',
                plots: fetchedPlots
            });

            setSelectedRequest(req);
            setViewDocumentOpen(true);
        } catch (e) {
            console.error("Error fetching document data", e);
            toast({ title: "Error", description: "Could not load document data.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest || !newProjectId) return;
        setActionLoading(true);
        try {
            const ref = doc(db, 'pdd_requests', selectedRequest.id);
            await updateDoc(ref, {
                status: 'registered',
                registeredAt: new Date(),
                registryProjectId: newProjectId
            });

            toast({
                title: "Project Approved",
                description: `Project ${newProjectId} has been successfully registered.`,
            });

            setShowApproveDialog(false);
            setNewProjectId('');
            fetchRequests();
        } catch (error) {
            console.error("Error approving:", error);
            toast({ title: "Error", description: "Failed to approve project.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const openApproveDialog = (req: PDDRequest) => {
        setSelectedRequest(req);
        setNewProjectId(`VCS-IND-${Math.floor(1000 + Math.random() * 9000)}`); // Auto-suggest ID
        setShowApproveDialog(true);
    };

    return (
        <DashboardLayout role="registry">
            <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-display font-bold text-foreground">PDD Requests 📋</h1>
                    <p className="text-muted-foreground">Review and approve Project Design Documents submitted by companies.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Pending Applications</CardTitle>
                        <CardDescription>Requests awaiting project ID assignment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No PDD requests found.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>submitted</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Registry</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Document</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell className="font-medium">
                                                {(req.submittedAt as any)?.toDate ? (req.submittedAt as any).toDate().toLocaleDateString() : new Date(req.submittedAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>{req.companyName}</TableCell>
                                            <TableCell>{req.registryName}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    req.status === 'registered' ? 'default' :
                                                        req.status === 'rejected' ? 'destructive' : 'secondary'
                                                } className="capitalize">
                                                    {req.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    className="flex items-center gap-1 text-primary hover:underline group h-auto p-0"
                                                    onClick={() => handleViewDocument(req)}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    <span className="text-sm">View Document</span>
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {req.status === 'submitted' && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                            Reject
                                                        </Button>
                                                        <Button size="sm" onClick={() => openApproveDialog(req)}>
                                                            Approve & Assign ID
                                                        </Button>
                                                    </div>
                                                )}
                                                {req.status === 'registered' && (
                                                    <span className="font-mono text-sm text-muted-foreground">{req.registryProjectId}</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* APPROVE DIALOG */}
                <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Approve Project Registration</DialogTitle>
                            <DialogDescription>
                                Assign a unique Project ID to <b>{selectedRequest?.companyName}</b>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Registry Project ID</Label>
                                <Input
                                    value={newProjectId}
                                    onChange={(e) => setNewProjectId(e.target.value)}
                                    placeholder="e.g. VCS-IND-1234"
                                />
                                <p className="text-xs text-muted-foreground">Unique identifier for this project in your registry.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
                            <Button onClick={handleApprove} disabled={actionLoading || !newProjectId}>
                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Registration
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* VIEW DOCUMENT DIALOG */}
                <Dialog open={viewDocumentOpen} onOpenChange={setViewDocumentOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Project Design Document (PDD)</DialogTitle>
                        </DialogHeader>
                        {viewStats && <PDDDocument data={viewStats} />}
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setViewDocumentOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}
