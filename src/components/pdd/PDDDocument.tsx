import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDDDocumentProps {
    data: {
        companyName: string;
        region: string;
        startDate: Date | any;
        totalFarmers: number;
        totalAcres: number;
        estimatedCO2: number;
        projectId?: string;
        registry?: string;
        plots?: any[];
    };
}

export default function PDDDocument({ data }: PDDDocumentProps) {
    return (
        <div className="border rounded-lg p-8 bg-white text-sm space-y-8 font-serif text-slate-800 shadow-sm min-h-[600px] animate-fade-in">
            {/* PDD Header */}
            <div className="border-b pb-6 text-center space-y-2">
                <h1 className="text-2xl font-bold uppercase tracking-widest">Project Design Document</h1>
                <div className="text-muted-foreground">Version 1.0 • {new Date().getFullYear()}</div>
            </div>

            {/* Section 1: Project Details */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">1. Project Details</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">Project Name</span>
                        {data.companyName}
                    </div>
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">Project Type</span>
                        Agroforestry & Soil Carbon Sequestration
                    </div>
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">Project Region</span>
                        {data.region}
                    </div>
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">Project Start Date</span>
                        {data.startDate ? (data.startDate.toDate ? data.startDate.toDate().toLocaleDateString() : new Date(data.startDate).toLocaleDateString()) : 'N/A'}
                    </div>
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">Project ID</span>
                        {data.projectId || '(pending)'}
                    </div>
                    <div>
                        <span className="font-semibold block text-xs uppercase text-slate-500">
                            {data.projectId && data.projectId !== '(pending)' ? 'Registry' : 'Target Registry'}
                        </span>
                        {data.registry || 'Not Selected'}
                    </div>
                </div >
            </div >

            {/* Section 2: Methodology */}
            < div className="space-y-4" >
                <h3 className="text-lg font-bold border-b pb-1">2. Methodology</h3>
                <p className="leading-relaxed text-justify">
                    The project activity involves the implementation of improved agricultural land management practices, specifically agroforestry and cover cropping, to increase soil organic carbon (SOC) stocks and biomass. The project applies the methodology <strong>VM0042 (Verra)</strong> / <strong>Soil Organic Carbon Framework</strong>.
                    Baseline emissions are calculated based on historical conventional tillage practices.
                </p>
            </div >

            {/* Section 3: Project Boundary & Scale */}
            < div className="space-y-4" >
                <h3 className="text-lg font-bold border-b pb-1">3. Project Scale & Boundary</h3>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold">{data.totalFarmers}</div>
                        <div className="text-xs uppercase text-slate-500">Enrolled Farmers</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{data.totalAcres.toFixed(1)}</div>
                        <div className="text-xs uppercase text-slate-500">Total Hectares</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{data.estimatedCO2.toFixed(1)}</div>
                        <div className="text-xs uppercase text-slate-500">Est. tCO₂ / Year</div>
                    </div>
                </div>
                <p className="text-xs text-slate-500 italic mt-2">
                    * Data aggregated from {data.totalFarmers} individual farmer agreements and satellite-verified plot boundaries.
                </p>
            </div >

            {/* Section 4: Baseline Scenario (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">4. Baseline Scenario</h3>
                <p className="leading-relaxed">
                    The baseline scenario identifies the "business-as-usual" farming practices in the absence of the project intervention.
                    For the project region, this includes:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Conventional Tillage:</strong> Regular intensive soil disturbance.</li>
                    <li><strong>No Cover Crop:</strong> Soil left bare during fallow periods.</li>
                    <li><strong>No Trees:</strong> Absence of agroforestry integration.</li>
                    <li><strong>Business-as-usual Farming:</strong> Continued reliance on chemical inputs without regenerative soil management.</li>
                </ul>
            </div>

            {/* Section 5: Additionality (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">5. Additionality</h3>
                <p className="leading-relaxed">
                    The net carbon increase achieved by this project would not have occurred without the project intervention (Additionality).
                    Farmers lack the financial incentive and technical resources to adopt improved practices (no-till, cover cropping) without the revenue generated from carbon credits.
                </p>
            </div>

            {/* Section 6: Carbon Calculation Method (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">6. Carbon Calculation Method</h3>
                <p className="leading-relaxed">
                    Carbon credits are calculated as the difference between the Project Scenario and the Baseline Scenario:
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded text-center font-mono font-bold text-slate-700">
                    Credits = Project Carbon – Baseline Carbon
                </div>
                <p className="leading-relaxed">
                    This calculation accounts for increased soil organic carbon (SOC) sequestration and avoided emissions from reduced tillage.
                </p>
            </div>

            {/* Section 7: Data Sources (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">7. Data Sources</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>SOC:</strong> Sourced from SoilGrids (ISRIC) and validated via annual soil sampling.</li>
                    <li><strong>NDVI:</strong> Derived from Sentinel-2 satellite imagery for biomass verification.</li>
                    <li><strong>Rainfall:</strong> Sourced from CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data).</li>
                    <li><strong>Farm Boundaries:</strong> Captured via high-precision GPS polygons during on-site enrollment.</li>
                </ul>
            </div>

            {/* Section 8: Data Integrity & Fraud Prevention (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">8. Data Integrity & Fraud Prevention</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Unique Plot IDs:</strong> Each farm plot is assigned a unique identifier to prevent double-counting.</li>
                    <li><strong>Overlap Detection:</strong> Automated spatial analysis detects and rejects overlapping polygons.</li>
                    <li><strong>Baseline Lock:</strong> Baseline data is locked upon registration to prevent manipulation.</li>
                    <li><strong>Third-Party Validation:</strong> Independent Validation & Verification Bodies (VVBs) audit project data.</li>
                </ul>
            </div>

            {/* Section 9: Roles & Responsibilities (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">9. Roles & Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Project Company (TranspoCarbon):</strong> Responsible for farmer enrollment, data collection, and project implementation.</li>
                    <li><strong>VVB:</strong> Responsible for independent validation of the project design and verification of emission reductions.</li>
                    <li><strong>Registry:</strong> Responsible for the final issuance and tracking of carbon credits.</li>
                </ul>
            </div>

            {/* Section 10: Monitoring Plan (Renumbered & Updated) */}
            < div className="space-y-4" >
                <h3 className="text-lg font-bold border-b pb-1">10. Monitoring Plan</h3>
                <p className="leading-relaxed">
                    Monitoring will be conducted via remote sensing (NDVI, Sentinel-2) combined with annual soil sampling. Data is collected via the TranspoCarbon mobile application and stored in a secure database with an audit trail for verification. Verification audits will be conducted by accredited third-party verifiers.
                </p>
            </div >

            {/* Section 11: Plot Details (New) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-1">11. Plot & Baseline Details</h3>
                {data.plots && data.plots.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-300">
                                    <th className="p-2 font-semibold">Plot ID</th>
                                    <th className="p-2 font-semibold text-right">Area (Acres)</th>
                                    <th className="p-2 font-semibold">Baseline Practice</th>
                                    <th className="p-2 font-semibold text-right">Baseline tCO₂</th>
                                    <th className="p-2 font-semibold">Project Practice</th>
                                    <th className="p-2 font-semibold text-right">Target tCO₂</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data.plots.map((plot: any, idx: number) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="p-2 font-mono text-slate-500">{plot.plotId}</td>
                                        <td className="p-2 text-right">{plot.areaAcres?.toFixed(2)}</td>
                                        <td className="p-2 capitalize">{plot.baseline?.practice}</td>
                                        <td className="p-2 text-right">{plot.baseline?.carbonEstimate?.toFixed(2)}</td>
                                        <td className="p-2 capitalize font-medium text-green-700">{plot.project?.practice}</td>
                                        <td className="p-2 text-right font-medium text-green-700">{plot.project?.carbonEstimate?.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 border-t border-slate-300 font-bold">
                                <tr>
                                    <td className="p-2 text-right">Totals:</td>
                                    <td className="p-2 text-right">
                                        {data.plots.reduce((sum: number, p: any) => sum + (p.areaAcres || 0), 0).toFixed(2)}
                                    </td>
                                    <td></td>
                                    <td className="p-2 text-right">
                                        {data.plots.reduce((sum: number, p: any) => sum + (p.baseline?.carbonEstimate || 0), 0).toFixed(2)}
                                    </td>
                                    <td></td>
                                    <td className="p-2 text-right text-green-700">
                                        {data.plots.reduce((sum: number, p: any) => sum + (p.project?.carbonEstimate || 0), 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 text-slate-500 italic text-center">
                        No individual plot data available for display.
                    </div>
                )}
            </div>

            <div className="pt-12 text-center text-slate-400 text-xs">
                Generated by TranspoCarbon Platform • {new Date().toLocaleDateString()}
            </div>
        </div >
    );
}
