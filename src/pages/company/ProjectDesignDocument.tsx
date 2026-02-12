import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileText, Send, Loader2, ArrowRight, Building2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { PDDRequest, User } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function ProjectDesignDocument() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pddRequest, setPddRequest] = useState<PDDRequest | null>(null);
    const [registries, setRegistries] = useState<User[]>([]);
    const [selectedRegistryId, setSelectedRegistryId] = useState<string>('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            // 1. Fetch current PDD Status
            if (user?.id) {
                const qPDD = query(
                    collection(db, 'pdd_requests'),
                    where('companyId', '==', user.id),
                    orderBy('submittedAt', 'desc'),
                    limit(1)
                );
                const snapshotPDD = await getDocs(qPDD);
                if (!snapshotPDD.empty) {
                    const data = snapshotPDD.docs[0].data() as PDDRequest;
                    setPddRequest({ ...data, id: snapshotPDD.docs[0].id, submittedAt: data.submittedAt });
                }
            }

            // 2. Fetch Available Registries
            try {
                const qReg = query(collection(db, 'users'), where('role', '==', 'registry'));
                const snapshotReg = await getDocs(qReg);
                const regs = snapshotReg.docs.map(d => ({ ...d.data(), id: d.id } as User));
                setRegistries(regs);

                if (regs.length === 0) {
                    console.warn("No registries found in 'users' collection with role='registry'.");
                }
            } catch (regError: any) {
                setFetchError(`Error loading registries: ${regError.message}`);
            }

        } catch (error: any) {
            console.error("Error fetching data:", error);
            setFetchError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitPDD = async () => {
        if (!selectedRegistryId || !user) return;
        setSubmitting(true);
        try {
            const registryUser = registries.find(r => r.id === selectedRegistryId);
            const registryName = registryUser?.name || 'Unknown Registry';

            const newRequest: Omit<PDDRequest, 'id'> = {
                companyId: user.id,
                companyName: (user as any).companyName || user.name,
                registryName: registryName as any,
                status: 'submitted',
                submittedAt: new Date(),
                documentUrl: `https://agrocarbon.storage/pdd/${user.id}_${Date.now()}.pdf`
            };

            await addDoc(collection(db, 'pdd_requests'), newRequest);

            toast({
                title: "PDD Submitted Successfully",
                description: `Your application to ${registryName} has been sent.`,
            });

            fetchData();
            setShowConfirm(false);

        } catch (error) {
            console.error("Error submitting PDD:", error);
            toast({
                title: "Submission Failed",
                description: "There was an error sending your PDD. Please try again.",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout role="company">
            <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-display font-bold text-foreground">Project Registration 📝</h1>
                    <p className="text-muted-foreground">Submit your Project Design Document (PDD) to a registry to get your Project ID.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : pddRequest ? (
                    /* STATUS VIEW */
                    <div className="grid gap-6">
                        <Card className="border-l-4 border-l-primary shadow-md">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            Application Status:
                                            <Badge variant={
                                                pddRequest.status === 'registered' ? 'default' :
                                                    pddRequest.status === 'rejected' ? 'destructive' : 'secondary'
                                            } className="text-base px-3 py-1 capitalize">
                                                {pddRequest.status === 'registered' ? 'Approved & Registered' :
                                                    pddRequest.status === 'submitted' ? 'Pending Review' : pddRequest.status}
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription>
                                            Submitted on {(pddRequest.submittedAt as any)?.toDate ? (pddRequest.submittedAt as any).toDate().toLocaleDateString() : new Date(pddRequest.submittedAt).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                    {(pddRequest.status === 'registered' || pddRequest.status === 'validated') && (
                                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg border border-green-200 text-center">
                                            <div className="text-xs uppercase tracking-wide font-semibold opacity-70">Project ID Assigned</div>
                                            <div className="text-2xl font-mono font-bold mt-1">{pddRequest.registryProjectId}</div>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground">Target Registry</Label>
                                        <div className="font-medium text-lg flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-gray-500" />
                                            {pddRequest.registryName}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-muted-foreground">Document</Label>
                                        <div className="font-medium text-lg flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-gray-500" />
                                            <Link to="/company/my-pdd" className="text-primary hover:underline cursor-pointer flex items-center gap-1">
                                                View Saved PDD <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {pddRequest.status === 'submitted' && (
                                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 items-start">
                                        <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                                        <div>
                                            <h4 className="font-semibold">Review in Progress</h4>
                                            <p className="text-sm opacity-90 mt-1">
                                                The registry is currently reviewing your Project Design Document.
                                                Once approved, you will be issued a Project ID and can begin verifying batches.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* REGISTRATION FORM */
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="md:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Submit New Application</CardTitle>
                                    <CardDescription>
                                        Select your target registry and submit your PDD for approval.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        <Label>Select Registry</Label>
                                        {fetchError ? (
                                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-start gap-2 text-sm">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold">Connection Error</p>
                                                    <p>{fetchError}</p>
                                                    <p className="mt-1 text-xs opacity-80">Check Firestore Security Rules or Network.</p>
                                                </div>
                                            </div>
                                        ) : registries.length > 0 ? (
                                            <Select value={selectedRegistryId} onValueChange={setSelectedRegistryId}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a registry..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {registries.map(reg => (
                                                        <SelectItem key={reg.id} value={reg.id}>{reg.name} (ID: {reg.id.substring(0, 6)}...)</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="text-sm text-muted-foreground border p-3 rounded-md bg-muted/50">
                                                No registries found. Please ensure a user with role 'registry' exists.
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-muted/50 p-4 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium">PDD_{user?.name?.replace(/\s+/g, '_')}_v1.pdf</div>
                                                <div className="text-xs text-muted-foreground">Auto-generated from Project Data</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to="/company/my-pdd"
                                                state={{ targetRegistry: registries.find(r => r.id === selectedRegistryId)?.name }}
                                            >
                                                <Button variant="outline" size="sm" className="h-7 text-xs">Preview</Button>
                                            </Link>
                                            <Badge variant="outline" className="bg-white">Ready to Send</Badge>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full"
                                        size="lg"
                                        disabled={!selectedRegistryId || submitting || registries.length === 0}
                                        onClick={() => setShowConfirm(true)}
                                    >
                                        Generate & Send PDD
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                                <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
                                    <AlertCircle className="w-5 h-5" />
                                    How it works
                                </h3>
                                <ul className="space-y-3 text-sm text-blue-800">
                                    <li className="flex gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                                        <span>Select the registry you are applying to.</span>
                                    </li>
                                    <li className="flex gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                                        <span>We attach the PDD generated from your current data. (See My PDD tab)</span>
                                    </li>
                                    <li className="flex gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                                        <span>Registry assigns a <strong>Project ID</strong> upon approval.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Submit PDD to Registry?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to submit your Project Design Document?
                                This will officially request registration.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSubmitPDD} disabled={submitting}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Yes, Send PDD
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}
