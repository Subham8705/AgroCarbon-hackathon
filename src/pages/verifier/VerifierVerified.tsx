import DashboardLayout from '@/components/layout/DashboardLayout';
import { FileCheck, Download, Calendar, Building2, Leaf } from 'lucide-react';

// Mock verified data
const mockVerified = [
  {
    id: 'ver_1',
    projectName: 'Regenerative Cotton Initiative',
    companyName: 'GreenCarbon Ltd',
    batchId: 'January 2026',
    plotCount: 45,
    verifiedCredits: 82.4,
    submittedAt: '2024-01-20',
  },
  {
    id: 'ver_2',
    projectName: 'Sustainable Rice Farming',
    companyName: 'EcoFarm Solutions',
    batchId: 'December 2025',
    plotCount: 38,
    verifiedCredits: 68.2,
    submittedAt: '2024-01-15',
  },
  {
    id: 'ver_3',
    projectName: 'Agroforestry Carbon Project',
    companyName: 'AgriGreen Corp',
    batchId: 'December 2025',
    plotCount: 52,
    verifiedCredits: 95.1,
    submittedAt: '2024-01-10',
  },
  {
    id: 'ver_4',
    projectName: 'Organic Wheat Conservation',
    companyName: 'GreenCarbon Ltd',
    batchId: 'November 2025',
    plotCount: 30,
    verifiedCredits: 48.6,
    submittedAt: '2023-12-20',
  },
];

export default function VerifierVerified() {
  const totalCredits = mockVerified.reduce((sum, v) => sum + v.verifiedCredits, 0);

  return (
    <DashboardLayout role="verifier">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Verified Credits</h1>
            <p className="text-muted-foreground mt-1">Your complete verification history</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="card-elevated px-4 py-2">
              <div className="text-sm text-muted-foreground">Total Verified</div>
              <div className="text-2xl font-bold text-primary">{totalCredits.toFixed(1)} tCO₂</div>
            </div>
            <button className="btn-secondary gap-2">
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>

        {/* Verified List */}
        <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Batch</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Plots</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Verified Credits</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {mockVerified.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg gradient-verifier flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-foreground">{item.projectName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {item.companyName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {item.batchId}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{item.plotCount}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-primary font-bold">
                        <Leaf className="w-4 h-4" />
                        {item.verifiedCredits} tCO₂
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{item.submittedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
