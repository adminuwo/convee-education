import prisma from '../db/prisma';
import { logger } from '../utils/logger';

export interface GuardrailCheckResult {
  allowed: boolean;
  status: 'PASSED' | 'REFRAMED' | 'CRISIS_INTERVENTION' | 'BLOCKED' | 'SANITIZED';
  category?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
  overrideResponse?: string;
  augmentedSystemPrompt?: string;
  reason?: string;
}

// 1. Crisis & Self-Harm Regex Patterns
const CRISIS_PATTERNS = [
  /\b(want to die|kill myself|suicide|suicidal|end my life|end it all|hang myself|cut my wrist|slit my wrist|take all my pills|overdose|better off dead|no reason to live|hate my life so much I want to die|nobody would care if I died)\b/i,
  /\b(how to kill myself|how to commit suicide|easiest way to die|painless suicide)\b/i,
  /\b(self harm|self-harm|cutting myself|hurting myself|burn myself)\b/i,
];

// 2. Actionable Danger Patterns (Illegal synthesis, weapon making, malware creation)
const ACTIONABLE_DANGER_PATTERNS = [
  /\b(how to make (a )?bomb|build an explosive|synthesize (c4|tnt|rdx)|homemade explosive|make a pipe bomb)\b/i,
  /\b(how to make (meth|heroin|fentanyl|crack cocaine)|cook meth)\b/i,
  /\b(create a keylogger|write ransomware|ddos attack tool|how to hack school wifi passwords? and delete grades)\b/i,
  /\b(how to poison someone|undetectable poison recipe)\b/i,
];

// 3. Academic Dual-Use Keywords (Must NOT be blocked - Biology, Chemistry, History, Medicine)
const ACADEMIC_DUAL_USE_KEYWORDS = [
  // Biology & Anatomy
  'reproduction', 'fertilization', 'embryo', 'gametes', 'sperm', 'ovum', 'zygote', 'uterus', 'fallopian',
  'anatomy', 'genitalia', 'puberty', 'hormones', 'testosterone', 'estrogen', 'mitosis', 'meiosis',
  'chromosome', 'dna', 'cell division', 'sexual reproduction', 'asexual reproduction', 'pathogen', 'virus',
  // Chemistry & Physics
  'nitroglycerin', 'tnt', 'exothermic', 'combustion', 'reaction', 'oxidation', 'nuclear fission', 'radiation',
  'acid', 'base', 'chemical bond', 'stoichiometry', 'thermodynamics', 'catalyst', 'isotope', 'uranium',
  // History & Social Studies
  'world war', 'holocaust', 'partition', 'battle', 'revolution', 'treaty', 'genocide', 'cold war',
  'weapons of mass destruction', 'hiroshima', 'nagasaki', 'french revolution', 'colonialism',
  // Literature & Ethics
  'macbeth', 'hamlet', 'tragedy', 'conflict', 'moral dilemma', 'crime and punishment',
  // Computer Science
  'cryptography', 'firewall', 'encryption', 'decryption', 'buffer overflow', 'cybersecurity', 'sql injection theory'
];

// 4. Student PII Patterns (Teacher Guardrails)
const PII_PATTERNS = [
  /\b\d{4}\s\d{4}\s\d{4}\b/, // Aadhaar card format
  /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/, // PAN card format
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN format
];

export class GuardrailService {
  /**
   * Generates a compassionate, localized crisis intervention message.
   */
  static getCrisisInterventionCard(): string {
    return `### 💙 You Are Not Alone — We Care About You

If you are feeling overwhelmed, hopeless, or having thoughts of hurting yourself, please know that **you don't have to carry this alone**. There are compassionate people ready to listen and help you right now, 24/7.

---

### 📞 Free & Confidential Support Helplines

* **National Mental Health Helpline (Tele-MANAS):**
  * **Call:** \`14416\` or \`1800-891-4416\` *(Toll-Free, 24/7, Multiple Languages)*
* **Childline India (Students & Youth):**
  * **Call:** \`1098\` *(24/7 Emergency Support)*
* **KIRAN Mental Health Helpline:**
  * **Call:** \`1800-599-0019\` *(24/7 Toll-Free)*
* **Vandrevala Foundation:**
  * **Call / WhatsApp:** \`+91 9999 666 555\`
* **NIMHANS Psychosocial Support:**
  * **Call:** \`080-46110007\`

---

### 💬 Please Talk to Someone You Trust
* Reach out to your **School Counselor**, a **trusted teacher**, your **parents**, or a **close friend**.
* You matter, and there is support available to help you through this moment.`;
  }

  /**
   * Evaluates a Student Query for safety while ensuring academic queries are protected.
   */
  static evaluateStudentQuery(query: string, subjectContext?: string): GuardrailCheckResult {
    const qLower = query.toLowerCase().trim();

    // 1. Check for Crisis / Self-Harm (Top Priority)
    for (const pattern of CRISIS_PATTERNS) {
      if (pattern.test(qLower)) {
        return {
          allowed: false,
          status: 'CRISIS_INTERVENTION',
          severity: 'CRISIS',
          category: 'SELF_HARM',
          overrideResponse: this.getCrisisInterventionCard(),
          reason: 'Crisis/self-harm signals detected. Rendered immediate supportive helpline card.',
        };
      }
    }

    // 2. Check for Academic Dual-Use Context (Biology, Chemistry, History)
    const isAcademicDualUse = ACADEMIC_DUAL_USE_KEYWORDS.some(kw => qLower.includes(kw));

    // 3. Check for Actionable Danger / Malicious Intent
    for (const pattern of ACTIONABLE_DANGER_PATTERNS) {
      if (pattern.test(qLower)) {
        if (isAcademicDualUse) {
          // Reframe into safe theoretical/historical explanation
          return {
            allowed: true,
            status: 'REFRAMED',
            severity: 'MEDIUM',
            category: 'DANGEROUS_CONTENT',
            augmentedSystemPrompt: `\n[ACADEMIC GUARD-RAIL ACTIVE]: The student is exploring a topic with potential dual-use (${subjectContext || 'Academic Science/History'}). Provide an objective, textbook-level, theoretical explanation (e.g. chemical reaction equations, historical background, or physics principles). NEVER provide step-by-step actionable synthesis recipes, practical bomb-making instructions, or weapon construction guides.`,
            reason: 'Dual-use scientific query detected; reframing to theoretical/academic principles.',
          };
        } else {
          return {
            allowed: false,
            status: 'BLOCKED',
            severity: 'HIGH',
            category: 'DANGEROUS_CONTENT',
            overrideResponse: `I cannot provide actionable instructions, recipes, or methods for hazardous materials, weapons, or cyberattacks.\n\nHowever, if this relates to your curriculum (such as chemical reaction principles in Chemistry or historical conflicts in History), please ask about the scientific equations or historical timeline, and I will be glad to explain!`,
            reason: 'Actionable dangerous content requested without educational context.',
          };
        }
      }
    }

    // 4. Default: Safe Academic Query
    return {
      allowed: true,
      status: 'PASSED',
      severity: 'LOW',
      category: 'GENERAL_STUDY',
      augmentedSystemPrompt: isAcademicDualUse
        ? `\n[ACADEMIC REPUTATION RULE]: The student is asking an academic question related to curriculum topics (such as human anatomy/reproduction in Biology, chemical reactions in Chemistry, or historical conflicts in History). Answer factually, scientifically, and clinically with grade-appropriate educational clarity without refusal.`
        : undefined,
    };
  }

  /**
   * Evaluates a Teacher / Faculty / Staff Query.
   */
  static evaluateTeacherQuery(query: string, userRole: string = 'TEACHER'): GuardrailCheckResult {
    const qLower = query.toLowerCase().trim();

    // 1. Check for Student PII Leakage (Aadhaar, SSN, confidential IDs)
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(query)) {
        return {
          allowed: true,
          status: 'SANITIZED',
          severity: 'MEDIUM',
          category: 'PII_LEAK',
          augmentedSystemPrompt: `\n[FACULTY PRIVACY GUARD ACTIVE]: The educator prompt may contain sensitive identification numbers or student records. Mask, redact, and do not repeat raw government IDs or sensitive student identifiers in the generated response. Comply with educational student data privacy standards (FERPA / DPDP).`,
          reason: 'Potential student PII detected in prompt. Instructing model to sanitize output.',
        };
      }
    }

    // 2. Check for Disciplinary / Grading Bias Guardrail
    if (qLower.includes('grading') || qLower.includes('marks') || qLower.includes('evaluation') || qLower.includes('report card remarks')) {
      return {
        allowed: true,
        status: 'PASSED',
        severity: 'LOW',
        category: 'PEDAGOGICAL_FAIRNESS',
        augmentedSystemPrompt: `\n[PEDAGOGICAL FAIRNESS & OBJECTIVITY GUARD]: Ensure all evaluation feedback, rubric suggestions, and report card remarks are constructive, evidence-based, unbiased, and focused on student growth.`,
      };
    }

    // 3. Check for Exam Integrity / Answer Key Generation
    if (qLower.includes('exam question paper') || qLower.includes('answer key') || qLower.includes('test paper leak')) {
      return {
        allowed: true,
        status: 'PASSED',
        severity: 'LOW',
        category: 'EXAM_INTEGRITY',
        augmentedSystemPrompt: `\n[EXAM INTEGRITY GUARD]: Provide original pedagogical questions calibrated to syllabus learning outcomes. Remind the educator to review test items according to school board guidelines.`,
      };
    }

    return {
      allowed: true,
      status: 'PASSED',
      severity: 'LOW',
      category: 'FACULTY_ASSIST',
    };
  }

  /**
   * Computes estimated token cost in USD based on provider and model.
   */
  static calculateEstimatedCost(promptTokens: number, completionTokens: number, provider: string, model: string): number {
    const prov = (provider || '').toLowerCase();
    const mdl = (model || '').toLowerCase();

    let promptPricePerMillion = 0.075; // Vertex Gemini 2.5 Flash default ($0.075 / 1M tokens)
    let completionPricePerMillion = 0.30; // ($0.30 / 1M tokens)

    if (prov.includes('openai') || mdl.includes('gpt-4o-mini')) {
      promptPricePerMillion = 0.15; // GPT-4o-mini ($0.15 / 1M tokens)
      completionPricePerMillion = 0.60; // ($0.60 / 1M tokens)
    } else if (mdl.includes('gpt-4o') && !mdl.includes('mini')) {
      promptPricePerMillion = 2.50; // GPT-4o ($2.50 / 1M tokens)
      completionPricePerMillion = 10.00;
    } else if (mdl.includes('gemini-1.5-pro') || mdl.includes('gemini-2.5-pro')) {
      promptPricePerMillion = 1.25;
      completionPricePerMillion = 5.00;
    }

    const costPrompt = (promptTokens / 1_000_000) * promptPricePerMillion;
    const costCompletion = (completionTokens / 1_000_000) * completionPricePerMillion;

    return Number((costPrompt + costCompletion).toFixed(6));
  }

  /**
   * Asynchronously logs token usage for billing and telemetry without blocking user request.
   */
  static async recordTokenUsage(params: {
    orgId?: string | null;
    userId: string;
    role?: string;
    sessionKey?: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
    feature?: string;
    guardrailStatus?: string;
  }) {
    try {
      const estimatedCost = this.calculateEstimatedCost(
        params.promptTokens,
        params.completionTokens,
        params.provider,
        params.model
      );

      await prisma.aITokenUsageLog.create({
        data: {
          orgId: params.orgId || null,
          userId: params.userId,
          role: params.role || 'STUDENT',
          sessionKey: params.sessionKey || null,
          promptTokens: params.promptTokens || 0,
          completionTokens: params.completionTokens || 0,
          totalTokens: params.totalTokens || 0,
          provider: params.provider || 'vertexai',
          model: params.model || 'gemini-2.5-flash',
          estimatedCost,
          feature: params.feature || 'CHAT',
          guardrailStatus: params.guardrailStatus || 'PASSED',
        },
      });
    } catch (err: any) {
      logger.warn(`Failed to record AITokenUsageLog: ${err?.message}`);
    }
  }

  /**
   * Asynchronously logs guardrail safety events for SuperAdmin / School Counselor audit trail.
   */
  static async recordGuardrailEvent(params: {
    orgId?: string | null;
    userId: string;
    userRole: string;
    severity: string;
    category: string;
    actionTaken: string;
    promptSnippet?: string;
    responseSnippet?: string;
  }) {
    try {
      await prisma.aIGuardrailEvent.create({
        data: {
          orgId: params.orgId || null,
          userId: params.userId,
          userRole: params.userRole || 'STUDENT',
          severity: params.severity || 'MEDIUM',
          category: params.category || 'SAFETY_CHECK',
          actionTaken: params.actionTaken || 'LOGGED',
          promptSnippet: (params.promptSnippet || '').substring(0, 500),
          responseSnippet: (params.responseSnippet || '').substring(0, 500),
        },
      });
    } catch (err: any) {
      logger.warn(`Failed to record AIGuardrailEvent: ${err?.message}`);
    }
  }
}
