import DashboardLayout from '@/components/layout/DashboardLayout';
import { Users, Search, Download, Filter, MapPin, Leaf, Calendar, Loader2, X, Check, Trash2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Farmer {
  id: string; // Application ID
  farmerId: string;
  farmerName: string;
  farmerAcres: number;
  farmerTotalCO2?: number;
  farmerBaseCO2?: number;
  createdAt: any;
  projectName: string;
  plotIds: string[]; // Changed to array
  documentsVerified?: boolean;
}

export default function CompanyFarmers() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[] | null>(null);
  const [selectedFarmerName, setSelectedFarmerName] = useState<string>('');

  useEffect(() => {
    fetchFarmers();
  }, [user]);

  const fetchFarmers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch only accepted applications for this company
      const q = query(
        collection(db, 'project_applications'),
        where('companyId', '==', user.id),
        where('status', '==', 'accepted')
      );

      const querySnapshot = await getDocs(q);
      const fetchedFarmers: Farmer[] = [];

      // Fetch farmers and their polygon IDs
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        // Fetch polygon IDs from estimates
        const plotIds: string[] = [];
        try {
          const estQ = query(collection(db, 'estimates'), where('userId', '==', data.farmerId));
          const estSnap = await getDocs(estQ);
          if (!estSnap.empty) {
            const estDocs = estSnap.docs.map(d => d.data());
            estDocs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            const latest = estDocs[0];

            // Get all polygon IDs
            if (latest.polygons && latest.polygons.length > 0) {
              latest.polygons.forEach((polygon: any) => {
                if (polygon.id) {
                  plotIds.push(polygon.id);
                }
              });
            }
          }
        } catch (err) {
          console.error(`Error fetching polygons for ${data.farmerId}`, err);
        }

        fetchedFarmers.push({
          id: docSnap.id,
          farmerId: data.farmerId,
          farmerName: data.farmerName,
          farmerAcres: data.farmerAcres || 0,
          farmerTotalCO2: data.farmerTotalCO2,
          farmerBaseCO2: data.farmerBaseCO2,
          createdAt: data.createdAt,
          projectName: data.projectName || 'N/A',
          plotIds: plotIds,
          documentsVerified: data.documentsVerified || false
        });
      }

      // Sort by date joined (createdAt)
      fetchedFarmers.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      setFarmers(fetchedFarmers);
    } catch (error) {
      console.error("Error fetching farmers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (farmer: Farmer) => {
    try {
      const batch = writeBatch(db);

      // 1. Update Application
      const appRef = doc(db, 'project_applications', farmer.id);
      batch.update(appRef, {
        documentsVerified: true
      });

      // 2. Update Farmer (Status = verified, Clear Meeting)
      const farmerRef = doc(db, 'farmers', farmer.farmerId);
      batch.update(farmerRef, {
        onboardingStatus: 'verified',
        'projectStatus.meetingDate': deleteField(),
        'projectStatus.meetingSlot': deleteField()
      });

      await batch.commit();

      // Update local state
      setFarmers(farmers.map(f =>
        f.id === farmer.id ? { ...f, documentsVerified: true } : f
      ));

      toast.success("Documents verified. Farmer is now fully verified.");
    } catch (error) {
      console.error("Error verifying documents:", error);
      toast.error("Failed to verify documents");
    }
  };

  const handleRejectDocs = async (farmer: Farmer) => {
    if (!window.confirm("Reject documents? This will mark the farmer as 'Rejected' but keep them in the project list for now.")) {
      return;
    }
    try {
      const batch = writeBatch(db);

      // Update Farmer Status (Notify Agent)
      const farmerRef = doc(db, 'farmers', farmer.farmerId);
      batch.update(farmerRef, {
        onboardingStatus: 'rejected',
        'projectStatus.status': 'rejected'
      });

      await batch.commit();
      toast.success("Documents rejected. Status updated.");
    } catch (error) {
      console.error("Error rejecting docs:", error);
      toast.error("Failed to reject documents");
    }
  };

  const handleRemove = async (farmer: Farmer) => {
    if (!window.confirm("Are you sure you want to REMOVE this farmer from the project? Agent will be notified.")) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Update Farmer Status (Notify Agent)
      const farmerRef = doc(db, 'farmers', farmer.farmerId);
      batch.update(farmerRef, {
        onboardingStatus: 'rejected',
        'projectStatus.status': 'removed',
      });

      // 2. Remove Application (Cleanup Company View)
      const appRef = doc(db, 'project_applications', farmer.id);
      batch.delete(appRef);

      await batch.commit();

      // Update local state
      setFarmers(farmers.filter(f => f.id !== farmer.id));

      toast.success("Farmer removed from project.");
    } catch (error) {
      console.error("Error removing farmer:", error);
      toast.error("Failed to remove farmer");
    }
  };

  const filteredFarmers = farmers.filter(
    (farmer) =>
      farmer.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      farmer.farmerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      farmer.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAcres = filteredFarmers.reduce((sum, f) => sum + f.farmerAcres, 0);
  const totalBaseline = filteredFarmers.reduce((sum, f) => sum + (f.farmerBaseCO2 || 0), 0);
  const totalProject = filteredFarmers.reduce((sum, f) => sum + (f.farmerTotalCO2 || 0), 0);

  return (
    <DashboardLayout role="company">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Farmer List</h1>
            <p className="text-muted-foreground mt-1">All enrolled farmers and their plot details</p>
          </div>
          <button className="btn-secondary gap-2 self-start">
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" />
              Total Farmers
            </div>
            <div className="text-2xl font-bold text-foreground">{filteredFarmers.length}</div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <MapPin className="w-4 h-4" />
              Total Acres
            </div>
            <div className="text-2xl font-bold text-foreground">{totalAcres.toFixed(1)}</div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Leaf className="w-4 h-4" />
              Baseline tCO₂
            </div>
            <div className="text-2xl font-bold text-foreground">{totalBaseline.toFixed(1)}</div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Leaf className="w-4 h-4 text-primary" />
              Project tCO₂
            </div>
            <div className="text-2xl font-bold text-primary">{totalProject.toFixed(1)}</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, farmer ID, or project..."
              className="input-field pl-10"
            />
          </div>
          <button className="btn-secondary gap-2">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredFarmers.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Farmers Yet</h3>
            <p className="text-muted-foreground">Accept farmer applications to see them here.</p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {/* <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Farmer ID</th> */}
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Plot ID</th>

                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Acres</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Date Joined</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Baseline</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Project Est.</th>
                    <th className="text-center px-6 py-4 text-sm font-medium text-muted-foreground w-[180px]">Doc Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFarmers.map((farmer) => (
                    <tr key={farmer.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      {/* <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                        {farmer.farmerId.slice(0, 8)}...
                      </td> */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{farmer.farmerName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-foreground">
                        {farmer.plotIds.length === 0 ? (
                          'N/A'
                        ) : farmer.plotIds.length === 1 ? (
                          farmer.plotIds[0]
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{farmer.plotIds[0]}</span>
                            <button
                              onClick={() => {
                                setSelectedPlotIds(farmer.plotIds);
                                setSelectedFarmerName(farmer.farmerName);
                              }}
                              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              +{farmer.plotIds.length - 1} more
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-foreground">{farmer.farmerAcres}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {farmer.createdAt ? format(farmer.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {farmer.farmerBaseCO2 ? `${farmer.farmerBaseCO2.toFixed(1)} tCO₂` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-primary">
                          {farmer.farmerTotalCO2 ? `${farmer.farmerTotalCO2.toFixed(1)} tCO₂` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {farmer.documentsVerified ? (
                            <>
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                <Check className="w-4 h-4" /> Verified
                              </div>
                              <button
                                onClick={() => handleRemove(farmer)}
                                className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                title="Remove Farmer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleVerify(farmer)}
                                className="p-2 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
                                title="Verify Documents"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectDocs(farmer)}
                                className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                title="Reject Documents"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemove(farmer)}
                                className="p-2 hover:bg-orange-100 text-orange-600 rounded-lg transition-colors"
                                title="Remove from Project"
                              >
                                <Trash2 className="w-4 h-4" />
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
          </div>
        )}

        {/* Plot IDs Modal */}
        {selectedPlotIds && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSelectedPlotIds(null)}
          >
            <div
              className="bg-background rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Plot IDs</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedFarmerName}</p>
                </div>
                <button
                  onClick={() => setSelectedPlotIds(null)}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-2">
                  {selectedPlotIds.map((plotId, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">{plotId}</span>
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Total: <span className="font-medium text-foreground">{selectedPlotIds.length}</span> plot{selectedPlotIds.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
