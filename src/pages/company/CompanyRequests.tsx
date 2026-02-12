import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardCheck, Loader2, Check, X, Clock, User, Eye, Leaf, MapPin, Ruler } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
        // Force invalidation of size to ensure tiles load correctly in modal
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [center, zoom, map]);
    return null;
}

interface Application {
    id: string;
    projectId: string;
    projectName: string;
    companyId: string;
    companyName: string;
    farmerId: string;
    farmerName: string;
    farmerAcres: number;
    farmerTotalCO2?: number;
    farmerBaseCO2?: number;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: any;
}

interface FarmerDetails {
    acres: number;
    tillage: string;
    coverCrop: boolean;
    trees: number;
    yearsFollowed: number;
    userId: string;
    polygons: { id: string, points: [number, number][] }[];
}

export default function CompanyRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);

    // Details Modal State
    const [selectedRequest, setSelectedRequest] = useState<Application | null>(null);
    const [farmerDetails, setFarmerDetails] = useState<FarmerDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Slot Selection Modal State
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [slotApplicationId, setSlotApplicationId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [processingAccept, setProcessingAccept] = useState(false);

    const timeSlots = [
        "09:00 AM - 10:00 AM",
        "10:00 AM - 11:00 AM",
        "11:00 AM - 12:00 PM",
        "02:00 PM - 03:00 PM",
        "03:00 PM - 04:00 PM"
    ];

    useEffect(() => {
        const fetchRequests = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'project_applications'),
                    where('companyId', '==', user.id)
                );

                const querySnapshot = await getDocs(q);
                const fetchedRequests: Application[] = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Application));

                // Backfill/Fallback: If CO2 data is missing (legacy apps), fetch from estimates
                const enhancedRequests = await Promise.all(fetchedRequests.map(async (req) => {
                    console.log(`Processing request ${req.id}:`, {
                        farmerTotalCO2: req.farmerTotalCO2,
                        farmerBaseCO2: req.farmerBaseCO2,
                        farmerId: req.farmerId
                    });

                    if (req.farmerTotalCO2 === undefined || req.farmerBaseCO2 === undefined) {
                        try {
                            const estQ = query(collection(db, 'estimates'), where('userId', '==', req.farmerId));
                            const estSnap = await getDocs(estQ);
                            if (!estSnap.empty) {
                                // Sort to get latest
                                const docs = estSnap.docs.map(d => d.data());
                                docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                                const latest = docs[0];
                                console.log(`Fetched estimate for ${req.farmerId}:`, {
                                    totalCO2: latest.totalCO2,
                                    baseGain: latest.baseGain
                                });
                                return {
                                    ...req,
                                    farmerTotalCO2: latest.totalCO2,
                                    farmerBaseCO2: latest.baseGain
                                };
                            } else {
                                console.log(`No estimate found for farmer ${req.farmerId}`);
                            }
                        } catch (err) {
                            console.error(`Error fetching estimate for ${req.farmerId}`, err);
                        }
                    }
                    return req;
                }));

                // Client-side sort by date descending
                enhancedRequests.sort((a, b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return tB - tA;
                });

                // Filter out accepted and rejected requests (active inbox)
                const activeRequests = enhancedRequests.filter(req => req.status !== 'accepted' && req.status !== 'rejected');

                setRequests(activeRequests);
            } catch (error) {
                console.error("Error fetching requests:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [user]);


    const handleStatusUpdate = async (applicationId: string, newStatus: 'accepted' | 'rejected') => {
        if (newStatus === 'accepted') {
            setSlotApplicationId(applicationId);
            setShowSlotModal(true);
            setSelectedSlot(''); // Reset slot
            return;
        }

        // For rejection, proceed immediately
        try {
            const batch = writeBatch(db);
            const application = requests.find(r => r.id === applicationId);

            // 1. Update Application
            const appRef = doc(db, 'project_applications', applicationId);
            batch.update(appRef, {
                status: newStatus
            });

            // 2. Update Farmer (Sync Rejection)
            if (application && application.farmerId) {
                const farmerRef = doc(db, 'farmers', application.farmerId);
                batch.update(farmerRef, {
                    onboardingStatus: 'rejected',
                    'projectStatus.status': 'rejected'
                });
            }

            await batch.commit();

            // Optimistic UI update
            setRequests(requests.map(req =>
                req.id === applicationId ? { ...req, status: newStatus } : req
            ));

            toast.success(`Application ${newStatus} successfully`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleConfirmAcceptance = async () => {
        if (!slotApplicationId || !selectedDate || !selectedSlot) {
            toast.error("Please select both a date and a time slot.");
            return;
        }

        setProcessingAccept(true);
        try {
            // Get the application details to find the farmerId
            const application = requests.find(r => r.id === slotApplicationId);

            const batch = writeBatch(db);

            // 1. Update Application Status
            const appRef = doc(db, 'project_applications', slotApplicationId);
            batch.update(appRef, {
                status: 'accepted',
                meetingDate: selectedDate,
                meetingSlot: selectedSlot
            });

            // 2. Update Farmer Status (Sync)
            if (application && application.farmerId) {
                const farmerRef = doc(db, 'farmers', application.farmerId);
                batch.update(farmerRef, {
                    onboardingStatus: 'accepted',
                    'projectStatus.status': 'approved',
                    'projectStatus.meetingDate': selectedDate,
                    'projectStatus.meetingSlot': selectedSlot
                });
            }

            await batch.commit();

            // Optimistic UI update
            // Optimistic UI update - Remove from list as it moves to Farmers page
            setRequests(requests.filter(req => req.id !== slotApplicationId));

            toast.success("Application accepted and meeting scheduled!");
            setShowSlotModal(false);
            setSlotApplicationId(null);
        } catch (error) {
            console.error("Error accepting application:", error);
            toast.error("Failed to accept application.");
        } finally {
            setProcessingAccept(false);
        }
    };

    const handleViewDetails = async (request: Application) => {
        setSelectedRequest(request);
        setLoadingDetails(true);
        setFarmerDetails(null);
        try {
            // Fetch farmer's latest estimate to get details
            const q = query(collection(db, 'estimates'), where('userId', '==', request.farmerId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                // Basic sort to find latest if multiple
                const docs = snapshot.docs.map(d => d.data());
                // For simplicity, taking the first one found or logic can be improved
                const data = docs[0];
                setFarmerDetails({
                    acres: data.acres,
                    tillage: data.tillage,
                    coverCrop: data.coverCrop,
                    trees: data.trees,
                    yearsFollowed: data.yearsFollowed,
                    userId: request.farmerId,
                    polygons: data.polygons ? data.polygons.map((poly: any) => ({
                        id: poly.id || Math.random().toString(36).substring(2, 9),
                        points: poly.points.map((p: any) => [p.lat, p.lng] as [number, number])
                    })) : []
                });
            }
        } catch (e) {
            console.error("Error details", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'accepted':
                return <span className="status-badge bg-green-100 text-green-800"><Check className="w-3 h-3" /> Accepted</span>;
            case 'rejected':
                return <span className="status-badge bg-red-100 text-red-800"><X className="w-3 h-3" /> Rejected</span>;
            default:
                return <span className="status-badge bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> Pending</span>;
        }
    };

    return (
        <DashboardLayout role="company">
            <div className="p-6 lg:p-8 space-y-6">
                <div className="animate-fade-in">
                    <h1 className="text-3xl font-display font-bold text-foreground">Project Applications</h1>
                    <p className="text-muted-foreground mt-1">Manage farmer applications for your carbon projects</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        {requests.length === 0 ? (
                            <div className="p-12 text-center">
                                <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No Requests Yet</h3>
                                <p className="text-muted-foreground">When farmers apply to your projects, they will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Farmer</th>

                                            <th className="px-6 py-4">Land Size</th>
                                            <th className="px-6 py-4">Baseline CO₂</th>
                                            <th className="px-6 py-4">Est. CO₂</th>
                                            <th className="px-6 py-4">Applied Date</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {requests.map((request) => (
                                            <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div className="font-medium text-foreground">{request.farmerName}</div>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 font-medium">{request.farmerAcres} Acres</td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {request.farmerBaseCO2 ? `${request.farmerBaseCO2.toFixed(1)} t` : '-'}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-green-600">
                                                    {request.farmerTotalCO2 ? `${request.farmerTotalCO2.toFixed(1)} t` : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {request.createdAt ? format(request.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleViewDetails(request)} className="text-primary hover:underline font-medium text-xs flex items-center justify-end gap-1 px-2">
                                                            <Eye className="w-3 h-3" /> View Details
                                                        </button>
                                                        {request.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(request.id, 'accepted')}
                                                                    className="p-2 hover:bg-green-100 text-green-600 rounded-full transition-colors"
                                                                    title="Accept Application"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(request.id, 'rejected')}
                                                                    className="p-2 hover:bg-red-100 text-red-600 rounded-full transition-colors"
                                                                    title="Reject Application"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* View Details Modal */}
                <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Farmer Details</DialogTitle>
                            <DialogDescription>
                                Application for {selectedRequest?.projectName}
                            </DialogDescription>
                        </DialogHeader>

                        {loadingDetails ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : farmerDetails ? (
                            <div className="space-y-4 py-2">
                                {/* Map Preview */}
                                {farmerDetails.polygons && farmerDetails.polygons.length > 0 && (
                                    <div className="h-[200px] w-full rounded-lg overflow-hidden relative z-0">
                                        <MapContainer
                                            center={farmerDetails.polygons[0]?.points[0] || [20.5937, 78.9629]}
                                            zoom={15}
                                            className="h-full w-full"
                                            scrollWheelZoom={true}
                                            dragging={true}
                                        >
                                            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            {/* Calculate center dynamically */}
                                            <MapController
                                                center={(() => {
                                                    const points = farmerDetails.polygons[0].points;
                                                    let lat = 0, lng = 0;
                                                    points.forEach(p => { lat += p[0]; lng += p[1]; });
                                                    return [lat / points.length, lng / points.length] as [number, number];
                                                })()}
                                                zoom={16}
                                            />
                                            {farmerDetails.polygons.map((poly) => (
                                                <Polygon
                                                    key={poly.id}
                                                    positions={poly.points}
                                                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.4, weight: 2 }}
                                                />
                                            ))}
                                        </MapContainer>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground">{selectedRequest?.farmerName}</div>
                                        <div className="text-xs text-muted-foreground">ID: {farmerDetails.userId.slice(0, 8)}...</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 border rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Ruler className="w-3 h-3" /> Land Area</div>
                                        <div className="font-semibold text-foreground">{farmerDetails.acres} Acres</div>
                                    </div>
                                    <div className="p-3 border rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Leaf className="w-3 h-3" /> Trees</div>
                                        <div className="font-semibold text-foreground">{farmerDetails.trees} Trees</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm py-2 border-b">
                                        <span className="text-muted-foreground">Tillage Practice</span>
                                        <span className="font-medium capitalize">{farmerDetails.tillage}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-2 border-b">
                                        <span className="text-muted-foreground">Cover Crop</span>
                                        <span className="font-medium">{farmerDetails.coverCrop ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-2 border-b">
                                        <span className="text-muted-foreground">Years Followed</span>
                                        <span className="font-medium">{farmerDetails.yearsFollowed} Years</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No additional details found for this farmer.
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Slot Selection Modal */}
                <Dialog open={showSlotModal} onOpenChange={(open) => !open && setShowSlotModal(false)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Schedule Verification</DialogTitle>
                            <DialogDescription>
                                Select a date and time slot for the farmer to bring original documents.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Date</label>
                                <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Time Slot</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {timeSlots.map((slot) => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${selectedSlot === slot
                                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                                : 'border-input hover:bg-accent hover:text-accent-foreground'
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSlotModal(false)}
                                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmAcceptance}
                                disabled={processingAccept || !selectedSlot}
                                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {processingAccept ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Confirm & Send
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}
