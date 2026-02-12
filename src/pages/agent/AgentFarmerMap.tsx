import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MapContainer, TileLayer, Polygon, Popup, useMap, Marker } from 'react-leaflet';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, MapPin, Search, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Helper to calc centroid - Robusted
function getPolygonCentroid(points: [number, number][]): [number, number] {
    if (!points || points.length === 0) return [20.5937, 78.9629]; // Default India center
    let latSum = 0, lngSum = 0;
    let validCount = 0;
    points.forEach(p => {
        if (!isNaN(p[0]) && !isNaN(p[1])) {
            latSum += p[0];
            lngSum += p[1];
            validCount++;
        }
    });
    if (validCount === 0) return [20.5937, 78.9629];
    return [latSum / validCount, lngSum / validCount];
}

interface FarmerMapData {
    id: string;
    name: string;
    acres: number;
    polygons: { points: [number, number][] }[];
    location?: { lat: number, lon: number };
}

export default function AgentFarmerMap() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [farmers, setFarmers] = useState<FarmerMapData[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchFarmers = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            // Fetch all farmers managed by this agent
            // To see "All" farmers in the system (like an admin view), remove the agentId filter.
            // But usually Agents only see their own. 
            // The user request "seeing plots of all the registered farmers" might imply *Global* view. 
            // Let's stick to Agent's farmers for now, but maybe fetch 'estimates' globally for context if needed?
            // For now: AGENT'S FARMERS.
            const q = query(collection(db, 'farmers'), where('agentId', '==', user.id));
            const snapshot = await getDocs(q);

            const rawFarmers: FarmerMapData[] = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const polygons: { points: [number, number][] }[] = [];

                if (data.polygons && Array.isArray(data.polygons)) {
                    data.polygons.forEach((p: any) => {
                        if (p.points && p.points.length >= 3) {
                            const validPoints = p.points
                                .map((pt: any) => [Number(pt.lat), Number(pt.lng)] as [number, number])
                                .filter((pt: [number, number]) => !isNaN(pt[0]) && !isNaN(pt[1]));

                            if (validPoints.length >= 3) {
                                polygons.push({ points: validPoints });
                            }
                        }
                    });
                } else if (data.plotCoordinates && Array.isArray(data.plotCoordinates)) {
                    // Legacy
                    const validPoints = data.plotCoordinates
                        .map((pt: any) => [Number(pt.lat), Number(pt.lon || pt.lng)] as [number, number])
                        .filter((pt: [number, number]) => !isNaN(pt[0]) && !isNaN(pt[1]));

                    if (validPoints.length >= 3) {
                        polygons.push({ points: validPoints });
                    }
                }

                // Safe Location Check
                let location = data.location;
                if (location && (!Number.isFinite(location.lat) || !Number.isFinite(location.lon))) {
                    location = undefined;
                }

                if (polygons.length > 0 || location) {
                    rawFarmers.push({
                        id: doc.id,
                        name: data.name,
                        acres: data.acres || 0,
                        polygons: polygons,
                        location: location
                    });
                }
            });

            setFarmers(rawFarmers);

            // Auto-center if farmers exist
            if (rawFarmers.length > 0) {
                // Try to find first valid polygon
                const firstPoly = rawFarmers.find(f => f.polygons.length > 0);
                if (firstPoly && firstPoly.polygons[0].points.length > 0) {
                    const centroid = getPolygonCentroid(firstPoly.polygons[0].points);
                    setMapCenter(centroid);
                    setMapZoom(13);
                } else if (rawFarmers[0].location) { // Fallback to marker location
                    setMapCenter([rawFarmers[0].location.lat, rawFarmers[0].location.lon]);
                    setMapZoom(13);
                }
            }

        } catch (error) {
            console.error("Error fetching map data:", error);
            toast({
                title: "Error Loading Map",
                description: "Failed to load farmer locations. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchFarmers();
    }, [fetchFarmers]);

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            toast({
                title: "Empty Search",
                description: "Please enter a farmer name to search.",
                variant: "default"
            });
            return;
        }
        const found = farmers.find(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (found) {
            if (found.polygons.length > 0) {
                setMapCenter(getPolygonCentroid(found.polygons[0].points));
                setMapZoom(15);
            } else if (found.location) {
                setMapCenter([found.location.lat, found.location.lon]);
                setMapZoom(15);
            }
            toast({
                title: "Farmer Found",
                description: `Centered map on ${found.name}'s location.`,
            });
        } else {
            toast({
                title: "Not Found",
                description: `No farmer found matching "${searchQuery}".`,
                variant: "destructive"
            });
        }
    };

    return (
        <DashboardLayout role="agent">
            <div className="flex flex-col h-[calc(100vh-80px)] w-full">
                {/* Header Overlay or Top Bar */}
                <div className="p-4 bg-background border-b flex justify-between items-center px-6 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="text-primary" /> Farmer Map</h1>
                        <p className="text-sm text-muted-foreground">{farmers.length} farmers with land records</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Find farmer..."
                                className="w-full pl-9 pr-4 py-2 rounded-md border text-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <button onClick={handleSearch} className="btn-primary">Find</button>
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 w-full relative bg-muted/20">
                    {loading && (
                        <div className="absolute inset-0 z-50 bg-background/50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && farmers.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center space-y-4">
                                <Users className="w-16 h-16 mx-auto text-muted-foreground/50" />
                                <div>
                                    <h3 className="text-lg font-semibold text-muted-foreground">No Farmers Yet</h3>
                                    <p className="text-sm text-muted-foreground/70 mt-1">Register your first farmer to see them on the map</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && farmers.length > 0 && (
                        <MapContainer
                            center={mapCenter}
                            zoom={mapZoom}
                            className="h-full w-full absolute inset-0"
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapController center={mapCenter} zoom={mapZoom} />

                            {farmers.map(farmer => (
                                <div key={farmer.id}>
                                    {/* Polygons */}
                                    {farmer.polygons.map((poly, i) => (
                                        <Polygon
                                            key={`${farmer.id}-poly-${i}`}
                                            positions={poly.points}
                                            pathOptions={{ color: 'blue', fillColor: '#3b82f6', fillOpacity: 0.4 }}
                                        >
                                            <Popup>
                                                <div className="font-bold">{farmer.name}</div>
                                                <div className="text-xs">{farmer.acres} acres</div>
                                            </Popup>
                                        </Polygon>
                                    ))}

                                    {/* Fallback Marker */}
                                    {farmer.polygons.length === 0 && farmer.location && (
                                        <Marker position={[farmer.location.lat, farmer.location.lon]}>
                                            <Popup>
                                                <div className="font-bold">{farmer.name}</div>
                                                <div className="text-xs text-muted-foreground">No boundary set</div>
                                            </Popup>
                                        </Marker>
                                    )}
                                </div>
                            ))}
                        </MapContainer>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
