import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin, Save, Trash2, Undo, Check, AlertCircle, Navigation, Search, Loader2, X } from 'lucide-react';
import { fetchAllEnvironmentalData, calculateCO2Estimation } from '@/lib/carbonCalculator';
import { CO2EstimationParams } from '@/types';
import * as turf from '@turf/turf';

// Fix leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

interface FarmPolygon {
    id: string;
    points: [number, number][];
}

interface FarmPolygonDrawerProps {
    currentPoints: [number, number][];
    setCurrentPoints: (points: [number, number][]) => void;
    polygons: FarmPolygon[];
    onPolygonComplete: (points: [number, number][]) => void;
    isEditing: boolean;
}

function FarmPolygonDrawer({ currentPoints, setCurrentPoints, polygons, onPolygonComplete, isEditing }: FarmPolygonDrawerProps) {
    const [mousePos, setMousePos] = useState<[number, number] | null>(null);

    useMapEvents({
        click(e) {
            if (!isEditing) return;

            const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];

            // Check closure
            if (currentPoints.length >= 3) {
                const startPoint = currentPoints[0];
                const dist = Math.sqrt(Math.pow(newPoint[0] - startPoint[0], 2) + Math.pow(newPoint[1] - startPoint[1], 2));
                if (dist < 0.0005) {
                    onPolygonComplete(currentPoints);
                    setMousePos(null);
                    return;
                }
            }
            setCurrentPoints([...currentPoints, newPoint]);
        },
        mousemove(e) {
            if (isEditing && currentPoints.length > 0) {
                setMousePos([e.latlng.lat, e.latlng.lng]);
            }
        },
    });

    return (
        <>
            {/* Saved Polygons */}
            {polygons.map((poly) => (
                <Polygon
                    key={poly.id}
                    positions={poly.points}
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.4, weight: 2 }}
                />
            ))}

            {/* Current Drawing Points */}
            {isEditing && currentPoints.map((pos, idx) => (
                <CircleMarker
                    key={`point-${idx}`}
                    center={pos}
                    radius={4}
                    pathOptions={{ color: 'white', fillColor: '#16a34a', fillOpacity: 1 }}
                    eventHandlers={{
                        click: (e) => {
                            if (isEditing && idx === 0 && currentPoints.length >= 3) {
                                L.DomEvent.stopPropagation(e);
                                onPolygonComplete(currentPoints);
                                setMousePos(null);
                            }
                        }
                    }}
                />
            ))}

            {/* Lines connecting current points */}
            {isEditing && currentPoints.length > 0 && <Polyline positions={currentPoints} pathOptions={{ color: '#16a34a', weight: 2 }} />}

            {isEditing && currentPoints.length > 0 && mousePos && (
                <Polyline positions={[currentPoints[currentPoints.length - 1], mousePos]} pathOptions={{ color: '#16a34a', weight: 2, dashArray: '5, 10' }} />
            )}
            {isEditing && currentPoints.length >= 2 && mousePos && (
                <Polyline positions={[mousePos, currentPoints[0]]} pathOptions={{ color: '#16a34a', weight: 1, opacity: 0.5, dashArray: '5, 5' }} />
            )}
        </>
    );
}

// Helper to calc centroid
function getPolygonCentroid(points: [number, number][]): [number, number] {
    if (points.length === 0) return [0, 0];
    let latSum = 0, lngSum = 0;
    points.forEach(p => { latSum += p[0]; lngSum += p[1]; });
    return [latSum / points.length, lngSum / points.length];
}

export default function AgentRegisterFarmer() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { id } = useParams(); // If present, we are editing
    const isEditing = Boolean(id);

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Map State
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);
    const [polygons, setPolygons] = useState<FarmPolygon[]>([]);
    const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
    const [globalPolygons, setGlobalPolygons] = useState<any[]>([]);
    const [locationSearch, setLocationSearch] = useState('');
    const [searchingLocation, setSearchingLocation] = useState(false);
    const [showMapInstructions, setShowMapInstructions] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        // companyId removed
        role: 'farmer',
        // Location handled separately
        acres: '',
        tillage: 'ploughing',
        coverCrop: false,
        trees: '0',
        yearsFollowed: '0',
        consentType: 'otp', // otp | recording
        consentEvidence: '', // mock
        consentAgreed: false,
    });

    useEffect(() => {
        if (isEditing && id) {
            fetchFarmer(id);
        }
        fetchGlobalPolygons();
    }, [user, id]);

    const handleNameChange = (value: string) => {
        // Allow only alphabets and spaces
        const sanitized = value.replace(/[^a-zA-Z\s]/g, '');
        setFormData({ ...formData, name: sanitized });
    };

    const handlePhoneChange = (value: string) => {
        // Allow only digits, maximum 10 digits
        const sanitized = value.replace(/[^0-9]/g, '').slice(0, 10);
        setFormData({ ...formData, phone: sanitized });
    };

    const handleNumberChange = (field: 'acres' | 'trees' | 'yearsFollowed', value: string) => {
        // Prevent negative numbers
        const numValue = parseFloat(value);
        if (value === '' || numValue >= 0) {
            setFormData({ ...formData, [field]: value });
        }
    };

    const fetchGlobalPolygons = async () => {
        try {
            const q = query(collection(db, 'estimates'));
            const snapshot = await getDocs(q);
            const all: any[] = [];
            snapshot.docs.forEach((doc) => {
                const d = doc.data();
                if (d.polygons && Array.isArray(d.polygons)) {
                    d.polygons.forEach((p: any) => {
                        if (p.points && p.points.length >= 3) {
                            // Store polygon with agentId metadata
                            all.push({
                                ...p,
                                agentId: d.isAgentCreated ? d.userId : null // userId in estimates is the farmer ID, need to get agentId from farmers collection
                            });
                        }
                    });
                }
            });

            // Fetch farmer data to get agentId for each polygon
            const farmersQuery = query(collection(db, 'farmers'));
            const farmersSnapshot = await getDocs(farmersQuery);
            const farmerAgentMap = new Map();
            farmersSnapshot.docs.forEach(doc => {
                const farmerData = doc.data();
                farmerAgentMap.set(doc.id, farmerData.agentId);
            });

            // Update polygons with correct agentId
            all.forEach(polygon => {
                if (polygon.agentId) {
                    const agentId = farmerAgentMap.get(polygon.agentId);
                    polygon.agentId = agentId;
                }
            });

            setGlobalPolygons(all);
        } catch (err) {
            console.error("Error fetching global polygons for overlap check:", err);
            toast({
                title: "Warning",
                description: "Could not load existing farm boundaries. Overlap detection may be limited.",
                variant: "default"
            });
        }
    };

    const fetchFarmer = async (farmerId: string) => {
        try {
            const ref = doc(db, 'farmers', farmerId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                if (data.onboardingStatus !== 'submitted') {
                    toast({
                        title: "Cannot Edit",
                        description: "This farmer cannot be edited (status is not 'submitted').",
                        variant: "destructive"
                    });
                    navigate('/agent/dashboard');
                    return;
                }
                setFormData({
                    name: data.name,
                    phone: data.phone,
                    role: 'farmer',
                    acres: data.acres?.toString() || '',
                    tillage: data.practices?.tillage || 'ploughing',
                    coverCrop: data.practices?.coverCrop || false,
                    trees: data.practices?.trees?.toString() || '0',
                    yearsFollowed: data.practices?.yearsFollowed?.toString() || '0',
                    consentType: data.consent?.type || 'otp',
                    consentEvidence: data.consent?.evidence || '',
                    consentAgreed: true,
                });

                // Load Polygons
                if (data.polygons && data.polygons.length > 0) {
                    const loadedPolygons = data.polygons.map((poly: any) => ({
                        id: poly.id || Math.random().toString(36).substring(2, 9),
                        points: poly.points.map((p: any) => [p.lat, p.lng] as [number, number])
                    }));
                    setPolygons(loadedPolygons);
                    if (loadedPolygons.length > 0) {
                        setMapCenter(getPolygonCentroid(loadedPolygons[0].points));
                        setMapZoom(15);
                    }
                } else if (data.plotCoordinates) {
                    // Backwards compatibility
                    setPolygons([{
                        id: 'legacy',
                        points: data.plotCoordinates
                    }]);
                    setMapCenter(getPolygonCentroid(data.plotCoordinates));
                    setMapZoom(15);
                }
            }
        } catch (e) {
            console.error("Fetch farmer error", e);
        }
    };

    const checkOverlap = (newPoints: [number, number][]) => {
        try {
            if (newPoints.length < 3) return false;

            // Convert Leaflet [lat, lng] to Turf [lng, lat]
            const turfPoints = newPoints.map(p => [p[1], p[0]]);
            turfPoints.push(turfPoints[0]);

            const newPoly = turf.polygon([turfPoints]);

            // 1. Check against Global Polygons (DB)
            for (const gp of globalPolygons) {
                let gpPoints: number[][] = [];
                if (gp.points && gp.points.length > 0) {
                    const p0 = gp.points[0];
                    if (Array.isArray(p0)) {
                        gpPoints = gp.points.map((p: any) => [p[1], p[0]]);
                    } else if (typeof p0 === 'object' && 'lat' in p0 && 'lng' in p0) {
                        gpPoints = gp.points.map((p: any) => [p.lng, p.lat]);
                    }
                }

                if (gpPoints.length < 3) continue;

                gpPoints.push(gpPoints[0]);
                const gpTurfParams = [gpPoints];
                const gpPoly = turf.polygon(gpTurfParams);

                if (turf.booleanIntersects(newPoly, gpPoly)) {
                    return true;
                }
            }

            // 2. Check against Current Session Polygons (Local State)
            for (const lp of polygons) {
                const lpPoints = lp.points.map(p => [p[1], p[0]]);
                lpPoints.push(lpPoints[0]);
                const lpPoly = turf.polygon([lpPoints]);

                if (turf.booleanIntersects(newPoly, lpPoly)) {
                    return true;
                }
            }

            return false;
        } catch (e) {
            console.error("Turf check error", e);
            toast({
                title: "Overlap Check Error",
                description: "Unable to verify plot boundaries. Please try again.",
                variant: "destructive"
            });
            return false;
        }
    };


    const handlePolygonComplete = (points: [number, number][]) => {
        const isOverlapping = checkOverlap(points);
        if (isOverlapping) {
            toast({
                title: "Overlap Detected",
                description: "This area intersects with an existing farm boundary. Please draw a different area.",
                variant: "destructive"
            });
            setCurrentPoints([]);
            return;
        }

        setPolygons([...polygons, {
            id: Math.random().toString(36).substring(2, 9),
            points
        }]);
        setCurrentPoints([]);
    };

    const searchLocation = async () => {
        if (!locationSearch.trim()) {
            toast({
                title: "Empty Search",
                description: "Please enter a location to search.",
                variant: "default"
            });
            return;
        }

        setSearchingLocation(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setMapCenter([parseFloat(lat), parseFloat(lon)]);
                setMapZoom(15);
                toast({
                    title: "Location Found",
                    description: `Centered map on ${data[0].display_name}`,
                });
            } else {
                toast({
                    title: "Location Not Found",
                    description: "Could not find the specified location. Try a different search term.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Location search error:", error);
            toast({
                title: "Search Failed",
                description: "Unable to search for location. Please try again.",
                variant: "destructive"
            });
        } finally {
            setSearchingLocation(false);
        }
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast({
                title: "Not Supported",
                description: "Geolocation is not supported by your browser.",
                variant: "destructive"
            });
            return;
        }

        setSearchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setMapCenter([latitude, longitude]);
                setMapZoom(15);
                toast({
                    title: "Location Found",
                    description: "Centered map on your current location.",
                });
                setSearchingLocation(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                toast({
                    title: "Location Access Denied",
                    description: "Unable to access your location. Please enable location permissions.",
                    variant: "destructive"
                });
                setSearchingLocation(false);
            }
        );
    };

    const handleDeletePolygon = (id: string) => {
        setPolygons(polygons.filter(p => p.id !== id));
    };


    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Basic validation
            if (polygons.length < 1) throw new Error("Please mark at least one plot for land.");

            // Check for duplicate phone number
            if (formData.phone && formData.phone.trim()) {
                const phoneQuery = query(
                    collection(db, 'farmers'),
                    where('phone', '==', formData.phone.trim())
                );
                const phoneSnapshot = await getDocs(phoneQuery);

                // If editing, exclude current farmer from duplicate check
                const duplicates = phoneSnapshot.docs.filter(doc => doc.id !== id);

                if (duplicates.length > 0) {
                    toast({
                        title: "Duplicate Phone Number",
                        description: "This phone number is already registered with another farmer. Please use a unique phone number.",
                        variant: "destructive"
                    });
                    setLoading(false);
                    return;
                }
            }

            // Calculate centroid for env data (use first plot)
            const center = getPolygonCentroid(polygons[0].points);

            // --- AUTO CALCULATE CO2 ESTIMATES ---
            let autoData = { soc: 30, ndvi: 0.5, rainfall: 800 }; // defaults
            let estimates = { baselineCO2: 0, projectCO2: 0, perAcreCO2: 0 };

            try {
                // Fetch Env Data
                const envData = await fetchAllEnvironmentalData(center[0], center[1]);
                autoData = envData;

                // Calculate CO2
                const params: CO2EstimationParams = {
                    soc: envData.soc,
                    ndvi: envData.ndvi,
                    rainfall: envData.rainfall,
                    tillage: formData.tillage as any,
                    coverCrop: formData.coverCrop,
                    trees: parseInt(formData.trees),
                    yearsFollowed: parseInt(formData.yearsFollowed),
                    acres: parseFloat(formData.acres),
                    plotCoordinates: polygons[0].points.map(p => ({ lat: p[0], lon: p[1] }))
                };

                const calcResult = calculateCO2Estimation(params);

                estimates = {
                    baselineCO2: calcResult.baseGain * params.acres, // Simplified
                    projectCO2: calcResult.totalCO2,
                    perAcreCO2: calcResult.totalPerAcre
                };
            } catch (err) {
                console.warn("Failed to auto-calculate CO2", err);
            }
            // -------------------------------------

            // Prepare Polygon Data
            const polygonsData = polygons.map(poly => ({
                id: poly.id,
                points: poly.points.map(p => ({ lat: p[0], lng: p[1] }))
            }));

            const farmerData = {
                agentId: user.id,
                name: formData.name,
                phone: formData.phone,
                location: { lat: center[0], lon: center[1] },
                polygons: polygonsData,
                // Legacy support (optional, can keep for now)
                plotCoordinates: polygons[0].points.map(p => ({ lat: p[0], lon: p[1] })),

                acres: parseFloat(formData.acres),
                practices: {
                    tillage: formData.tillage,
                    coverCrop: formData.coverCrop,
                    trees: parseInt(formData.trees),
                    yearsFollowed: parseInt(formData.yearsFollowed),
                },
                consent: {
                    type: formData.consentType,
                    timestamp: new Date(),
                    evidence: formData.consentEvidence || 'mock-otp-verified'
                },
                onboardingStatus: 'submitted',
                autoData: autoData,
                estimates: estimates,
                projectStatus: { status: 'none' },
                updatedAt: serverTimestamp(),
            };

            let targetId = id;

            if (isEditing && id) {
                // Update
                const ref = doc(db, 'farmers', id);
                await updateDoc(ref, farmerData);

                // Audit Log
                await addDoc(collection(db, 'audit_logs'), {
                    agentId: user.id,
                    action: 'update_farmer',
                    targetFarmerId: id,
                    timestamp: serverTimestamp(),
                    changes: farmerData
                });

            } else {
                // Create
                const docRef = await addDoc(collection(db, 'farmers'), {
                    ...farmerData,
                    createdAt: serverTimestamp(),
                });
                targetId = docRef.id;

                // Audit Log
                await addDoc(collection(db, 'audit_logs'), {
                    agentId: user.id,
                    action: 'create_farmer',
                    targetFarmerId: targetId,
                    timestamp: serverTimestamp(),
                    changes: farmerData
                });
            }

            // NOTE: We should also ideally CREATE an 'estimates' document so it shows up in global checks
            // For now, let's keep it simple: Farmers collection acts as the record.
            // But 'FetchGlobalPolygons' queries 'estimates'. 
            // We should create a shadow 'estimates' doc or query 'farmers' too.
            // For consistency with Farmer dashboard, let's create a shadow estimate.

            const estimateData = {
                userId: targetId, // Farmer ID
                userName: formData.name,
                ...farmerData.practices,
                ...autoData,
                ...estimates,
                totalCO2: estimates.projectCO2,
                polygons: polygonsData,
                createdAt: serverTimestamp(),
                isAgentCreated: true
            };

            // Check if estimate exists
            const estQ = query(collection(db, 'estimates'), where('userId', '==', targetId));
            const estSnap = await getDocs(estQ);
            if (!estSnap.empty) {
                await updateDoc(doc(db, 'estimates', estSnap.docs[0].id), estimateData);
            } else {
                await addDoc(collection(db, 'estimates'), estimateData);
            }

            toast({
                title: "Success",
                description: isEditing ? "Farmer updated successfully!" : "Farmer registered successfully!",
            });
            navigate('/agent/dashboard');
        } catch (e: any) {
            console.error(e);
            toast({
                title: "Submission Failed",
                description: e.message || "An error occurred while saving farmer data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="agent">
            <div className="max-w-3xl mx-auto p-4 lg:p-8">
                <div className="mb-6 flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/agent/dashboard')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <h1 className="text-2xl font-bold">{isEditing ? 'Edit Farmer' : 'Register New Farmer'}</h1>
                </div>

                {/* Steps Indicator */}
                <div className="flex justify-between mb-8 px-4">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step >= s ? 'bg-primary text-white border-primary' : 'bg-transparent'}`}>
                                {s}
                            </div>
                            <span className="hidden sm:inline">
                                {s === 1 && 'Basic'}
                                {s === 2 && 'Plot'}
                                {s === 3 && 'Farming'}
                                {s === 4 && 'Consent'}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    {/* STEP 1: Basic Info */}
                    {step === 1 && (
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xl font-semibold">Basic Information</h2>

                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => handleNameChange(e.target.value)}
                                    placeholder="Farmer Name (alphabets only)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Phone Number (10 digits)</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={e => handlePhoneChange(e.target.value)}
                                    placeholder="9876543210"
                                    maxLength={10}
                                />
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button onClick={handleNext} disabled={!formData.name}>Next: Land Plot</Button>
                            </div>
                        </Card>
                    )}

                    {/* STEP 2: Map Plot */}
                    {step === 2 && (
                        <Card className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-semibold">Mark Land Plots</h2>
                                    <p className="text-sm text-muted-foreground">Click to mark points. Close loop to finish a plot.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setPolygons([]); setCurrentPoints([]); }} className="text-destructive">
                                        <Trash2 className="w-4 h-4 mr-2" /> Reset
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPoints([])} disabled={currentPoints.length === 0}>
                                        <Undo className="w-4 h-4 mr-2" /> Cancel Line
                                    </Button>
                                </div>
                            </div>

                            {polygons.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {polygons.map((p, i) => (
                                        <div key={p.id} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Plot {i + 1}
                                            <button onClick={() => setPolygons(polygons.filter(x => x.id !== p.id))} className="ml-1 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Location Search */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search location (e.g., Hyderabad, India)"
                                        className="pl-9"
                                        value={locationSearch}
                                        onChange={e => setLocationSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && searchLocation()}
                                        disabled={searchingLocation}
                                    />
                                </div>
                                <Button
                                    onClick={searchLocation}
                                    disabled={searchingLocation}
                                    variant="outline"
                                >
                                    {searchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                                </Button>
                                <Button
                                    onClick={getCurrentLocation}
                                    disabled={searchingLocation}
                                    variant="outline"
                                    title="Go to my current location"
                                >
                                    <Navigation className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="h-[400px] w-full rounded-lg overflow-hidden border relative">
                                <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%', cursor: 'crosshair' }}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <MapController center={mapCenter} zoom={mapZoom} />

                                    {/* Display other farmers' land boundaries */}
                                    {globalPolygons.map((gp, idx) => {
                                        let gpPoints: [number, number][] = [];
                                        if (gp.points && gp.points.length > 0) {
                                            const p0 = gp.points[0];
                                            if (Array.isArray(p0)) {
                                                gpPoints = gp.points.map((p: any) => [p[0], p[1]]);
                                            } else if (typeof p0 === 'object' && 'lat' in p0 && 'lng' in p0) {
                                                gpPoints = gp.points.map((p: any) => [p.lat, p.lng]);
                                            }
                                        }

                                        if (gpPoints.length >= 3) {
                                            // Determine color based on ownership
                                            const isMyAgent = gp.agentId === user?.id;
                                            const color = isMyAgent ? '#3b82f6' : '#6b7280'; // Blue for my farmers, gray for others
                                            const fillColor = isMyAgent ? '#60a5fa' : '#9ca3af';
                                            const label = isMyAgent ? "Your Registered Farmer's Land" : "Other Agent's Farmer Land";

                                            return (
                                                <Polygon
                                                    key={`global-${idx}`}
                                                    positions={gpPoints}
                                                    pathOptions={{
                                                        color: color,
                                                        fillColor: fillColor,
                                                        fillOpacity: 0.15,
                                                        weight: 2,
                                                        dashArray: isMyAgent ? undefined : '5, 5'
                                                    }}
                                                >
                                                    <Popup>
                                                        <div className="text-xs">
                                                            <p className="font-semibold" style={{ color: color }}>{label}</p>
                                                            <p className="text-muted-foreground">Cannot overlap with this area</p>
                                                        </div>
                                                    </Popup>
                                                </Polygon>
                                            );
                                        }
                                        return null;
                                    })}

                                    <FarmPolygonDrawer
                                        currentPoints={currentPoints}
                                        setCurrentPoints={setCurrentPoints}
                                        polygons={polygons}
                                        onPolygonComplete={handlePolygonComplete}
                                        isEditing={true}
                                    />
                                </MapContainer>

                                {showMapInstructions && polygons.length === 0 && currentPoints.length === 0 && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 p-4 rounded-xl shadow-lg text-center z-[1000]">
                                        <button
                                            onClick={() => setShowMapInstructions(false)}
                                            className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                                            title="Close instructions"
                                        >
                                            <X className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                                        <p className="font-medium">Start clicking on the map</p>
                                        <p className="text-xs text-muted-foreground">Mark boundaries of the farm</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex justify-between">
                                <Button variant="outline" onClick={handleBack}>Back</Button>
                                <Button onClick={handleNext} disabled={polygons.length === 0}>Next: Practices</Button>
                            </div>
                        </Card>
                    )}

                    {/* STEP 3: Practices */}
                    {step === 3 && (
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xl font-semibold">Farming Practices</h2>

                            <div className="space-y-2">
                                <Label>Total Acres</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.acres}
                                    onChange={e => handleNumberChange('acres', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tillage Practice</Label>
                                <Select value={formData.tillage} onValueChange={(v: any) => setFormData({ ...formData, tillage: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ploughing">Conventional Ploughing</SelectItem>
                                        <SelectItem value="reduced">Reduced Tillage</SelectItem>
                                        <SelectItem value="no-till">No-Till</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2 border p-3 rounded">
                                <Checkbox id="cover" checked={formData.coverCrop} onCheckedChange={(c: any) => setFormData({ ...formData, coverCrop: !!c })} />
                                <Label htmlFor="cover">Uses Cover Crops?</Label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Trees Count</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.trees}
                                        onChange={e => handleNumberChange('trees', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Years Followed</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.yearsFollowed}
                                        onChange={e => handleNumberChange('yearsFollowed', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-between">
                                <Button variant="outline" onClick={handleBack}>Back</Button>
                                <Button onClick={handleNext} disabled={!formData.acres}>Next: Consent</Button>
                            </div>
                        </Card>
                    )}

                    {/* STEP 4: Consent */}
                    {step === 4 && (
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xl font-semibold">Farmer Consent</h2>

                            <div className="space-y-2">
                                <Label>Consent Method</Label>
                                <Select value={formData.consentType} onValueChange={v => setFormData({ ...formData, consentType: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="otp">Phone OTP Verification</SelectItem>
                                        <SelectItem value="recording">Voice Recording</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.consentType === 'otp' ? (
                                <div className="p-4 bg-muted rounded-lg text-center space-y-2">
                                    <p className="text-sm">Send OTP to {formData.phone || '...'}</p>
                                    <Button variant="secondary" size="sm">Send OTP</Button>
                                    <Input placeholder="Enter Verify Code (Mock: Any)" className="max-w-[200px] mx-auto text-center" />
                                </div>
                            ) : (
                                <div className="p-4 bg-muted rounded-lg space-y-2">
                                    <Label>Upload Audio Consent</Label>
                                    <Input type="file" />
                                </div>
                            )}

                            <div className="flex items-center space-x-2 py-4">
                                <Checkbox id="agree" checked={formData.consentAgreed} onCheckedChange={(c: any) => setFormData({ ...formData, consentAgreed: !!c })} />
                                <Label htmlFor="agree" className="text-sm">
                                    I certify that I have explained the program to the farmer and obtained their consent to register.
                                </Label>
                            </div>

                            <div className="pt-4 flex justify-between">
                                <Button variant="outline" onClick={handleBack}>Back</Button>
                                <Button onClick={handleSubmit} disabled={!formData.consentAgreed || loading}>
                                    {loading ? 'Submitting...' : 'Submit Registration'}
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
