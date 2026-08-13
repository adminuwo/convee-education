import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wallet, IndianRupee, Download, Printer, CheckCircle, Building2, Calendar, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function MyPayslipPage() {
  const { user, currentOrg } = useAuth();
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    async function loadPayslips() {
      setLoading(true);
      try {
        const res = await financeApi.getMyPayslips();
        const records = res.payrolls || [];
        setPayrolls(records);
        if (records.length > 0) {
          setSelectedRecord(records[0]);
        }
      } catch (err) {
        console.error('Error fetching payslips:', err);
        toast.error('Failed to load payslip records');
      } finally {
        setLoading(false);
      }
    }
    loadPayslips();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const totalDisbursed = payrolls.reduce((acc, p) => acc + (p.netSalary || 0), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading salary payslips...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
              Faculty Salary & Payslips
            </h1>
            <p className="text-xs text-muted-foreground">
              Official monthly salary vouchers, allowances, tax deductions, and Tally Master payroll receipts.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 self-start sm:self-auto">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Latest Net Salary</div>
              <div className="text-2xl font-extrabold text-teal-400 mt-1">
                ₹{(selectedRecord?.netSalary || payrolls[0]?.netSalary || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {selectedRecord?.month || 'Current Month'} {selectedRecord?.year || 2026}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Disbursed (YTD)</div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                ₹{totalDisbursed.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
                <CheckCircle className="h-3 w-3" /> All Vouchers Cleared
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tally Integration</div>
              <div className="text-sm font-bold text-foreground mt-1">
                🟢 Tally Master Synced
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Direct Expense Ledger #TAL-PAYROLL
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Payslip Detail Card & History List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Payslip History List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider px-1">
            Payslip History ({payrolls.length})
          </h3>
          <div className="space-y-2">
            {payrolls.map((p) => {
              const isSelected = selectedRecord?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedRecord(p)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-500/50 bg-teal-500/10 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground">{p.month} {p.year}</span>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {p.status || 'DISBURSED'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Net Pay: <strong className="text-foreground">₹{p.netSalary?.toLocaleString('en-IN')}</strong></span>
                    <span className="font-mono text-[11px] text-teal-400 font-semibold">View Slip &rarr;</span>
                  </div>
                </div>
              );
            })}
            {payrolls.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No salary payslip records available yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Payslip Document View */}
        <div className="lg:col-span-2">
          {selectedRecord ? (
            <Card className="border-teal-500/20 shadow-lg bg-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> Official Salary Voucher & Statement
                    </div>
                    <CardTitle className="text-xl font-bold font-display">
                      Payslip for {selectedRecord.month} {selectedRecord.year}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Organization: <strong>{currentOrg?.name || 'Demo International Academy'}</strong>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="self-start sm:self-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold px-3 py-1">
                    🟢 DISBURSED & SYNCED
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Employee Info Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-muted/20 text-xs">
                  <div>
                    <div className="text-muted-foreground">Faculty Name</div>
                    <div className="font-bold text-foreground mt-0.5">{selectedRecord.employeeName || user?.fullName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Employee ID</div>
                    <div className="font-mono font-semibold text-foreground mt-0.5">{selectedRecord.employeeId || 'EMP-FAC-006'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Designation</div>
                    <div className="font-semibold text-foreground mt-0.5">{currentOrg?.role || 'FACULTY'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tally Voucher ID</div>
                    <div className="font-mono text-teal-400 font-bold mt-0.5">{selectedRecord.tallyVoucherId || 'TAL-PAYROLL-101'}</div>
                  </div>
                </div>

                {/* Salary Breakdown Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Salary Components Breakdown</h4>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Earnings & Allowances</th>
                          <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                          <th className="px-4 py-2.5 text-left">Deductions</th>
                          <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Basic Pay</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">₹{(selectedRecord.basicPay || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 font-medium text-muted-foreground">Total Deductions (PF / Taxes)</td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-400 font-semibold">₹{(selectedRecord.deductions || 0).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">House Rent & Special Allowances</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">₹{(selectedRecord.allowances || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 font-medium text-muted-foreground">-</td>
                          <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">-</td>
                        </tr>
                        <tr className="bg-muted/20 font-semibold">
                          <td className="px-4 py-2.5 text-left text-teal-400">Total Gross Earnings</td>
                          <td className="px-4 py-2.5 text-right font-mono text-teal-400">₹{((selectedRecord.basicPay || 0) + (selectedRecord.allowances || 0)).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 text-left text-rose-400">Total Deductions</td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-400">₹{(selectedRecord.deductions || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Salary Total Summary Box */}
                <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-teal-400 uppercase tracking-wide">Net Salary Disbursed to Bank</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Credited via HDFC Bank Account on {new Date(selectedRecord.disbursedAt || Date.now()).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div className="text-2xl font-extrabold text-teal-300 font-display">
                    ₹{selectedRecord.netSalary?.toLocaleString('en-IN')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground">
              Select a payslip record to view details.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
