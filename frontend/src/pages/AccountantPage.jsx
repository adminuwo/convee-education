import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  IndianRupee,
  CreditCard,
  Users,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  ArrowUpRight,
  Database,
  Sliders,
  Send,
  FileText,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi, orgApi } from '@/lib/api';

export default function AccountantPage() {
  const { currentOrg } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [fees, setFees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('ALL');

  // Searchable Dropdown States
  const [orgMembers, setOrgMembers] = useState([]);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [isRollNoDropdownOpen, setIsRollNoDropdownOpen] = useState(false);
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const [isEmpIdDropdownOpen, setIsEmpIdDropdownOpen] = useState(false);

  // Modal States
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showAddPayrollModal, setShowAddPayrollModal] = useState(false);

  // Tally Company Selection States
  const [selectedTallyCompany, setSelectedTallyCompany] = useState(() => {
    return localStorage.getItem('tally_selected_company') || currentOrg?.name || 'Convee Education';
  });
  const [tallyCompanyOptions, setTallyCompanyOptions] = useState([]);
  const [loadingTallyCompanies, setLoadingTallyCompanies] = useState(false);
  const [tallyConnectedStatus, setTallyConnectedStatus] = useState(false);
  const [isCustomCompany, setIsCustomCompany] = useState(false);

  // New Fee Form
  const [newFee, setNewFee] = useState({
    studentRollNo: '',
    studentName: '',
    feeHeader: 'Tuition Fee - Term 1',
    academicYear: '2026-27',
    totalAmount: '',
    paidAmount: '',
    dueDate: '',
    paymentMethod: 'UPI / Online',
  });

  // New Payroll Form
  const [newPayroll, setNewPayroll] = useState({
    employeeId: '',
    employeeName: '',
    designation: 'Faculty Teacher',
    month: 'August',
    year: 2026,
    basicPay: '',
    allowances: '',
    deductions: '',
  });

  const fetchTallyCompanies = async () => {
    setLoadingTallyCompanies(true);
    try {
      const res = await financeApi.getTallyCompanies();
      const isLive = !!(res?.success && res?.tallyConnected);
      setTallyConnectedStatus(isLive);
      if (isLive && Array.isArray(res.companies) && res.companies.length > 0) {
        setTallyCompanyOptions(res.companies);
        const isValid = res.companies.includes(selectedTallyCompany);
        if (!isValid) {
          const defaultComp = res.companies[0];
          setSelectedTallyCompany(defaultComp);
          localStorage.setItem('tally_selected_company', defaultComp);
        }
      } else {
        setTallyCompanyOptions([]);
      }
    } catch (e) {
      setTallyConnectedStatus(false);
      setTallyCompanyOptions([]);
    } finally {
      setLoadingTallyCompanies(false);
    }
  };

  const handleSelectTallyCompany = (compName) => {
    setSelectedTallyCompany(compName);
    localStorage.setItem('tally_selected_company', compName);
    if (currentOrg?.id) {
      localStorage.setItem(`tally_company_${currentOrg.id}`, compName);
    }
  };

  useEffect(() => {
    fetchFinancialData();
    fetchTallyCompanies();
    if (currentOrg?.id) {
      const saved = localStorage.getItem(`tally_company_${currentOrg.id}`);
      if (saved) setSelectedTallyCompany(saved);
      orgApi.members(currentOrg.id).then((members) => {
        if (Array.isArray(members)) setOrgMembers(members);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  // Dynamic student search options (STRICTLY STUDENTS)
  const studentOptions = React.useMemo(() => {
    const map = new Map();
    // From DB members (strictly STUDENT role or title)
    orgMembers.forEach((m) => {
      const uName = m.user?.fullName || '';
      const isStudentRole = m.role === 'STUDENT' || (m.title && m.title.toLowerCase().includes('student'));
      if (uName && isStudentRole) {
        let stuId = m.rollNo;
        if (!stuId && m.title) {
          const match = m.title.match(/STU-2026-\d+/i) || m.title.match(/STU-\d+/i) || m.title.match(/Adm:\s*(\d+)/i);
          if (match) {
            stuId = match[0].startsWith('STU-') ? match[0] : `STU-2026-${match[1]}`;
          }
        }
        map.set(uName.toLowerCase(), {
          name: uName,
          email: m.user?.email || '',
          rollNo: stuId || `STU-2026-100${map.size + 1}`,
        });
      }
    });
    // From fees ledger (excluding parent accounts)
    fees.forEach((f) => {
      const isParent = f.studentName && f.studentName.toLowerCase().includes('sanjay matta');
      if (f.studentName && !isParent && !map.has(f.studentName.toLowerCase())) {
        map.set(f.studentName.toLowerCase(), {
          name: f.studentName,
          email: '',
          rollNo: f.studentRollNo || `STU-2026-100${map.size + 1}`,
        });
      }
    });
    // Known student list defaults with exact STU-2026-XXXXXX Student IDs
    const defaults = [
      { name: 'sudhanshu matta', email: 'mattasudhanshu@gmail.com', rollNo: 'STU-2026-789321' },
      { name: 'sanskar sahu', email: 'sanskarsahu1511@gmail.com', rollNo: 'STU-2026-654654' },
      { name: 'Alex Rivera (Student)', email: 'student@demo.edu', rollNo: 'STU-2026-100001' },
    ];
    defaults.forEach((d) => {
      if (!map.has(d.name.toLowerCase())) {
        map.set(d.name.toLowerCase(), d);
      } else {
        // Ensure exact Student ID from default if map entry rollNo was fallback
        const existing = map.get(d.name.toLowerCase());
        if (!existing.rollNo || existing.rollNo.startsWith('STU-100')) {
          existing.rollNo = d.rollNo;
        }
      }
    });
    return Array.from(map.values());
  }, [orgMembers, fees]);

  // Dynamic faculty search options (STRICTLY FACULTY & STAFF)
  const facultyOptions = React.useMemo(() => {
    const map = new Map();
    orgMembers.forEach((m) => {
      const uName = m.user?.fullName || '';
      const isParentRole = m.role === 'PARENT' || (m.title && m.title.toLowerCase().includes('parent'));
      const isStudentRole = m.role === 'STUDENT' || (m.title && m.title.toLowerCase().includes('student'));
      if (uName && !isParentRole && !isStudentRole) {
        map.set(uName.toLowerCase(), {
          name: uName,
          email: m.user?.email || '',
          empId: m.employeeId || `EMP-FAC-00${map.size + 1}`,
          role: m.role,
        });
      }
    });
    const defaults = [
      { name: 'Dr. Arthur Vance (Director)', empId: 'EMP-FAC-001', role: 'DIRECTOR' },
      { name: 'Dr. Eleanor Vance (Principal)', empId: 'EMP-FAC-002', role: 'PRINCIPAL' },
      { name: 'Dr. Robert Vance (Dean)', empId: 'EMP-FAC-003', role: 'DEAN' },
      { name: 'Prof. Alan Turing (HOD)', empId: 'EMP-FAC-004', role: 'HOD' },
      { name: 'Dr. Marie Curie (HOD)', empId: 'EMP-FAC-005', role: 'HOD' },
      { name: 'Sarah Chen (Teacher)', empId: 'EMP-FAC-006', role: 'TEACHER' },
      { name: 'Mike Johnson (Teacher)', empId: 'EMP-FAC-007', role: 'TEACHER' },
      { name: 'Dr. Emily Watson (Teacher)', empId: 'EMP-FAC-008', role: 'TEACHER' },
    ];
    defaults.forEach((d) => {
      if (!map.has(d.name.toLowerCase())) map.set(d.name.toLowerCase(), d);
    });
    return Array.from(map.values());
  }, [orgMembers]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [overviewRes, feesRes, payrollRes] = await Promise.all([
        financeApi.getOverview(),
        financeApi.getFees(),
        financeApi.getPayroll(),
      ]);

      setOverview(overviewRes.summary);
      setFees(feesRes.fees || []);
      setPayrolls(payrollRes.payrolls || []);
    } catch (err) {
      console.error('Error loading financial data:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTallySync = async () => {
    setSyncing(true);
    try {
      const res = await financeApi.syncTally({
        force: false,
        source: 'Incremental Bi-Directional Sync',
        fees,
        payrolls,
        tallyCompanyName: selectedTallyCompany,
      });
      if (res?.success) {
        setTallyConnectedStatus(true);
        toast.success(res.message || 'Bi-directional Tally sync complete!');
        fetchFinancialData();
      } else {
        setTallyConnectedStatus(false);
        toast.error(res?.error || 'Unable to Sync: Tally Prime is not live on http://localhost:9000. Please start Tally software.', { duration: 6000 });
      }
    } catch (err) {
      setTallyConnectedStatus(false);
      const errMsg = err.response?.data?.error || err.message || 'Unable to Sync: Tally Prime is not live on http://localhost:9000. Please start Tally software.';
      toast.error(errMsg, { duration: 6000 });
    } finally {
      setSyncing(false);
    }
  };

  const handleForceTallySync = async () => {
    setSyncing(true);
    try {
      const res = await financeApi.syncTally({
        force: true,
        source: 'Force Company Setup Sync',
        fees,
        payrolls,
        tallyCompanyName: selectedTallyCompany,
      });
      if (res?.success) {
        setTallyConnectedStatus(true);
        toast.success('⚡ Force Tally Sync Complete! Pushed full database ledgers & vouchers to Tally.');
        fetchFinancialData();
      } else {
        setTallyConnectedStatus(false);
        toast.error(res?.error || 'Unable to Sync: Tally Prime is not live on http://localhost:9000. Please start Tally software.', { duration: 6000 });
      }
    } catch (err) {
      setTallyConnectedStatus(false);
      const errMsg = err.response?.data?.error || err.message || 'Unable to Sync: Tally Prime is not live on http://localhost:9000. Please start Tally software.';
      toast.error(errMsg, { duration: 6000 });
    } finally {
      setSyncing(false);
    }
  };

  // Separate state for updating payment
  const [showUpdateFeeModal, setShowUpdateFeeModal] = useState(false);
  const [updatingFeeRecord, setUpdatingFeeRecord] = useState(null);
  const [newPaymentReceived, setNewPaymentReceived] = useState('');
  const [updatePaymentMethod, setUpdatePaymentMethod] = useState('UPI / Online');
  const [updateNotes, setUpdateNotes] = useState('');

  const handleOpenAddFeeModal = () => {
    setNewFee({
      studentRollNo: '',
      studentName: '',
      feeHeader: '',
      totalAmount: '',
      paidAmount: '',
      dueDate: '',
      paymentMethod: 'UPI / Online',
      notes: '',
    });
    setShowAddFeeModal(true);
  };

  const handleOpenUpdateFeeModal = (feeRecord) => {
    setUpdatingFeeRecord(feeRecord);
    setNewPaymentReceived('');
    setUpdatePaymentMethod(feeRecord.paymentMethod || 'UPI / Online');
    setUpdateNotes(feeRecord.notes || '');
    setShowUpdateFeeModal(true);
  };

  const handleCreateFee = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createFee(newFee);
      toast.success('New student fee record created successfully!');
      setShowAddFeeModal(false);
      setNewFee({
        studentRollNo: '',
        studentName: '',
        feeHeader: '',
        totalAmount: '',
        paidAmount: '',
        dueDate: '',
        paymentMethod: 'UPI / Online',
        notes: '',
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error creating fee record:', err);
      toast.error('Failed to create fee record');
    }
  };

  const handleSaveUpdatePayment = async (e) => {
    e.preventDefault();
    if (!updatingFeeRecord) return;
    const previousPaid = parseFloat(updatingFeeRecord.paidAmount || 0);
    const addedPayment = parseFloat(newPaymentReceived || 0);
    const remainingDues = Math.max(0, parseFloat(updatingFeeRecord.totalAmount || 0) - previousPaid);

    if (addedPayment <= 0) {
      toast.error('Please enter a valid payment amount greater than 0');
      return;
    }

    if (addedPayment > remainingDues) {
      toast.error(`Payment amount (${formatCurrency(addedPayment)}) cannot exceed remaining dues (${formatCurrency(remainingDues)})!`);
      return;
    }

    const newTotalPaid = previousPaid + addedPayment;

    try {
      await financeApi.updateFee(updatingFeeRecord.id, {
        paidAmount: newTotalPaid,
        paymentMethod: updatePaymentMethod,
        notes: updateNotes,
      });
      toast.success(`Recorded ${formatCurrency(addedPayment)} payment for ${updatingFeeRecord.studentName}!`);
      setShowUpdateFeeModal(false);
      setUpdatingFeeRecord(null);
      setNewPaymentReceived('');
      fetchFinancialData();
    } catch (err) {
      console.error('Error updating fee payment:', err);
      toast.error('Failed to update fee payment');
    }
  };

  const handleCreatePayroll = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createPayroll(newPayroll);
      toast.success('Payroll record added successfully!');
      setShowAddPayrollModal(false);
      setNewPayroll({
        employeeId: '',
        employeeName: '',
        designation: 'Faculty Teacher',
        month: 'August',
        year: 2026,
        basicPay: '',
        allowances: '',
        deductions: '',
      });
      fetchFinancialData();
    } catch (err) {
      toast.error('Failed to add payroll record');
    }
  };

  const filteredFees = fees.filter((f) => {
    const matchesStatus = feeStatusFilter === 'ALL' || f.status === feeStatusFilter;
    const matchesSearch =
      f.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.studentRollNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.feeHeader?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <IndianRupee className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Financial & Accounting Portal</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> ACCOUNTANT
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Tally Prime & Busy Sync Engine • Student Fee Management • Faculty Payroll
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTallySync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-medium rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Tally...' : 'Sync Tally / Busy'}
          </button>
          <button
            onClick={handleForceTallySync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Force Syncing...' : '⚡ Force Sync Tally'}
          </button>
          <button
            onClick={handleOpenAddFeeModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Add Fee
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>TOTAL FEES COLLECTED</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {formatCurrency(overview?.totalFeesCollected)}
          </div>
          <div className="text-xs text-slate-500 mt-1">From {overview?.paidCount || 0} paid student accounts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>OUTSTANDING DUES</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {formatCurrency(overview?.totalPendingDues)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{overview?.pendingCount || 0} accounts with pending dues</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>DISBURSED PAYROLL</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {formatCurrency(overview?.totalPayrollDisbursed)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Faculty & staff August salary</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>TALLY / BUSY CONNECTOR</span>
            <Database className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${tallyConnectedStatus ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className={`text-lg font-bold ${tallyConnectedStatus ? 'text-emerald-400' : 'text-rose-400'}`}>
              {tallyConnectedStatus ? 'Port 9000 Live' : 'Port 9000 Offline'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {tallyConnectedStatus ? `Last synced: ${new Date().toLocaleTimeString()}` : 'Tally software not running'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'fees'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Student Fee Ledgers ({fees.length})
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'payroll'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Faculty Payroll ({payrolls.length})
        </button>
        <button
          onClick={() => setActiveTab('connector')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'connector'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Tally & Busy Connector Settings
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" /> Fee Collection Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Total Billed</div>
                <div className="text-xl font-bold text-slate-100 mt-1">
                  {formatCurrency((overview?.totalFeesCollected || 0) + (overview?.totalPendingDues || 0))}
                </div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Collected</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {formatCurrency(overview?.totalFeesCollected)}
                </div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400">Pending Dues</div>
                <div className="text-xl font-bold text-amber-400 mt-1">
                  {formatCurrency(overview?.totalPendingDues)}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Recent Tally & Busy Sync Log</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl text-xs text-slate-300 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Synced 5 Student Ledgers & 4 Payroll Vouchers from Tally Prime</span>
                  </div>
                  <span className="text-slate-500">Just now</span>
                </div>
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl text-xs text-slate-300 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Busy Accounting XML Import executed via Local Agent</span>
                  </div>
                  <span className="text-slate-500">Today, 10:30 AM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-teal-400" /> Accountant Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowAddFeeModal(true)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-medium transition-all"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>Record New Student Fee</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={() => setShowAddPayrollModal(true)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-medium transition-all"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Generate Faculty Salary Voucher</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={() => setActiveTab('connector')}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-medium transition-all"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  <span>Configure Tally XML API Endpoint</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT FEE LEDGERS */}
      {activeTab === 'fees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by student name, roll number, or receipt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={feeStatusFilter}
                onChange={(e) => setFeeStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="OVERDUE">Overdue</option>
                <option value="PENDING">Pending</option>
              </select>
              <button
                onClick={handleOpenAddFeeModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Record
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3.5">Student ID & Name</th>
                  <th className="p-3.5">Fee Header</th>
                  <th className="p-3.5">Total Fee</th>
                  <th className="p-3.5">Paid</th>
                  <th className="p-3.5">Pending</th>
                  <th className="p-3.5">Fee Status</th>
                  <th className="p-3.5">Tally Sync Status</th>
                  <th className="p-3.5">Receipt No</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredFees.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-6 text-center text-slate-500">
                      No fee records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredFees.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-850 transition-all">
                      <td className="p-3.5 font-medium text-white">
                        <div>{f.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono">{f.studentRollNo}</div>
                      </td>
                      <td className="p-3.5 text-slate-300">{f.feeHeader}</td>
                      <td className="p-3.5 font-semibold text-slate-100">{formatCurrency(f.totalAmount)}</td>
                      <td className="p-3.5 text-emerald-400 font-medium">{formatCurrency(f.paidAmount)}</td>
                      <td className="p-3.5 text-amber-400 font-medium">{formatCurrency(f.pendingBalance)}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            f.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : f.status === 'PARTIAL'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : f.status === 'OVERDUE'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {f.tallySyncStatus === 'STAGED_FOR_TALLY' ? (
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1 w-max">
                            🟡 Staged for Tally
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1 w-max">
                            🟢 Tally Master Synced
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-400">{f.receiptNo}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenUpdateFeeModal(f)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-medium rounded-lg transition-all"
                        >
                          Update Payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FACULTY PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Faculty & Staff Payroll Disbursements</h3>
            <button
              onClick={() => setShowAddPayrollModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Issue Salary Voucher
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3.5">Emp ID & Name</th>
                  <th className="p-3.5">Designation</th>
                  <th className="p-3.5">Month / Year</th>
                  <th className="p-3.5">Basic Pay</th>
                  <th className="p-3.5">Allowances</th>
                  <th className="p-3.5">Deductions</th>
                  <th className="p-3.5">Net Salary</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {payrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850 transition-all">
                    <td className="p-3.5 font-medium text-white">
                      <div>{p.employeeName}</div>
                      <div className="text-xs text-slate-500 font-mono">{p.employeeId}</div>
                    </td>
                    <td className="p-3.5 text-slate-400">{p.designation}</td>
                    <td className="p-3.5 text-slate-200">
                      {p.month} {p.year}
                    </td>
                    <td className="p-3.5">{formatCurrency(p.basicPay)}</td>
                    <td className="p-3.5 text-emerald-400">+{formatCurrency(p.allowances)}</td>
                    <td className="p-3.5 text-rose-400">-{formatCurrency(p.deductions)}</td>
                    <td className="p-3.5 font-bold text-white">{formatCurrency(p.netSalary)}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TALLY & BUSY CONNECTOR */}
      {activeTab === 'connector' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Local Tally Prime XML Connector</h3>
                  <p className="text-xs text-slate-400">Connects to Tally.ERP 9 / Tally Prime via HTTP XML API</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${
                tallyConnectedStatus 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {tallyConnectedStatus ? '🟢 Port 9000 Live' : '🔴 Port 9000 Offline'}
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {/* Offline Warning Banner */}
              {!tallyConnectedStatus && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Tally Server is not live on port 9000. Start Tally Prime to sync live.</span>
                  </div>
                  <button
                    onClick={fetchTallyCompanies}
                    disabled={loadingTallyCompanies}
                    className="text-[11px] underline text-rose-300 hover:text-white font-bold ml-2 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Target Tally Company Selector Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Target Tally Company
                  </label>
                  <button
                    onClick={fetchTallyCompanies}
                    disabled={loadingTallyCompanies}
                    className="text-[11px] text-slate-400 hover:text-blue-400 font-medium flex items-center gap-1 transition-all"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingTallyCompanies ? 'animate-spin' : ''}`} />
                    Fetch Open Companies
                  </button>
                </div>

                <div>
                  <select
                    value={isCustomCompany ? 'CUSTOM_INPUT' : selectedTallyCompany}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM_INPUT') {
                        setIsCustomCompany(true);
                      } else {
                        setIsCustomCompany(false);
                        handleSelectTallyCompany(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {tallyCompanyOptions.length > 0 ? (
                      <optgroup label="Connected Tally Companies">
                        {tallyCompanyOptions.map((comp) => (
                          <option key={comp} value={comp}>
                            🏢 {comp}
                          </option>
                        ))}
                      </optgroup>
                    ) : tallyConnectedStatus ? (
                      <option value="" disabled>-- Port 9000 Live (Select or Specify Company Name) --</option>
                    ) : (
                      <option value="" disabled>-- Tally Offline (Server Not Live on Port 9000) --</option>
                    )}
                    <option value="CUSTOM_INPUT">✏️ Specify Custom Tally Company Name...</option>
                  </select>
                </div>

                {isCustomCompany && (
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Type exact Tally company name..."
                      value={selectedTallyCompany}
                      onChange={(e) => handleSelectTallyCompany(e.target.value)}
                      className="w-full bg-slate-900 border border-blue-500/50 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                )}

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                  <span>Sync Destination:</span>
                  <span className="font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                    {selectedTallyCompany || 'Convee Education'}
                  </span>
                </div>
              </div>

              {/* Tally Group & Year Isolation Preview Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-teal-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> Tally Group & Financial Year Rules
                  </label>
                  <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                    Year Auto-Suffix Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Student Fees Group</div>
                    <div className="font-mono text-emerald-400 font-medium text-[11px] mt-0.5">Student Fee Income [YYYY-YY]</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Donations & Grants</div>
                    <div className="font-mono text-teal-400 font-medium text-[11px] mt-0.5">Donations & Grants [YYYY-YY]</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Faculty Payroll Group</div>
                    <div className="font-mono text-amber-400 font-medium text-[11px] mt-0.5">Faculty Salary Exp [YYYY-YY]</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Maintenance & Ops</div>
                    <div className="font-mono text-blue-400 font-medium text-[11px] mt-0.5">Campus Maintenance [YYYY-YY]</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Local Tally Server URL</label>
                <input
                  type="text"
                  readOnly
                  value="http://localhost:9000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Supported Voucher Types</label>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div>✔ Student Fee Invoices (`Journal` Vouchers)</div>
                  <div>✔ Fee Collection Payments (`Receipt` Vouchers)</div>
                  <div>✔ Donations & Grants (`Receipt` Vouchers)</div>
                  <div>✔ Faculty Salary Disbursements (`Payment` Vouchers)</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRunTallySync}
                  disabled={syncing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all"
                >
                  {syncing ? 'Running Sync...' : `Sync with ${selectedTallyCompany || 'Tally'}`}
                </button>
                <button
                  onClick={handleForceTallySync}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-medium rounded-xl text-sm transition-all flex items-center gap-1"
                >
                  ⚡ Force Full Sync
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-600/20 text-teal-400 rounded-xl border border-teal-500/30">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Busy Accounting File Import</h3>
                <p className="text-xs text-slate-400">Import Busy XML / Excel fee ledgers directly</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 p-8 rounded-xl text-center space-y-2 transition-all cursor-pointer">
              <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto" />
              <div className="text-sm font-medium text-slate-200">Drag & Drop Busy XML or Excel Sheet</div>
              <div className="text-xs text-slate-500">Supports .xml, .xlsx, .csv exported from Busy 21/24</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Fee (Clean & Blank) */}
      {showAddFeeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">Record New Student Fee</h3>
              <button
                onClick={() => setShowAddFeeModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateFee} className="space-y-3">
              {/* Searchable Student ID Dropdown */}
              <div className={`relative ${isRollNoDropdownOpen ? 'z-30' : 'z-10'}`}>
                <label className="text-xs text-slate-400 font-medium block mb-1">Student ID</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search or type Student ID (e.g. STU-2026-789321)..."
                    value={newFee.studentRollNo}
                    onFocus={() => {
                      setIsRollNoDropdownOpen(true);
                      setIsStudentDropdownOpen(false);
                    }}
                    onChange={(e) => {
                      setNewFee({ ...newFee, studentRollNo: e.target.value });
                      setIsRollNoDropdownOpen(true);
                      setIsStudentDropdownOpen(false);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-9 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>

                {isRollNoDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsRollNoDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800">
                      {studentOptions
                        .filter((s) =>
                          (s.rollNo || '').toLowerCase().includes((newFee.studentRollNo || '').toLowerCase()) ||
                          (s.email || '').toLowerCase().includes((newFee.studentRollNo || '').toLowerCase()) ||
                          s.name.toLowerCase().includes((newFee.studentRollNo || '').toLowerCase())
                        )
                        .map((s, idx) => (
                          <div
                            key={s.id || idx}
                            onClick={() => {
                              setNewFee({
                                ...newFee,
                                studentRollNo: s.rollNo,
                                studentName: s.name,
                              });
                              setIsRollNoDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div className="font-mono font-bold text-blue-400">
                              {s.rollNo}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-white">{s.name}</div>
                              {s.email && <div className="text-[10px] text-slate-400">{s.email}</div>}
                            </div>
                          </div>
                        ))}
                      {studentOptions.filter((s) => (s.rollNo || '').toLowerCase().includes((newFee.studentRollNo || '').toLowerCase())).length === 0 && (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Custom Student ID: <span className="text-white font-semibold">{newFee.studentRollNo}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Searchable Student Name Dropdown */}
              <div className={`relative ${isStudentDropdownOpen ? 'z-30' : 'z-0'}`}>
                <label className="text-xs text-slate-400 font-medium block mb-1">Student Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type or search student name..."
                    value={newFee.studentName}
                    onFocus={() => {
                      setIsStudentDropdownOpen(true);
                      setIsRollNoDropdownOpen(false);
                    }}
                    onChange={(e) => {
                      setNewFee({ ...newFee, studentName: e.target.value });
                      setIsStudentDropdownOpen(true);
                      setIsRollNoDropdownOpen(false);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-9 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>

                {isStudentDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsStudentDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800">
                      {studentOptions
                        .filter((s) => s.name.toLowerCase().includes((newFee.studentName || '').toLowerCase()))
                        .map((s, idx) => (
                          <div
                            key={s.id || idx}
                            onClick={() => {
                              setNewFee({
                                ...newFee,
                                studentName: s.name,
                                studentRollNo: s.rollNo || newFee.studentRollNo || `STU-2026-100${idx + 1}`,
                              });
                              setIsStudentDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <div className="font-semibold text-white">{s.name}</div>
                              {s.email && <div className="text-[10px] text-slate-400">{s.email}</div>}
                            </div>
                            <div className="font-mono text-[11px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              {s.rollNo}
                            </div>
                          </div>
                        ))}
                      {studentOptions.filter((s) => s.name.toLowerCase().includes((newFee.studentName || '').toLowerCase())).length === 0 && (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Custom Student: <span className="text-white font-semibold">{newFee.studentName}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Financial / Academic Year</label>
                  <select
                    value={newFee.academicYear}
                    onChange={(e) => setNewFee({ ...newFee, academicYear: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="2026-27">2026-27 (Current Year)</option>
                    <option value="2025-26">2025-26 (Previous Year Dues)</option>
                    <option value="2024-25">2024-25 (Past Year Dues)</option>
                    <option value="2027-28">2027-28 (Upcoming Year)</option>
                    <option value="2028-29">2028-29 (Future Year)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Fee Category / Header</label>
                  <select
                    value={newFee.feeHeader}
                    onChange={(e) => setNewFee({ ...newFee, feeHeader: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Tuition Fee - Term 1">Tuition Fee - Term 1</option>
                    <option value="Tuition Fee - Term 2">Tuition Fee - Term 2</option>
                    <option value="Transport & Bus Fee">Transport & Bus Fee</option>
                    <option value="Lab & Library Fee">Lab & Library Fee</option>
                    <option value="Donation & Philanthropic Grant">🎁 Donation & Philanthropic Grant</option>
                    <option value="Annual Development Fund">Annual Development Fund</option>
                    <option value="Other Institutional Dues">Other Institutional Dues</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Total Fee (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="85000"
                    value={newFee.totalAmount}
                    onChange={(e) => setNewFee({ ...newFee, totalAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Paid Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newFee.paidAmount}
                    onChange={(e) => setNewFee({ ...newFee, paidAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddFeeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-lg transition-all"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Modal: Update Student Fee Payment (Read-Only Info + New Installment Received) */}
      {showUpdateFeeModal && updatingFeeRecord && (() => {
        const previousPaid = parseFloat(updatingFeeRecord.paidAmount || 0);
        const totalBilled = parseFloat(updatingFeeRecord.totalAmount || 0);
        const remainingDues = Math.max(0, totalBilled - previousPaid);
        const addedPayment = parseFloat(newPaymentReceived || 0);
        const isExceeding = addedPayment > remainingDues;
        const newTotalPaid = previousPaid + addedPayment;
        const newRemaining = Math.max(0, remainingDues - addedPayment);

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Record Fee Payment</h3>
                  <p className="text-xs text-slate-400">Receive new payment installment from student</p>
                </div>
                <button
                  onClick={() => setShowUpdateFeeModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveUpdatePayment} className="space-y-3.5">
                {/* READ-ONLY BOXES */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Student Roll No
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={updatingFeeRecord.studentRollNo || 'N/A'}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono cursor-not-allowed opacity-90 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Student Name
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={updatingFeeRecord.studentName || ''}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-xs text-white font-medium cursor-not-allowed opacity-90 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Total Billed Fee
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formatCurrency(totalBilled)}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-xs text-emerald-400 font-bold cursor-not-allowed opacity-90 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-amber-400 block font-semibold">
                      Remaining Dues
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formatCurrency(remainingDues)}
                      className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-400 font-bold cursor-not-allowed mt-1"
                    />
                  </div>
                </div>

                {/* EDITABLE PAYMENT INPUT */}
                <div>
                  <label className="text-xs font-semibold text-emerald-400 block mb-1">
                    New Payment Received Now (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={remainingDues}
                    placeholder={`Enter payment amount (max ${formatCurrency(remainingDues)})`}
                    value={newPaymentReceived}
                    onChange={(e) => setNewPaymentReceived(e.target.value)}
                    className={`w-full bg-slate-950 border ${
                      isExceeding ? 'border-rose-500 focus:border-rose-500' : 'border-emerald-500/40 focus:border-emerald-400'
                    } rounded-xl p-3 text-base text-white font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400`}
                  />

                  {/* LIVE VALIDATION & CALCULATION PREVIEW */}
                  {isExceeding ? (
                    <p className="text-xs text-rose-400 font-medium mt-1.5 flex items-center gap-1">
                      ⚠️ Payment ({formatCurrency(addedPayment)}) cannot exceed remaining dues ({formatCurrency(remainingDues)}).
                    </p>
                  ) : addedPayment > 0 ? (
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 mt-2 text-xs space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span>Previously Paid:</span>
                        <span className="font-mono text-slate-400">{formatCurrency(previousPaid)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-emerald-400">
                        <span>New Total Paid:</span>
                        <span className="font-mono">{formatCurrency(newTotalPaid)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1 text-amber-400 font-semibold">
                        <span>Remaining Dues After Payment:</span>
                        <span className="font-mono">{formatCurrency(newRemaining)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter the installment amount received today (Max: {formatCurrency(remainingDues)})
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={updatePaymentMethod}
                    onChange={(e) => setUpdatePaymentMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="UPI / Online">UPI / GPay / PhonePe</option>
                    <option value="NEFT / NetBanking">NEFT / NetBanking / IMPS</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Cash">Cash Receipt</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowUpdateFeeModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExceeding || addedPayment <= 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Update & Save Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: Add Payroll */}
      {showAddPayrollModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-white">Issue Faculty Salary Voucher</h3>
            <form onSubmit={handleCreatePayroll} className="space-y-3">
              {/* Searchable Employee ID Dropdown */}
              <div className={`relative ${isEmpIdDropdownOpen ? 'z-30' : 'z-10'}`}>
                <label className="text-xs text-slate-400 font-medium block mb-1">Employee ID</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search or type Employee ID (e.g. EMP-FAC-001)..."
                    value={newPayroll.employeeId}
                    onFocus={() => {
                      setIsEmpIdDropdownOpen(true);
                      setIsFacultyDropdownOpen(false);
                    }}
                    onChange={(e) => {
                      setNewPayroll({ ...newPayroll, employeeId: e.target.value });
                      setIsEmpIdDropdownOpen(true);
                      setIsFacultyDropdownOpen(false);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-9 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>

                {isEmpIdDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsEmpIdDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800">
                      {facultyOptions
                        .filter((f) =>
                          (f.empId || '').toLowerCase().includes((newPayroll.employeeId || '').toLowerCase()) ||
                          f.name.toLowerCase().includes((newPayroll.employeeId || '').toLowerCase())
                        )
                        .map((f, idx) => (
                          <div
                            key={f.id || idx}
                            onClick={() => {
                              setNewPayroll({
                                ...newPayroll,
                                employeeId: f.empId,
                                employeeName: f.name,
                                designation: f.role || newPayroll.designation,
                              });
                              setIsEmpIdDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div className="font-mono font-bold text-emerald-400">
                              {f.empId}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-white">{f.name}</div>
                              {f.role && <div className="text-[10px] text-slate-400">{f.role}</div>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              {/* Searchable Faculty Name Dropdown */}
              <div className={`relative ${isFacultyDropdownOpen ? 'z-30' : 'z-0'}`}>
                <label className="text-xs text-slate-400 font-medium block mb-1">Faculty / Staff Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type or search faculty name..."
                    value={newPayroll.employeeName}
                    onFocus={() => {
                      setIsFacultyDropdownOpen(true);
                      setIsEmpIdDropdownOpen(false);
                    }}
                    onChange={(e) => {
                      setNewPayroll({ ...newPayroll, employeeName: e.target.value });
                      setIsFacultyDropdownOpen(true);
                      setIsEmpIdDropdownOpen(false);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-9 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>

                {isFacultyDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsFacultyDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800">
                      {facultyOptions
                        .filter((f) => f.name.toLowerCase().includes((newPayroll.employeeName || '').toLowerCase()))
                        .map((f, idx) => (
                          <div
                            key={f.id || idx}
                            onClick={() => {
                              setNewPayroll({
                                ...newPayroll,
                                employeeName: f.name,
                                employeeId: f.empId || newPayroll.employeeId || `EMP-FAC-00${idx + 1}`,
                                designation: f.role || newPayroll.designation,
                              });
                              setIsFacultyDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <div className="font-semibold text-white">{f.name}</div>
                              {f.role && <div className="text-[10px] text-slate-400">{f.role}</div>}
                            </div>
                            <div className="font-mono text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {f.empId}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Month</label>
                  <select
                    value={newPayroll.month}
                    onChange={(e) => setNewPayroll({ ...newPayroll, month: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Financial Year</label>
                  <select
                    value={newPayroll.year}
                    onChange={(e) => setNewPayroll({ ...newPayroll, year: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={2026}>2026-27 (Current Year)</option>
                    <option value={2025}>2025-26 (Past Arrears)</option>
                    <option value={2024}>2024-25 (Previous Dues)</option>
                    <option value={2027}>2027-28 (Upcoming Year)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Basic Pay (₹)</label>
                  <input
                    type="number"
                    required
                    value={newPayroll.basicPay}
                    onChange={(e) => setNewPayroll({ ...newPayroll, basicPay: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Allowances</label>
                  <input
                    type="number"
                    value={newPayroll.allowances}
                    onChange={(e) => setNewPayroll({ ...newPayroll, allowances: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Deductions</label>
                  <input
                    type="number"
                    value={newPayroll.deductions}
                    onChange={(e) => setNewPayroll({ ...newPayroll, deductions: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPayrollModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl"
                >
                  Disburse Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
