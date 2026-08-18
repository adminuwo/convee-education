import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi } from '@/lib/api';
import StudentIDGenerator, { StudentIDGenerator as NamedStudentIDGenerator } from '@/components/admin/StudentIDGenerator';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionDiv = (motion && motion.div) ? motion.div : 'div';
const GeneratorComponent = StudentIDGenerator || NamedStudentIDGenerator;

export function StudentIDGeneratorPage() {
  const { currentOrg } = useAuth();
  const [departments, setDepartments] = useState([]);
  const isAdmin = ['ADMIN', 'DIRECTOR', 'OWNER', 'PRINCIPAL', 'DEAN'].includes(currentOrg?.role);

  const load = useCallback(async () => {
    if (!currentOrg?.id || !isAdmin) return;
    try {
      const depts = await orgApi.departments(currentOrg.id);
      setDepartments(Array.isArray(depts) ? depts : []);
    } catch (e) {}
  }, [currentOrg?.id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3 max-w-md mx-auto py-20">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          The Student ID & Credentials Generator is restricted exclusively to Admin roles. You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <MotionDiv initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="student-id-generator-page">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Student ID Generator</h1>
        <p className="text-muted-foreground text-sm">Exclusive Admin dashboard to generate unique student IDs, passwords, and auto-enrol students.</p>
      </div>

      {GeneratorComponent ? (
        <GeneratorComponent departments={departments} onStudentCreated={load} />
      ) : null}
    </MotionDiv>
  );
}

export default StudentIDGeneratorPage;
