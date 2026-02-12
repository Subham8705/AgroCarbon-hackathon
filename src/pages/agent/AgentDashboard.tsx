import DashboardLayout from '@/components/layout/DashboardLayout';
import { Users, Plus, MapPin, Edit, Eye, UserPlus, CheckCircle, Clock, XCircle, Leaf } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Farmer } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AgentDashboard() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFarmers = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            const q = query(
                collection(db, 'farmers'),
                where('agentId', '==', user.id)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Farmer[];

            // Safe timestamp sorting
            data.sort((a, b) => {
                const getTime = (timestamp: any): number => {
                    if (!timestamp) return 0;
                    if (timestamp instanceof Timestamp) return timestamp.seconds;
                    if (typeof timestamp === 'object' && 'seconds' in timestamp) return timestamp.seconds;
                    return 0;
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            });

            setFarmers(data);
        } catch (error) {
            console.error("Error fetching farmers:", error);
            toast({
                title: "Error Loading Farmers",
                description: "Failed to load farmer data. Please refresh the page.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchFarmers();
    }, [fetchFarmers]);

    const getStatusBadge = (status: string, projectStatus?: any) => {
        // Priority to Project Status if it gives more info
        if (projectStatus?.status === 'rejected') {
            return <Badge className="bg-red-100 text-red-800 border-red-200">Proj. Rejected</Badge>;
        }
        if (projectStatus?.status === 'removed') {
            return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Proj. Removed</Badge>;
        }

        switch (status) {
            case 'verified':
                return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>;
            case 'accepted':
                return (
                    <div className="flex flex-col gap-1">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 w-fit">Accepted</Badge>
                        {projectStatus?.meetingDate && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {projectStatus.meetingDate} {projectStatus.meetingSlot && `(${projectStatus.meetingSlot.split(' ')[0]})`}
                            </div>
                        )}
                    </div>
                );
            case 'rejected':
                return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
            case 'submitted':
                return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Submitted</Badge>;
            default:
                return <Badge variant="outline">Draft</Badge>;
        }
    };

    const stats = {
        total: farmers.length,
        submitted: farmers.filter(f => f.onboardingStatus === 'submitted').length,
        verified: farmers.filter(f => f.onboardingStatus === 'verified').length,
        totalAcres: farmers.reduce((sum, f) => sum + (f.acres || 0), 0),
        totalCO2: farmers.reduce((sum, f) => sum + (f.estimates?.projectCO2 || 0), 0)
    };

    return (
        <DashboardLayout role="agent">
            <div className="p-6 lg:p-8 space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Agent Dashboard 🌾</h1>
                        <p className="text-muted-foreground mt-1">Register and manage your farmers</p>
                    </div>
                    <Button onClick={() => navigate('/agent/register')} className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        Add New Farmer
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card-elevated p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Farmers</p>
                            <h3 className="text-2xl font-bold">{stats.total}</h3>
                        </div>
                    </div>

                    <div className="card-elevated p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <Leaf className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Est. CO₂</p>
                            <h3 className="text-2xl font-bold">{stats.totalCO2.toFixed(1)} t</h3>
                        </div>
                    </div>

                    <div className="card-elevated p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Verified</p>
                            <h3 className="text-2xl font-bold">{stats.verified}</h3>
                        </div>
                    </div>

                    <div className="card-elevated p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Acres</p>
                            <h3 className="text-2xl font-bold">{stats.totalAcres.toFixed(1)}</h3>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="card-elevated p-6">
                    <h3 className="text-lg font-bold mb-4">Farmer Registry</h3>
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : farmers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No farmers registered yet.</p>
                            <p className="text-sm mt-1">Click "Add New Farmer" to start.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Acres</TableHead>
                                        <TableHead>Est. CO₂</TableHead>
                                        <TableHead>Project</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {farmers.map((farmer) => (
                                        <TableRow key={farmer.id}>
                                            <TableCell className="font-medium">{farmer.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="w-3 h-3" />
                                                    {farmer.location.lat.toFixed(4)}, {farmer.location.lon.toFixed(4)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{farmer.acres}</TableCell>
                                            <TableCell className="text-xs font-mono">
                                                {farmer.estimates?.projectCO2?.toFixed(2) || '0.00'} t
                                            </TableCell>
                                            <TableCell>
                                                {/* Show Project Assignment Status */}
                                                {farmer.projectStatus?.status && farmer.projectStatus.status !== 'none' ? (
                                                    <Badge variant="outline" className={
                                                        farmer.projectStatus.status === 'approved' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50"
                                                    }>
                                                        {farmer.projectStatus.status === 'approved' ? 'Assigned' : 'Pending'}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(farmer.onboardingStatus, farmer.projectStatus)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/agent/edit/${farmer.id}`)} disabled={farmer.onboardingStatus !== 'submitted'}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
