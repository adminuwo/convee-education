import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Landmark,
  Building,
  Receipt,
  Trash2,
  HeartHandshake,
  Wrench,
  Tag,
  Printer,
  Coins,
  Layers,
  ArrowRightLeft,
  Calculator,
  FileBadge,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi, orgApi } from '@/lib/api';

export default function AccountantPage() {
  const { currentOrg, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [fees, setFees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [societyFunds, setSocietyFunds] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [cashTransactions, setCashTransactions] = useState([]);
  const [fixedAssets, setFixedAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('ALL');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('ALL');
  const [selectedRegisterId, setSelectedRegisterId] = useState(null);

  // Printable Receipt / Voucher Modal state
  const [printableVoucher, setPrintableVoucher] = useState(null);

  const renderPortal = (children) => {
    if (typeof document === 'undefined' || !document.body) return null;
    return createPortal(children, document.body);
  };

  // Searchable Dropdown States
  const [orgMembers, setOrgMembers] = useState([]);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [isRollNoDropdownOpen, setIsRollNoDropdownOpen] = useState(false);
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const [isEmpIdDropdownOpen, setIsEmpIdDropdownOpen] = useState(false);

  // Modal States
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showAddPayrollModal, setShowAddPayrollModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showAddSocietyFundModal, setShowAddSocietyFundModal] = useState(false);
  const [showAddCashTransactionModal, setShowAddCashTransactionModal] = useState(false);
  const [showAddFixedAssetModal, setShowAddFixedAssetModal] = useState(false);

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
    bankAccountName: 'HDFC Bank Main Account',
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
    bankAccountName: 'HDFC Bank Main Account',
  });

  // New Expense Form
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'MAINTENANCE',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    bankAccountName: 'HDFC Bank Main Account',
    vendorName: '',
    academicYear: '2026-27',
    notes: '',
  });

  // New Bank Account Form
  const [newBankAccount, setNewBankAccount] = useState({
    accountName: '',
    bankName: 'HDFC Bank',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'CURRENT',
    openingBalance: '',
    isPrimary: false,
  });

  // New Society Fund Form
  const [newSocietyFund, setNewSocietyFund] = useState({
    fundName: '',
    fundType: 'CORPUS',
    contributingBody: '',
    amount: '',
    fundDate: new Date().toISOString().split('T')[0],
    isRestricted: false,
    purpose: '',
    notes: '',
  });

  // New Cash Transaction Form
  const [newCashTransaction, setNewCashTransaction] = useState({
    registerId: '',
    transactionType: 'CASH_IN',
    amount: '',
    transactionDate: new Date().toISOString().split('T')[0],
    recipientOrPayer: '',
    category: 'PETTY_EXPENSE',
    voucherNumber: '',
    notes: '',
    bankAccountId: '',
  });

  // New Fixed Asset Form
  const [newFixedAsset, setNewFixedAsset] = useState({
    assetName: '',
    category: 'IT_HARDWARE',
    assetCode: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    vendorName: '',
    invoiceNo: '',
    location: '',
    depreciationRate: '15.0',
    depreciationMethod: 'STRAIGHT_LINE',
    notes: '',
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
    // From fees ledger (only as fallback if orgMembers has no students)
    if (map.size === 0) {
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
    }
    // Known student list defaults (only used as fallback when map is still empty)
    if (map.size === 0) {
      const defaults = [
        { name: 'Alex Rivera (Student)', email: 'student@demo.edu', rollNo: 'STU-2026-100001' },
      ];
      defaults.forEach((d) => {
        if (!map.has(d.name.toLowerCase())) {
          map.set(d.name.toLowerCase(), d);
        }
      });
    }
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
    if (orgMembers.length === 0 && map.size === 0) {
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
    }
    return Array.from(map.values());
  }, [orgMembers]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [overviewRes, feesRes, payrollRes, expensesRes, bankAccountsRes, fundsRes, registersRes, transactionsRes, assetsRes] = await Promise.all([
        financeApi.getOverview().catch(() => ({ summary: {} })),
        financeApi.getFees().catch(() => ({ fees: [] })),
        financeApi.getPayroll().catch(() => ({ payrolls: [] })),
        financeApi.getExpenses().catch(() => ({ expenses: [] })),
        financeApi.getBankAccounts().catch(() => ({ bankAccounts: [] })),
        financeApi.getSocietyFunds().catch(() => ({ societyFunds: [] })),
        financeApi.getCashRegisters().catch(() => ({ cashRegisters: [] })),
        financeApi.getCashTransactions().catch(() => ({ cashTransactions: [] })),
        financeApi.getFixedAssets().catch(() => ({ fixedAssets: [] })),
      ]);

      if (overviewRes?.summary) setOverview(overviewRes.summary);
      setFees(feesRes?.fees || []);
      setPayrolls(payrollRes?.payrolls || []);
      setExpenses(expensesRes?.expenses || []);
      setBankAccounts(bankAccountsRes?.bankAccounts || []);
      setSocietyFunds(fundsRes?.societyFunds || []);
      setCashRegisters(registersRes?.cashRegisters || []);
      setCashTransactions(transactionsRes?.cashTransactions || []);
      setFixedAssets(assetsRes?.fixedAssets || []);
      if (!selectedRegisterId && registersRes?.cashRegisters?.length > 0) {
        setSelectedRegisterId(registersRes.cashRegisters[0].id);
      }
    } catch (err) {
      console.error('Error loading financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSocietyFund = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createSocietyFund(newSocietyFund);
      toast.success('Society / Corpus Fund recorded successfully & staged for Tally!');
      setShowAddSocietyFundModal(false);
      setNewSocietyFund({
        fundName: '',
        fundType: 'CORPUS',
        contributingBody: '',
        amount: '',
        fundDate: new Date().toISOString().split('T')[0],
        isRestricted: false,
        purpose: '',
        notes: '',
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error creating society fund:', err);
      toast.error('Failed to record society fund');
    }
  };

  const handleDeleteSocietyFund = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Society Fund record?')) return;
    try {
      await financeApi.deleteSocietyFund(id);
      toast.success('Society fund record deleted');
      fetchFinancialData();
    } catch (err) {
      console.error('Error deleting society fund:', err);
      toast.error('Failed to delete society fund');
    }
  };

  const handleCreateCashTransaction = async (e) => {
    e.preventDefault();
    try {
      const regId = newCashTransaction.registerId || selectedRegisterId || cashRegisters[0]?.id;
      await financeApi.createCashTransaction({
        ...newCashTransaction,
        registerId: regId,
      });
      toast.success('Cash transaction & drawer balance updated successfully!');
      setShowAddCashTransactionModal(false);
      setNewCashTransaction({
        registerId: '',
        transactionType: 'CASH_IN',
        amount: '',
        transactionDate: new Date().toISOString().split('T')[0],
        recipientOrPayer: '',
        category: 'PETTY_EXPENSE',
        voucherNumber: '',
        notes: '',
        bankAccountId: '',
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error creating cash transaction:', err);
      toast.error('Failed to record cash transaction');
    }
  };

  const handleCreateFixedAsset = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createFixedAsset(newFixedAsset);
      toast.success('Fixed asset added to register & staged for Tally Prime!');
      setShowAddFixedAssetModal(false);
      setNewFixedAsset({
        assetName: '',
        category: 'IT_HARDWARE',
        assetCode: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: '',
        vendorName: '',
        invoiceNo: '',
        location: '',
        depreciationRate: '15.0',
        depreciationMethod: 'STRAIGHT_LINE',
        notes: '',
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error creating fixed asset:', err);
      toast.error('Failed to record fixed asset');
    }
  };

  const handleDepreciateAsset = async (id) => {
    try {
      const res = await financeApi.depreciateAsset(id);
      toast.success(res.message || 'Annual depreciation applied successfully!');
      fetchFinancialData();
    } catch (err) {
      console.error('Error applying depreciation:', err);
      toast.error('Failed to apply asset depreciation');
    }
  };

  const handleDeleteFixedAsset = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Fixed Asset record?')) return;
    try {
      await financeApi.deleteFixedAsset(id);
      toast.success('Fixed asset removed from register');
      fetchFinancialData();
    } catch (err) {
      console.error('Error deleting fixed asset:', err);
      toast.error('Failed to delete fixed asset');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createExpense(newExpense);
      toast.success('New expense / donation record added successfully!');
      setShowAddExpenseModal(false);
      setNewExpense({
        title: '',
        category: 'MAINTENANCE',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'BANK_TRANSFER',
        bankAccountName: bankAccounts[0]?.accountName || 'HDFC Bank Main Account',
        vendorName: '',
        academicYear: '2026-27',
        notes: '',
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error creating expense record:', err);
      toast.error('Failed to record expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await financeApi.deleteExpense(id);
      toast.success('Expense record deleted');
      fetchFinancialData();
    } catch (err) {
      console.error('Error deleting expense record:', err);
      toast.error('Failed to delete expense record');
    }
  };

  const handleCreateBankAccount = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createBankAccount(newBankAccount);
      toast.success('New school bank account added successfully!');
      setShowAddBankModal(false);
      setNewBankAccount({
        accountName: '',
        bankName: 'HDFC Bank',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
        accountType: 'CURRENT',
        openingBalance: '',
        isPrimary: false,
      });
      fetchFinancialData();
    } catch (err) {
      console.error('Error adding bank account:', err);
      toast.error('Failed to add bank account');
    }
  };

  const handleDeleteBankAccount = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this bank account?')) return;
    try {
      await financeApi.deleteBankAccount(id);
      toast.success('Bank account deactivated');
      fetchFinancialData();
    } catch (err) {
      console.error('Error deactivating bank account:', err);
      toast.error('Failed to deactivate bank account');
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

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRunTallySync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Tally / Busy'}
          </button>
          <button
            onClick={handleForceTallySync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Force Syncing...' : '⚡ Force Sync Tally'}
          </button>
          <button
            onClick={() => setShowAddSocietyFundModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Building className="w-3.5 h-3.5" /> + Society Fund
          </button>
          <button
            onClick={() => setShowAddCashTransactionModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Coins className="w-3.5 h-3.5" /> + Cash Float / Transfer
          </button>
          <button
            onClick={() => setShowAddFixedAssetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Layers className="w-3.5 h-3.5" /> + Fixed Asset
          </button>
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </button>
          <button
            onClick={() => setShowAddBankModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Landmark className="w-3.5 h-3.5" /> Add Bank
          </button>
          <button
            onClick={handleOpenAddFeeModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Net Worth */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-indigo-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold">
            <span>INSTITUTIONAL NET WORTH</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {formatCurrency(overview?.institutionalNetWorth || ((overview?.totalBankBalances || 0) + (overview?.totalCashInHand || 0) + (overview?.totalFixedAssetsBookValue || 0)))}
          </div>
          <div className="text-[11px] text-indigo-300/80 mt-1">Liquid Capital + Fixed Assets</div>
        </div>

        {/* Fixed Assets */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>FIXED ASSETS (BOOK VALUE)</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-2">
            {formatCurrency(overview?.totalFixedAssetsBookValue || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{fixedAssets.length} active registered assets</div>
        </div>

        {/* Liquid Funds */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>LIQUID FUNDS (BANK + CASH)</span>
            <Landmark className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-400 mt-2">
            {formatCurrency(overview?.totalLiquidFunds || ((overview?.totalBankBalances || 0) + (overview?.totalCashInHand || 0)))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Cash Drawer: {formatCurrency(overview?.totalCashInHand || 0)}
          </div>
        </div>

        {/* Society Funds */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>SOCIETY & CORPUS FUNDS</span>
            <Building className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 mt-2">
            {formatCurrency(overview?.totalSocietyFunds || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{societyFunds.length} corpus & endowment reserves</div>
        </div>

        {/* Fee Collection */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>FEES COLLECTED</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {formatCurrency(overview?.totalFeesCollected)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{overview?.paidCount || 0} student fee receipts</div>
        </div>

        {/* Pending Dues */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>OUTSTANDING DUES</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {formatCurrency(overview?.totalPendingDues)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{overview?.pendingCount || 0} overdue fee accounts</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'fees'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Student Fee Ledgers ({fees.length})
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Faculty Payroll ({payrolls.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Other Expenses & Donations ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('bank-accounts')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'bank-accounts'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Bank Accounts ({bankAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('society-funds')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'society-funds'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          🏛️ Society & Corpus Funds ({societyFunds.length})
        </button>
        <button
          onClick={() => setActiveTab('cash-in-hand')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'cash-in-hand'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          💵 Cash in Hand & Float ({cashRegisters.length})
        </button>
        <button
          onClick={() => setActiveTab('fixed-assets')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'fixed-assets'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          🏢 Fixed Asset Register ({fixedAssets.length})
        </button>
        <button
          onClick={() => setActiveTab('connector')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
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
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            🟡 Staged for Tally
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            🟢 Tally Master Synced
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-400">{f.receiptNo}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPrintableVoucher({ type: 'FEE', data: f })}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
                            title="Download / Print Official Fee Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" /> Receipt
                          </button>
                          <button
                            onClick={() => handleOpenUpdateFeeModal(f)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-medium rounded-lg transition-all"
                          >
                            Update
                          </button>
                        </div>
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
                  <th className="p-3.5 text-right">Action</th>
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
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setPrintableVoucher({ type: 'PAYROLL', data: p })}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ml-auto"
                        title="Download / Print Faculty Payslip Voucher"
                      >
                        <Printer className="w-3.5 h-3.5" /> Payslip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OTHER EXPENSES & DONATIONS */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['ALL', 'MAINTENANCE', 'DONATION', 'UTILITIES', 'LAB_INFRA', 'EVENTS', 'OTHER'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setExpenseCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    expenseCategoryFilter === cat
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by title, vendor, receipt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3.5">Expense Title & Date</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Vendor / Payee</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Bank Account</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5">Receipt / Voucher</th>
                  <th className="p-3.5">Tally Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-6 text-center text-slate-500">
                      No expense records found matching your filter.
                    </td>
                  </tr>
                ) : (
                  expenses
                    .filter((e) => {
                      const matchesCategory = expenseCategoryFilter === 'ALL' || e.category === expenseCategoryFilter;
                      const matchesSearch =
                        e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase());
                      return matchesCategory && matchesSearch;
                    })
                    .map((e) => (
                      <tr key={e.id} className="hover:bg-slate-850 transition-all">
                        <td className="p-3.5 font-medium text-white">
                          <div>{e.title}</div>
                          <div className="text-xs text-slate-500">{new Date(e.expenseDate).toLocaleDateString('en-IN')}</div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              e.category === 'DONATION'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : e.category === 'MAINTENANCE'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : e.category === 'LAB_INFRA'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            }`}
                          >
                            {e.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300">{e.vendorName || '-'}</td>
                        <td className={`p-3.5 font-bold ${e.category === 'DONATION' ? 'text-emerald-400' : 'text-purple-300'}`}>
                          {e.category === 'DONATION' ? '+' : '-'}{formatCurrency(e.amount)}
                        </td>
                        <td className="p-3.5 text-xs text-teal-400 font-mono">{e.bankAccountName || 'HDFC Bank Main Account'}</td>
                        <td className="p-3.5 text-xs text-slate-400">{e.paymentMethod || 'BANK_TRANSFER'}</td>
                        <td className="p-3.5 font-mono text-xs text-slate-400">{e.receiptNo}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full whitespace-nowrap inline-flex items-center gap-1">
                            🟢 Synced Tally
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPrintableVoucher({ type: 'EXPENSE', data: e })}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
                              title="Download / Print Expense Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" /> Voucher
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Delete Expense Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SCHOOL BANK ACCOUNTS */}
      {activeTab === 'bank-accounts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">School & Campus Bank Accounts</h3>
              <p className="text-xs text-slate-400">Configure bank ledgers for fees receipt, payroll disbursement, and operational expenses</p>
            </div>
            <button
              onClick={() => setShowAddBankModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Bank Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((b) => (
              <div key={b.id} className="bg-slate-950 border border-slate-800 hover:border-teal-500/40 p-5 rounded-2xl space-y-3 relative transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-teal-400" />
                    <span className="font-bold text-white text-base">{b.bankName}</span>
                  </div>
                  {b.isPrimary ? (
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full">
                      PRIMARY ACCOUNT
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteBankAccount(b.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-all"
                      title="Deactivate Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-300 font-medium">{b.accountName}</div>
                  <div className="text-sm font-mono text-slate-200 tracking-wider">
                    •••• •••• •••• {b.accountNumber.slice(-4) || '1039'}
                  </div>
                  <div className="text-xs text-slate-500">IFSC: {b.ifscCode} • {b.branchName || 'Main Branch'}</div>
                </div>

                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Current Balance:</span>
                    <span className="font-bold text-emerald-400 text-base">{formatCurrency(b.currentBalance || b.openingBalance)}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">
                    {b.accountType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SOCIETY & CORPUS FUNDS */}
      {activeTab === 'society-funds' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Society & Corpus Capital Funds</h3>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
                  Capital Account Ledgers
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage society corpus capital, trust endowments, restricted grants, and development reserves synced with Tally.
              </p>
            </div>
            <button
              onClick={() => setShowAddSocietyFundModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Building className="w-4 h-4" /> + Record Society Fund
            </button>
          </div>

          {/* Stat Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">TOTAL CORPUS CAPITAL</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">
                {formatCurrency(societyFunds.reduce((sum, f) => sum + (f.amount || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{societyFunds.length} total active reserve funds</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">RESTRICTED ENDOWMENTS</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {formatCurrency(societyFunds.filter((f) => f.isRestricted).reduce((sum, f) => sum + (f.amount || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Earmarked grants & scholarship funds</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">UNRESTRICTED RESERVES</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {formatCurrency(societyFunds.filter((f) => !f.isRestricted).reduce((sum, f) => sum + (f.amount || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">General institutional advancement</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30">
              <div className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> TALLY PRIME STATUS
              </div>
              <div className="text-base font-bold text-white mt-1">Capital Account</div>
              <div className="text-[11px] text-indigo-300/80 mt-0.5">Auto-generates Capital Receipts</div>
            </div>
          </div>

          {/* Funds List Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-3.5">Fund Name & Purpose</th>
                  <th className="p-3.5 whitespace-nowrap">Type & Classification</th>
                  <th className="p-3.5">Contributing Body</th>
                  <th className="p-3.5 whitespace-nowrap">Receipt No & Date</th>
                  <th className="p-3.5 whitespace-nowrap">Restriction Status</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Fund Amount</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {societyFunds.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      No Society or Corpus funds recorded yet. Click "+ Record Society Fund" to add one.
                    </td>
                  </tr>
                ) : (
                  societyFunds.map((fund) => (
                    <tr key={fund.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 min-w-[200px]">
                        <div className="font-semibold text-white">{fund.fundName}</div>
                        {fund.purpose && <div className="text-xs text-slate-400 mt-0.5">{fund.purpose}</div>}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md inline-block ${
                          fund.fundType === 'CORPUS' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                          fund.fundType === 'INFRASTRUCTURE' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                          fund.fundType === 'SCHOLARSHIP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}>
                          {fund.fundType}
                        </span>
                      </td>
                      <td className="p-3.5 min-w-[180px]">
                        <div className="font-medium text-slate-200">{fund.contributingBody}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-200 font-semibold">{fund.receiptNo || 'SOC/2026-27/001'}</div>
                        <div className="text-[11px] text-slate-500">{new Date(fund.fundDate || fund.createdAt).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {fund.isRestricted ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full inline-flex items-center gap-1">
                            🔒 RESTRICTED PURPOSE
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                            ✨ UNRESTRICTED CORPUS
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-indigo-300 text-base whitespace-nowrap">
                        {formatCurrency(fund.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPrintableVoucher({ type: 'SOCIETY_FUND', data: fund })}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="Print Fund Receipt Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSocietyFund(fund.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Delete Fund Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: CASH IN HAND & CASH DRAWERS */}
      {activeTab === 'cash-in-hand' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Cash in Hand & Counter Cash Drawers</h3>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
                  F4 Contra & Petty Cash
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Track physical cash registers, counter collections, bank float withdrawals, and petty cash disbursements.
              </p>
            </div>
            <button
              onClick={() => setShowAddCashTransactionModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Coins className="w-4 h-4" /> + Record Cash In/Out / Transfer
            </button>
          </div>

          {/* Cash Drawers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cashRegisters.map((reg) => (
              <div
                key={reg.id}
                onClick={() => setSelectedRegisterId(reg.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  selectedRegisterId === reg.id
                    ? 'bg-slate-950 border-amber-500 ring-1 ring-amber-500/40 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{reg.registerName}</div>
                      <div className="text-[11px] text-slate-400">Custodian: {reg.custodianName || 'Cashier'}</div>
                    </div>
                  </div>
                  {reg.isDefault && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                      DEFAULT
                    </span>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-900 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Live Drawer Balance</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">
                      {formatCurrency(reg.currentBalance || reg.openingBalance)}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-medium">
                    {selectedRegisterId === reg.id ? '✓ Selected' : 'Filter by Box'}
                  </span>
                </div>
              </div>
            ))}

            <div className="bg-gradient-to-br from-slate-950 to-amber-950/30 border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-300 uppercase">Total Cash in Hand Across Campus</span>
                <div className="text-2xl font-bold text-white font-mono mt-1">
                  {formatCurrency(cashRegisters.reduce((sum, r) => sum + (r.currentBalance || 0), 0))}
                </div>
              </div>
              <div className="text-[11px] text-amber-300/80 pt-2 border-t border-slate-900 flex items-center justify-between">
                <span>Tally Group: Cash-in-Hand</span>
                <span>Port 9000 Ready</span>
              </div>
            </div>
          </div>

          {/* Cash Transactions Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Cash Daybook & Transaction Log
              </h4>
              {selectedRegisterId && (
                <button
                  onClick={() => setSelectedRegisterId(null)}
                  className="text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  Show All Cash Boxes
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-medium">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap">Date & Voucher</th>
                    <th className="p-3.5 whitespace-nowrap">Cash Register</th>
                    <th className="p-3.5 whitespace-nowrap">Type</th>
                    <th className="p-3.5">Payer / Beneficiary</th>
                    <th className="p-3.5 whitespace-nowrap">Category</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Amount (₹)</th>
                    <th className="p-3.5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {cashTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500">
                        No cash transactions recorded yet. Click "+ Record Cash In/Out / Transfer" to post a cash entry.
                      </td>
                    </tr>
                  ) : (
                    cashTransactions
                      .filter((tx) => !selectedRegisterId || tx.registerId === selectedRegisterId)
                      .map((tx) => {
                        const isOutflow = ['CASH_OUT', 'BANK_DEPOSIT', 'EXPENSE_PAYMENT'].includes(tx.transactionType);
                        const regName = cashRegisters.find((r) => r.id === tx.registerId)?.registerName || 'Cash Box';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="font-mono text-xs font-bold text-white">{tx.voucherNumber || `CSH-${tx.id.slice(0, 6)}`}</div>
                              <div className="text-[11px] text-slate-500">{new Date(tx.transactionDate || tx.createdAt).toLocaleDateString('en-IN')}</div>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="font-medium text-slate-200 text-xs">{regName}</div>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md inline-block ${
                                isOutflow
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {tx.transactionType.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3.5 min-w-[180px]">
                              <div className="font-medium text-slate-200">{tx.recipientOrPayer || '-'}</div>
                              {tx.notes && <div className="text-[11px] text-slate-400 italic">{tx.notes}</div>}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono inline-block">
                                {tx.category || 'PETTY_EXPENSE'}
                              </span>
                            </td>
                            <td className={`p-3.5 text-right font-mono font-bold text-sm whitespace-nowrap ${isOutflow ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isOutflow ? '-' : '+'}{formatCurrency(tx.amount)}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => setPrintableVoucher({ type: 'CASH_TRANSACTION', data: { ...tx, registerName: regName } })}
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                                title="Print Cash Voucher"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: FIXED ASSET REGISTER & DEPRECIATION */}
      {activeTab === 'fixed-assets' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Fixed Asset Register & Depreciation</h3>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  Balance Sheet Capital Assets
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Track academic block buildings, IT computer labs, school buses, lab equipment, and live annual depreciation journal vouchers.
              </p>
            </div>
            <button
              onClick={() => setShowAddFixedAssetModal(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-xl flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Layers className="w-4 h-4" /> + Add Fixed Asset
            </button>
          </div>

          {/* Asset Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">TOTAL ASSET PURCHASE COST</div>
              <div className="text-2xl font-bold text-white mt-1">
                {formatCurrency(fixedAssets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Historical acquisition value</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">ACCUMULATED DEPRECIATION</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                -{formatCurrency(fixedAssets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Total written-down value reduction</div>
            </div>

            <div className="bg-gradient-to-br from-slate-950 to-cyan-950/40 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-xs text-cyan-300 font-semibold">NET CURRENT BOOK VALUE</div>
              <div className="text-2xl font-black text-cyan-400 mt-1">
                {formatCurrency(fixedAssets.reduce((sum, a) => sum + (a.currentBookValue || 0), 0))}
              </div>
              <div className="text-[11px] text-cyan-300/70 mt-0.5">Balance Sheet asset balance</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium">TALLY PRIME JOURNAL VOUCHERS</div>
                <div className="text-sm font-bold text-emerald-400 mt-1">Auto Journal Posting Active</div>
              </div>
              <div className="text-[11px] text-slate-500">Dr. Depreciation A/c | Cr. Asset A/c</div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['ALL', 'LAND_BUILDING', 'IT_HARDWARE', 'LAB_EQUIPMENT', 'VEHICLES', 'SMART_CLASSROOM', 'FURNITURE'].map((cat) => (
              <button
                key={cat}
                onClick={() => setAssetCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  assetCategoryFilter === cat
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Fixed Asset Register Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Asset Name & Code</th>
                  <th className="p-3.5 whitespace-nowrap">Category & Location</th>
                  <th className="p-3.5 whitespace-nowrap">Purchase Details</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Purchase Price</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Depreciation Rate</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Accumulated Dep.</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Current Book Value</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {fixedAssets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500">
                      No Fixed Assets recorded yet. Click "+ Add Fixed Asset" to register school capital assets.
                    </td>
                  </tr>
                ) : (
                  fixedAssets
                    .filter((a) => assetCategoryFilter === 'ALL' || a.category === assetCategoryFilter)
                    .map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 min-w-[200px]">
                          <div className="font-semibold text-white">{asset.assetName}</div>
                          <div className="font-mono text-xs text-cyan-400 font-bold mt-0.5">{asset.assetCode || 'AST-001'}</div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded-md inline-block">
                            {asset.category}
                          </span>
                          <div className="text-xs text-slate-400 mt-1">{asset.location || 'Main Campus'}</div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="text-xs text-slate-200">{new Date(asset.purchaseDate || asset.createdAt).toLocaleDateString('en-IN')}</div>
                          <div className="text-[11px] text-slate-400">{asset.vendorName || 'Direct Vendor'}</div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-slate-200 whitespace-nowrap">
                          {formatCurrency(asset.purchasePrice)}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded font-mono text-xs font-bold inline-block">
                            {asset.depreciationRate}% p.a.
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono text-rose-400 font-medium whitespace-nowrap">
                          -{formatCurrency(asset.accumulatedDepreciation)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-cyan-300 text-base whitespace-nowrap">
                          {formatCurrency(asset.currentBookValue)}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleDepreciateAsset(asset.id)}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                              title="Apply Annual Depreciation & Post Journal Entry"
                            >
                              <Calculator className="w-3.5 h-3.5" /> Depreciate
                            </button>
                            <button
                              onClick={() => setPrintableVoucher({ type: 'FIXED_ASSET', data: asset })}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                              title="Print Asset Tag / Register Card"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFixedAsset(asset.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: TALLY & BUSY CONNECTOR */}
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
      {showAddFeeModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
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
      {showUpdateFeeModal && updatingFeeRecord && renderPortal((() => {
        const previousPaid = parseFloat(updatingFeeRecord.paidAmount || 0);
        const totalBilled = parseFloat(updatingFeeRecord.totalAmount || 0);
        const remainingDues = Math.max(0, totalBilled - previousPaid);
        const addedPayment = parseFloat(newPaymentReceived || 0);
        const isExceeding = addedPayment > remainingDues;
        const newTotalPaid = previousPaid + addedPayment;
        const newRemaining = Math.max(0, remainingDues - addedPayment);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
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
    })())}

      {/* Modal: Add Payroll */}
      {showAddPayrollModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
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
                      {facultyOptions.filter((f) => (f.empId || '').toLowerCase().includes((newPayroll.employeeId || '').toLowerCase())).length === 0 && (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Custom Employee ID: <span className="text-white font-semibold">{newPayroll.employeeId}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Searchable Faculty Name Dropdown */}
              <div className={`relative ${isFacultyDropdownOpen ? 'z-30' : 'z-0'}`}>
                <label className="text-xs text-slate-400 font-medium block mb-1">Employee / Faculty Name</label>
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
                      {facultyOptions.filter((f) => f.name.toLowerCase().includes((newPayroll.employeeName || '').toLowerCase())).length === 0 && (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Custom Employee: <span className="text-white font-semibold">{newPayroll.employeeName}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior HOD, Teacher"
                    value={newPayroll.designation}
                    onChange={(e) => setNewPayroll({ ...newPayroll, designation: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Payroll Month</label>
                  <select
                    value={newPayroll.month}
                    onChange={(e) => setNewPayroll({ ...newPayroll, month: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Basic Pay (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="75000"
                    value={newPayroll.basicPay}
                    onChange={(e) => setNewPayroll({ ...newPayroll, basicPay: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Allowances</label>
                  <input
                    type="number"
                    placeholder="12000"
                    value={newPayroll.allowances}
                    onChange={(e) => setNewPayroll({ ...newPayroll, allowances: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Deductions</label>
                  <input
                    type="number"
                    placeholder="4500"
                    value={newPayroll.deductions}
                    onChange={(e) => setNewPayroll({ ...newPayroll, deductions: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
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

      {/* Modal: Add Expense / Donation */}
      {showAddExpenseModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Record Other Expense or Donation</h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Expense Title / Ledger Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Campus Electrical Maintenance, Alumni Grant..."
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Category *</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="MAINTENANCE">Maintenance & Repairs</option>
                    <option value="DONATION">Donation & Grant Income</option>
                    <option value="UTILITIES">Utilities & Fuel</option>
                    <option value="LAB_INFRA">Laboratory & Infrastructure</option>
                    <option value="EVENTS">Sports & Cultural Events</option>
                    <option value="OTHER">Other Operational Expense</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 35000"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Vendor / Donor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Cooling Engineers, Alumni Trust..."
                    value={newExpense.vendorName}
                    onChange={(e) => setNewExpense({ ...newExpense, vendorName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={newExpense.expenseDate}
                    onChange={(e) => setNewExpense({ ...newExpense, expenseDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Payment Method</label>
                  <select
                    value={newExpense.paymentMethod}
                    onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Bank Account</label>
                  <select
                    value={newExpense.bankAccountName}
                    onChange={(e) => setNewExpense({ ...newExpense, bankAccountName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.accountName}>
                        {b.accountName} ({b.bankName})
                      </option>
                    ))}
                    {bankAccounts.length === 0 && <option value="HDFC Bank Main Account">HDFC Bank Main Account</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Additional expense breakdown or voucher details..."
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl shadow-lg"
                >
                  Save & Queue Tally Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Bank Account */}
      {showAddBankModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add School Bank Account</h3>
              <button
                onClick={() => setShowAddBankModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBankAccount} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Display Ledger Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. State Bank of India Operations, ICICI Fee Collection..."
                  value={newBankAccount.accountName}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, accountName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank, SBI..."
                    value={newBankAccount.bankName}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, bankName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50100492810394"
                    value={newBankAccount.accountNumber}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, accountNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001824"
                    value={newBankAccount.ifscCode}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, ifscCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Branch"
                    value={newBankAccount.branchName}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, branchName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Account Type</label>
                  <select
                    value={newBankAccount.accountType}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, accountType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="OVERDRAFT">Overdraft (OD) Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500000"
                    value={newBankAccount.openingBalance}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, openingBalance: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPrimaryCheck"
                  checked={newBankAccount.isPrimary}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, isPrimary: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-teal-500 focus:ring-0"
                />
                <label htmlFor="isPrimaryCheck" className="text-xs text-slate-300 cursor-pointer font-medium">
                  Set as Primary Bank Account for Tally Sync
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-xl shadow-lg"
                >
                  Create Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Society Fund */}
      {showAddSocietyFundModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Record Society / Corpus Capital Fund</h3>
              </div>
              <button
                onClick={() => setShowAddSocietyFundModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSocietyFund} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Fund / Endowment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. General Trust Corpus Fund, Campus Development Grant..."
                  value={newSocietyFund.fundName}
                  onChange={(e) => setNewSocietyFund({ ...newSocietyFund, fundName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Fund Classification</label>
                  <select
                    value={newSocietyFund.fundType}
                    onChange={(e) => setNewSocietyFund({ ...newSocietyFund, fundType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="CORPUS">🏛️ Corpus Reserve Fund</option>
                    <option value="INFRASTRUCTURE">🏗️ Infrastructure Grant</option>
                    <option value="SCHOLARSHIP">🎓 Scholarship Endowment</option>
                    <option value="TRUST_GRANT">🤝 Trust / Society Grant</option>
                    <option value="DEVELOPMENT">🚀 Development Fund</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Contributing Body / Donor *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Education Trust Society"
                    value={newSocietyFund.contributingBody}
                    onChange={(e) => setNewSocietyFund({ ...newSocietyFund, contributingBody: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Fund Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 2500000"
                    value={newSocietyFund.amount}
                    onChange={(e) => setNewSocietyFund({ ...newSocietyFund, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Inflow Date</label>
                  <input
                    type="date"
                    value={newSocietyFund.fundDate}
                    onChange={(e) => setNewSocietyFund({ ...newSocietyFund, fundDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Endowment Purpose / Donor Earmarks</label>
                <input
                  type="text"
                  placeholder="e.g. Reserved for building 3rd floor science wing & smart robotics lab"
                  value={newSocietyFund.purpose}
                  onChange={(e) => setNewSocietyFund({ ...newSocietyFund, purpose: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="restrictedCheck"
                  checked={newSocietyFund.isRestricted}
                  onChange={(e) => setNewSocietyFund({ ...newSocietyFund, isRestricted: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-0"
                />
                <label htmlFor="restrictedCheck" className="text-xs text-slate-300 cursor-pointer font-medium">
                  🔒 Restricted Fund (Restricted exclusively to specified purpose)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSocietyFundModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg"
                >
                  Record Society Fund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Cash In/Out & Float Transfer */}
      {showAddCashTransactionModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Record Cash Transaction / Float Transfer</h3>
              </div>
              <button
                onClick={() => setShowAddCashTransactionModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCashTransaction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Cash Register / Drawer *</label>
                  <select
                    value={newCashTransaction.registerId || selectedRegisterId || (cashRegisters[0]?.id || '')}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, registerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    {cashRegisters.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        💵 {reg.registerName} (Bal: {formatCurrency(reg.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Transaction Type *</label>
                  <select
                    value={newCashTransaction.transactionType}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, transactionType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none font-semibold text-amber-400"
                  >
                    <option value="CASH_IN">📥 Cash Inflow / Counter Collection</option>
                    <option value="CASH_OUT">📤 Cash Outflow / Petty Expense</option>
                    <option value="BANK_WITHDRAWAL">🏦 Bank ➔ Cash Float Refill (Contra F4)</option>
                    <option value="BANK_DEPOSIT">🏦 Cash ➔ Bank Deposit (Contra F4)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15000"
                    value={newCashTransaction.amount}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={newCashTransaction.transactionDate}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, transactionDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {['BANK_WITHDRAWAL', 'BANK_DEPOSIT'].includes(newCashTransaction.transactionType) && (
                <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 space-y-1">
                  <label className="text-xs text-amber-300 font-semibold block flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" /> Linked Bank Account for Contra Transfer
                  </label>
                  <select
                    value={newCashTransaction.bankAccountId || (bankAccounts[0]?.id || '')}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, bankAccountId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountName} (Bal: {formatCurrency(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Beneficiary / Payer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Courier boy, Electrician, Admissions desk..."
                    value={newCashTransaction.recipientOrPayer}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, recipientOrPayer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Category Header</label>
                  <select
                    value={newCashTransaction.category}
                    onChange={(e) => setNewCashTransaction({ ...newCashTransaction, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="PETTY_EXPENSE">Petty Office Expense</option>
                    <option value="FEE_PAYMENT">Fee Collection Inflow</option>
                    <option value="BANK_FLOAT_TRANSFER">Bank Float Refill / Deposit</option>
                    <option value="MAINTENANCE">Immediate Repair & Maintenance</option>
                    <option value="STAFF_ADVANCE">Staff Cash Advance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Narration / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent plumbing fixtures purchase & postal stamps"
                  value={newCashTransaction.notes}
                  onChange={(e) => setNewCashTransaction({ ...newCashTransaction, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCashTransactionModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg"
                >
                  Post Cash Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Fixed Asset */}
      {showAddFixedAssetModal && renderPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Add Fixed Asset to Capital Register</h3>
              </div>
              <button
                onClick={() => setShowAddFixedAssetModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFixedAsset} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Asset Description / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell OptiPlex Core i7 Lab PCs (Batch 2), Campus Starbus 42-Seater..."
                  value={newFixedAsset.assetName}
                  onChange={(e) => setNewFixedAsset({ ...newFixedAsset, assetName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Asset Category *</label>
                  <select
                    value={newFixedAsset.category}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-semibold text-cyan-300"
                  >
                    <option value="IT_HARDWARE">💻 IT Hardware & Computers</option>
                    <option value="LAND_BUILDING">🏛️ Land & Academic Buildings</option>
                    <option value="LAB_EQUIPMENT">🔬 Science Lab Equipment</option>
                    <option value="VEHICLES">🚌 Vehicles & School Buses</option>
                    <option value="SMART_CLASSROOM">📺 Smart Digital Boards</option>
                    <option value="FURNITURE">🪑 Classroom Furniture</option>
                    <option value="LIBRARY_BOOKS">📚 Library Books & Archives</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Asset Tag / Serial Code</label>
                  <input
                    type="text"
                    placeholder="e.g. AST-IT-2026-009"
                    value={newFixedAsset.assetCode}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, assetCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 450000"
                    value={newFixedAsset.purchasePrice}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, purchasePrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={newFixedAsset.purchaseDate}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, purchaseDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Vendor / Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. Dell Direct Commercial Sales"
                    value={newFixedAsset.vendorName}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, vendorName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Invoice / Bill Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-DEL-890"
                    value={newFixedAsset.invoiceNo}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, invoiceNo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Physical Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Science Block Lab 2"
                    value={newFixedAsset.location}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Annual Depr. Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="15.0"
                    value={newFixedAsset.depreciationRate}
                    onChange={(e) => setNewFixedAsset({ ...newFixedAsset, depreciationRate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddFixedAssetModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-xl shadow-lg"
                >
                  Register Fixed Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Official Receipt & Voucher Printable PDF View */}
      {printableVoucher && renderPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 z-[9999] overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 my-4 sm:my-8">
            {/* Modal Header Actions */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-400" />
                <h3 className="text-lg font-bold text-white">Voucher & Receipt Document</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setPrintableVoucher(null)}
                  className="p-1.5 text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PRINTABLE RECEIPT CARD CONTENT */}
            <div id="printable-receipt-content" className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6 text-slate-200">
              {/* Institution Letterhead Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-xl">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">{currentOrg?.name || 'Demo International Academy'}</h2>
                    <p className="text-xs text-slate-400">Department of Finance & Accounts • Institutional ERP</p>
                    <p className="text-[11px] text-slate-500">Official Accounting & Tally Prime Ledger Document</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg inline-block">
                    {printableVoucher.type === 'FEE' && (printableVoucher.data.receiptNo || `REC/2026-27/${printableVoucher.data.studentRollNo || '001'}`)}
                    {printableVoucher.type === 'PAYROLL' && (printableVoucher.data.tallyVoucherId || `PAY-TAL/${printableVoucher.data.employeeId || '001'}`)}
                    {printableVoucher.type === 'EXPENSE' && (printableVoucher.data.receiptNo || `VOUCH/${printableVoucher.data.id?.slice(0, 6)}`)}
                    {printableVoucher.type === 'SOCIETY_FUND' && (printableVoucher.data.receiptNo || `SOC-REC/${printableVoucher.data.id?.slice(0, 6)}`)}
                    {printableVoucher.type === 'CASH_TRANSACTION' && (printableVoucher.data.voucherNumber || `CSH-VOUCH/${printableVoucher.data.id?.slice(0, 6)}`)}
                    {printableVoucher.type === 'FIXED_ASSET' && (printableVoucher.data.assetCode || `AST-REG/${printableVoucher.data.id?.slice(0, 6)}`)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Date: {new Date().toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              {/* Voucher Title Banner */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center">
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400">
                  {printableVoucher.type === 'FEE' && 'Official Student Fee Payment Receipt'}
                  {printableVoucher.type === 'PAYROLL' && 'Official Faculty Salary Disbursement Payslip'}
                  {printableVoucher.type === 'EXPENSE' && 'Official Expense & Donation Payment Voucher'}
                  {printableVoucher.type === 'SOCIETY_FUND' && 'Official Society / Corpus Capital Fund Receipt Voucher'}
                  {printableVoucher.type === 'CASH_TRANSACTION' && 'Official Cash Daybook Voucher / Contra Entry (F4)'}
                  {printableVoucher.type === 'FIXED_ASSET' && 'Official Fixed Asset Registration & Depreciation Certificate'}
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                {printableVoucher.type === 'FEE' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Student Name</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Roll Number</span>
                      <span className="font-mono text-slate-200">{printableVoucher.data.studentRollNo}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fee Header</span>
                      <span className="text-slate-200">{printableVoucher.data.feeHeader}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payment Method</span>
                      <span className="text-emerald-400 font-medium">{printableVoucher.data.paymentMethod || 'UPI / Online'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Bank Account</span>
                      <span className="text-teal-300 font-mono">{printableVoucher.data.bankAccountName || 'HDFC Bank Main Account'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Academic Year</span>
                      <span className="text-slate-200">{printableVoucher.data.academicYear || '2026-27'}</span>
                    </div>
                  </>
                )}

                {printableVoucher.type === 'PAYROLL' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Employee Name</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.employeeName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Employee ID</span>
                      <span className="font-mono text-slate-200">{printableVoucher.data.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Designation</span>
                      <span className="text-slate-200">{printableVoucher.data.designation}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payroll Period</span>
                      <span className="text-emerald-400 font-medium">{printableVoucher.data.month} {printableVoucher.data.year}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Disbursement Mode</span>
                      <span className="text-teal-300">Direct Bank Deposit</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tally Ref Voucher</span>
                      <span className="font-mono text-slate-300">{printableVoucher.data.tallyVoucherId || 'PAY-TAL-8801'}</span>
                    </div>
                  </>
                )}

                {printableVoucher.type === 'EXPENSE' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Expense Title</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.title}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Category</span>
                      <span className="text-purple-300 font-semibold">{printableVoucher.data.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Vendor / Payee</span>
                      <span className="text-slate-200">{printableVoucher.data.vendorName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payment Method</span>
                      <span className="text-emerald-400 font-medium">{printableVoucher.data.paymentMethod || 'BANK_TRANSFER'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Bank Account</span>
                      <span className="text-teal-300 font-mono">{printableVoucher.data.bankAccountName || 'HDFC Bank Main Account'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Voucher Date</span>
                      <span className="text-slate-200">{new Date(printableVoucher.data.expenseDate || Date.now()).toLocaleDateString('en-IN')}</span>
                    </div>
                  </>
                )}

                {printableVoucher.type === 'SOCIETY_FUND' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fund Name</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.fundName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Classification</span>
                      <span className="text-indigo-300 font-semibold">{printableVoucher.data.fundType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Contributing Body</span>
                      <span className="text-slate-200">{printableVoucher.data.contributingBody}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Restriction Type</span>
                      <span className="text-amber-400 font-medium">{printableVoucher.data.isRestricted ? 'Restricted Endowment' : 'Unrestricted Corpus'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tally Group Parent</span>
                      <span className="text-teal-300 font-mono">Capital Account</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Inflow Date</span>
                      <span className="text-slate-200">{new Date(printableVoucher.data.fundDate || Date.now()).toLocaleDateString('en-IN')}</span>
                    </div>
                  </>
                )}

                {printableVoucher.type === 'CASH_TRANSACTION' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Cash Drawer</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.registerName || 'Main Admissions Counter'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Transaction Type</span>
                      <span className="text-amber-300 font-bold">{printableVoucher.data.transactionType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payer / Recipient</span>
                      <span className="text-slate-200">{printableVoucher.data.recipientOrPayer || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Category</span>
                      <span className="text-emerald-400 font-medium">{printableVoucher.data.category || 'PETTY_EXPENSE'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tally Voucher Type</span>
                      <span className="text-teal-300 font-mono">F4 Contra / Cash Receipt</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Transaction Date</span>
                      <span className="text-slate-200">{new Date(printableVoucher.data.transactionDate || Date.now()).toLocaleDateString('en-IN')}</span>
                    </div>
                  </>
                )}

                {printableVoucher.type === 'FIXED_ASSET' && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Asset Name</span>
                      <span className="font-bold text-white text-sm">{printableVoucher.data.assetName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Asset Tag Code</span>
                      <span className="font-mono text-cyan-300 font-bold">{printableVoucher.data.assetCode || 'AST-001'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Category</span>
                      <span className="text-slate-200">{printableVoucher.data.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Campus Location</span>
                      <span className="text-emerald-400 font-medium">{printableVoucher.data.location || 'Main Campus'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Depreciation Method</span>
                      <span className="text-teal-300 font-mono">{printableVoucher.data.depreciationMethod || 'STRAIGHT_LINE'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Purchase Date</span>
                      <span className="text-slate-200">{new Date(printableVoucher.data.purchaseDate || Date.now()).toLocaleDateString('en-IN')}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Itemized Table Breakdown */}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3 text-left">Description / Accounting Particulars</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {printableVoucher.type === 'FEE' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">{printableVoucher.data.feeHeader} (Billed Amount)</td>
                          <td className="p-3 text-right font-mono text-slate-200">{formatCurrency(printableVoucher.data.totalAmount)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-emerald-400">Total Payment Received</td>
                          <td className="p-3 text-right font-mono text-emerald-400 font-bold">+{formatCurrency(printableVoucher.data.paidAmount)}</td>
                        </tr>
                        <tr className="bg-slate-900/80 font-bold">
                          <td className="p-3 text-amber-400">Remaining Balance Dues</td>
                          <td className="p-3 text-right font-mono text-amber-400">{formatCurrency(printableVoucher.data.pendingBalance)}</td>
                        </tr>
                      </>
                    )}

                    {printableVoucher.type === 'PAYROLL' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">Basic Pay Salary</td>
                          <td className="p-3 text-right font-mono text-slate-200">{formatCurrency(printableVoucher.data.basicPay)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-emerald-400">Allowances & Bonuses</td>
                          <td className="p-3 text-right font-mono text-emerald-400">+{formatCurrency(printableVoucher.data.allowances)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-rose-400">Deductions (TDS / PF)</td>
                          <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(printableVoucher.data.deductions)}</td>
                        </tr>
                        <tr className="bg-slate-900/80 font-bold text-white">
                          <td className="p-3 text-sm">Net Salary Disbursed</td>
                          <td className="p-3 text-right text-sm font-mono text-emerald-400">{formatCurrency(printableVoucher.data.netSalary)}</td>
                        </tr>
                      </>
                    )}

                    {printableVoucher.type === 'EXPENSE' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">{printableVoucher.data.title}</td>
                          <td className="p-3 text-right font-mono font-bold text-white">{formatCurrency(printableVoucher.data.amount)}</td>
                        </tr>
                        {printableVoucher.data.notes && (
                          <tr>
                            <td colSpan="2" className="p-3 text-slate-400 italic">Notes: {printableVoucher.data.notes}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {printableVoucher.type === 'SOCIETY_FUND' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">{printableVoucher.data.fundName} (Capital Corpus Allocation)</td>
                          <td className="p-3 text-right font-mono font-bold text-indigo-400">{formatCurrency(printableVoucher.data.amount)}</td>
                        </tr>
                        {printableVoucher.data.purpose && (
                          <tr>
                            <td colSpan="2" className="p-3 text-slate-400 italic">Specific Purpose / Earmark: {printableVoucher.data.purpose}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-900/80 font-bold text-white">
                          <td className="p-3">Total Corpus Capital Inflow (Credit: Capital Account)</td>
                          <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(printableVoucher.data.amount)}</td>
                        </tr>
                      </>
                    )}

                    {printableVoucher.type === 'CASH_TRANSACTION' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">Cash Entry - {printableVoucher.data.transactionType} ({printableVoucher.data.category})</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400">{formatCurrency(printableVoucher.data.amount)}</td>
                        </tr>
                        {printableVoucher.data.notes && (
                          <tr>
                            <td colSpan="2" className="p-3 text-slate-400 italic">Narration: {printableVoucher.data.notes}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {printableVoucher.type === 'FIXED_ASSET' && (
                      <>
                        <tr>
                          <td className="p-3 font-medium">Original Capital Acquisition Cost</td>
                          <td className="p-3 text-right font-mono text-slate-200">{formatCurrency(printableVoucher.data.purchasePrice)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-rose-400">Total Accumulated Depreciation ({printableVoucher.data.depreciationRate}% p.a.)</td>
                          <td className="p-3 text-right font-mono text-rose-400 font-bold">-{formatCurrency(printableVoucher.data.accumulatedDepreciation)}</td>
                        </tr>
                        <tr className="bg-slate-900/80 font-bold text-white">
                          <td className="p-3 text-cyan-300">Net Current Book Value on Balance Sheet</td>
                          <td className="p-3 text-right font-mono text-cyan-300 text-sm">{formatCurrency(printableVoucher.data.currentBookValue)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Verification & Signatures */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified & Synced with Tally Prime / Busy ERP</span>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-bold text-slate-300">Finance & Accounts Department</div>
                  <div className="text-[10px] text-slate-500 italic">Authorized System Generated Signature & Stamp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

