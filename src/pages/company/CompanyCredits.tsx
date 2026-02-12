// import DashboardLayout from '@/components/layout/DashboardLayout';
// import { Leaf, Award, Calendar, Search, Filter, Loader2, Download, Copy, ExternalLink, Archive } from 'lucide-react';
// import { useState, useEffect } from 'react';
// import { db } from '@/lib/firebase';
// import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
// import { useAuth } from '@/contexts/AuthContext';
// import { toast } from 'sonner';

// interface IssuedCredit {
//     id: string;
//     serialNumber: string;
//     registryProjectId: string;
//     batchId: string;
//     issuedAt: any;
//     status: string;
//     vintage: number;
//     plotId?: string;
// }

// export default function CompanyCredits() {
//     const { user } = useAuth();
//     const [credits, setCredits] = useState<IssuedCredit[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [searchTerm, setSearchTerm] = useState('');

//     useEffect(() => {
//         fetchCredits();
//     }, [user]);

//     const fetchCredits = async () => {
//         if (!user) return;
//         setLoading(true);
//         try {
//             // 1. Fetch from 'issued_credits' collection based on companyId
//             // The user verified that companyId exists in the documents.
//             const q = query(
//                 collection(db, 'issued_credits'),
//                 where('companyId', '==', user.id),
//                 limit(200)
//             );
//             // console.log(user.id);
//             const snapshot = await getDocs(q);
//             console.log("Documents found:", snapshot.size); // If this is 0, the query criteria is the problem
//             console.log("User ID searching for:", user.id);
//             const data = snapshot.docs.map(doc => ({
//                 id: doc.id,
//                 ...doc.data(),
//                 // Normalize date if needed (though Timestamp.now() saves as Timestamp)
//                 issuedAt: doc.data().issuedAt?.toDate ? doc.data().issuedAt.toDate() : new Date()
//             })) as IssuedCredit[];

//             // Sort client-side to avoid needing a composite index
//             data.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

//             setCredits(data);

//         } catch (error) {
//             console.error("Error fetching credits:", error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const filteredCredits = credits.filter(c =>
//         c.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         c.registryProjectId.toLowerCase().includes(searchTerm.toLowerCase())
//     );

//     const copySerial = (serial: string) => {
//         navigator.clipboard.writeText(serial);
//         toast.success("Serial number copied!");
//     };

//     return (
//         <DashboardLayout role="company">
//             <div className="p-6 lg:p-8 space-y-6">
//                 {/* Header */}
//                 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
//                     <div>
//                         <h1 className="text-3xl font-display font-bold text-foreground">Issued Credits</h1>
//                         <p className="text-muted-foreground mt-1">Registry of your verified, issued carbon credits (VCUs)</p>
//                     </div>
//                     <div className="card-elevated px-4 py-2 bg-green-50 border-green-200">
//                         <div className="text-sm text-green-700">Total Credits Available</div>
//                         <div className="text-2xl font-bold text-green-800">{credits.length} VCUs</div>
//                     </div>
//                 </div>

//                 {/* Search */}
//                 <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
//                     <div className="relative flex-1">
//                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
//                         <input
//                             type="text"
//                             value={searchTerm}
//                             onChange={(e) => setSearchTerm(e.target.value)}
//                             placeholder="Search serial number..."
//                             className="input-field pl-10"
//                         />
//                     </div>
//                     <button className="btn-secondary gap-2">
//                         <Download className="w-5 h-5" /> Export CSV
//                     </button>
//                 </div>

//                 {/* List */}
//                 {loading ? (
//                     <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
//                 ) : credits.length === 0 ? (
//                     <div className="text-center py-12 card-elevated">
//                         <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
//                         <h3 className="text-lg font-medium text-foreground">No Credits Issued Yet</h3>
//                         <p className="text-muted-foreground">Complete verification to receive your serial numbers.</p>
//                     </div>
//                 ) : (
//                     <div className="card-elevated overflow-hidden">
//                         <div className="overflow-x-auto">
//                             <table className="w-full">
//                                 <thead className="bg-muted/50 border-b">
//                                     <tr>
//                                         <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Serial Number</th>
//                                         <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Project ID</th>
//                                         <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Plot ID</th>
//                                         <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Vintage</th>
//                                         <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
//                                         <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Issued Date</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody className="divide-y divide-border">
//                                     {filteredCredits.map((credit, i) => (
//                                         <tr key={credit.id} className="hover:bg-muted/30 transition-colors">
//                                             <td className="px-6 py-3">
//                                                 <div className="flex items-center gap-2 font-mono text-sm text-primary font-medium">
//                                                     {credit.serialNumber}
//                                                     <button onClick={() => copySerial(credit.serialNumber)} className="opacity-50 hover:opacity-100 hover:text-foreground">
//                                                         <Copy className="w-3 h-3" />
//                                                     </button>
//                                                 </div>
//                                             </td>
//                                             <td className="px-6 py-3 text-sm">{credit.registryProjectId}</td>
//                                             <td className="px-6 py-3 text-sm font-mono text-muted-foreground">
//                                                 {credit.plotId || '-'}
//                                             </td>
//                                             <td className="px-6 py-3 text-sm">{credit.vintage}</td>
//                                             <td className="px-6 py-3">
//                                                 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
//                                                     Active
//                                                 </span>
//                                             </td>
//                                             <td className="px-6 py-3 text-sm text-right text-muted-foreground">
//                                                 {credit.issuedAt?.toLocaleDateString ? credit.issuedAt.toLocaleDateString() : 'Unknown'}
//                                             </td>
//                                         </tr>
//                                     ))}
//                                 </tbody>
//                             </table>
//                         </div>
//                     </div>
//                 )}

//             </div>
//         </DashboardLayout>
//     );
// }
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Leaf, Award, Calendar, Search, Filter, Loader2, Download, Copy, ExternalLink, Archive } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface IssuedCredit {
    id: string;
    serialNumber: string;
    registryProjectId: string;
    batchId: string;
    issuedAt: any;
    status: string;
    vintage: number;
    plotId?: string;
}

export default function CompanyCredits() {
    const { user } = useAuth();
    const [credits, setCredits] = useState<IssuedCredit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCredits();
    }, [user]);

    const fetchCredits = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Fetch from 'issued_credits' collection based on companyId
            // The user verified that companyId exists in the documents.
            const q = query(
                collection(db, 'issued_credits'),
                where('companyId', '==', user.id),
                orderBy('issuedAt', 'desc'),
                limit(200)
            );
            // console.log(user.id);
            const snapshot = await getDocs(q);
            console.log("Documents found:", snapshot.size); // If this is 0, the query criteria is the problem
            console.log("User ID searching for:", user.id);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Normalize date if needed (though Timestamp.now() saves as Timestamp)
                issuedAt: doc.data().issuedAt?.toDate ? doc.data().issuedAt.toDate() : new Date()
            })) as IssuedCredit[];

            setCredits(data);

        } catch (error) {
            console.error("Error fetching credits:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCredits = credits.filter(c =>
        c.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.registryProjectId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const copySerial = (serial: string) => {
        navigator.clipboard.writeText(serial);
        toast.success("Serial number copied!");
    };

    const handleExport = () => {
        if (filteredCredits.length === 0) {
            toast.error("No credits to export");
            return;
        }

        const headers = ["Serial Number", "Project ID", "Plot ID", "Vintage", "Status", "Issued Date"];
        const csvContent = [
            headers.join(","),
            ...filteredCredits.map(c => [
                c.serialNumber,
                c.registryProjectId,
                c.plotId || "",
                c.vintage,
                c.status,
                c.issuedAt?.toLocaleDateString ? c.issuedAt.toLocaleDateString() : ""
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `issued_credits_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DashboardLayout role="company">
            <div className="p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Issued Credits</h1>
                        <p className="text-muted-foreground mt-1">Registry of your verified, issued carbon credits (VCUs)</p>
                    </div>
                    <div className="card-elevated px-4 py-2 bg-green-50 border-green-200">
                        <div className="text-sm text-green-700">Total Credits Available</div>
                        <div className="text-2xl font-bold text-green-800">{credits.length} VCUs</div>
                    </div>
                </div>

                {/* Search */}
                <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search serial number..."
                            className="input-field pl-10"
                        />
                    </div>
                    <button onClick={handleExport} className="btn-secondary gap-2">
                        <Download className="w-5 h-5" /> Export CSV
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : credits.length === 0 ? (
                    <div className="text-center py-12 card-elevated">
                        <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No Credits Issued Yet</h3>
                        <p className="text-muted-foreground">Complete verification to receive your serial numbers.</p>
                    </div>
                ) : (
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Serial Number</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Project ID</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Plot ID</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Vintage</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Issued Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredCredits.map((credit, i) => (
                                        <tr key={credit.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2 font-mono text-sm text-primary font-medium">
                                                    {credit.serialNumber}
                                                    <button onClick={() => copySerial(credit.serialNumber)} className="opacity-50 hover:opacity-100 hover:text-foreground">
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-sm">{credit.registryProjectId}</td>
                                            <td className="px-6 py-3 text-sm font-mono text-muted-foreground">
                                                {credit.plotId || '-'}
                                            </td>
                                            <td className="px-6 py-3 text-sm">{credit.vintage}</td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${credit.status === 'active'
                                                    ? 'bg-green-100 text-green-700'
                                                    : credit.status === 'sold'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {credit.status ? credit.status.charAt(0).toUpperCase() + credit.status.slice(1) : 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-sm text-right text-muted-foreground">
                                                {credit.issuedAt?.toLocaleDateString ? credit.issuedAt.toLocaleDateString() : 'Unknown'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
