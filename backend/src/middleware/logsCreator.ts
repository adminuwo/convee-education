import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ==============================================================================
// CASA & SECURITY COMPLIANCE SANITIZATION FILTERS
// ==============================================================================

const TOKEN_REGEX = /(Bearer\s+)[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/gi;
const EMAIL_REGEX = /([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})/g;
const CC_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

function luhnCheck(numStr: string): boolean {
  const sanitized = numStr.replace(/\D/g, '');
  if (sanitized.length < 13 || sanitized.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function sanitizeLogValue(val: any): any {
  if (typeof val === 'string') {
    let sanitized = val.replace(TOKEN_REGEX, '$1[REDACTED_JWT]');
    sanitized = sanitized.replace(EMAIL_REGEX, (_match, user, domain, ext) => {
      const masked = user.length > 1 ? user[0] + '***' : '***';
      return `${masked}@${domain}.${ext}`;
    });
    sanitized = sanitized.replace(CC_REGEX, (match) => {
      return luhnCheck(match) ? '[REDACTED_CC]' : match;
    });
    return sanitized;
  }
  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.map(sanitizeLogValue);
    }
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('cookie') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey')
      ) {
        sanitizedObj[k] = '[REDACTED_CREDENTIAL]';
      } else {
        sanitizedObj[k] = sanitizeLogValue(v);
      }
    }
    return sanitizedObj;
  }
  return val;
}

// ==============================================================================
// ASYNCHRONOUS ZERO-OVERHEAD RING BUFFER & BATCH FLUSHER
// ==============================================================================

export interface StructuredLogRecord {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  service: string;
  trace_id: string;
  span_id: string;
  environment: string;
  http: {
    method: string;
    route: string;
    status_code: number;
    duration_ms: number;
    client_ip: string;
  };
  security_context: {
    casa_tier: string;
    auth_type: string;
    is_test_account: boolean;
    tenant_id: string;
  };
  performance: {
    db_query_count: number;
    db_total_duration_ms: number;
    memory_delta_mb: number;
    cpu_user_microseconds: number;
  };
}

class LogRingBuffer {
  private buffer: StructuredLogRecord[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(capacity = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.startBackgroundFlusher();
  }

  public push(record: StructuredLogRecord): void {
    this.buffer[this.tail] = record;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Overwrite oldest item in ring buffer
      this.head = (this.head + 1) % this.capacity;
    }

    if (this.size >= 500) {
      this.flushSyncBatch();
    }
  }

  private startBackgroundFlusher(): void {
    this.flushTimer = setInterval(() => {
      this.flushSyncBatch();
    }, 100);
    this.flushTimer.unref();
  }

  public flushSyncBatch(): void {
    if (this.size === 0) return;
    const batchSize = Math.min(this.size, 500);
    const itemsToEmit: StructuredLogRecord[] = [];

    for (let i = 0; i < batchSize; i++) {
      const record = this.buffer[this.head];
      if (record) itemsToEmit.push(record);
      this.head = (this.head + 1) % this.capacity;
    }
    this.size -= batchSize;

    // Asynchronous non-blocking flush
    setImmediate(() => {
      for (const item of itemsToEmit) {
        const jsonStr = JSON.stringify(item);
        if (item.level === 'ERROR') {
          process.stderr.write(jsonStr + '\n');
        } else {
          // Output formatted JSON line
          process.stdout.write(jsonStr + '\n');
        }
      }
    });
  }

  public stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushSyncBatch();
  }
}

export const logBuffer = new LogRingBuffer(10000);

// ==============================================================================
// OPTIMIZATION & LOGS CREATOR MIDDLEWARE
// ==============================================================================

export function logsCreatorMiddleware(serviceName = 'core-backend') {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Distributed W3C Trace & Span Propagation
    let traceId = '';
    let spanId = '';

    const traceparent = req.headers['traceparent'] as string;
    if (traceparent && traceparent.startsWith('00-')) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) {
        traceId = parts[1];
        spanId = parts[2];
      }
    }

    if (!traceId) {
      traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
    }
    if (!spanId) {
      spanId = (req.headers['x-span-id'] as string) || crypto.randomBytes(8).toString('hex');
    }

    // Attach to Request and Response headers
    (req as any).trace_id = traceId;
    (req as any).span_id = spanId;
    (req as any).db_query_count = 0;
    (req as any).db_total_duration_ms = 0;

    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-span-id', spanId);
    res.setHeader('traceparent', `00-${traceId.replace(/-/g, '')}-${spanId}-01`);

    // High-resolution start marks
    const startHr = process.hrtime();
    const startCpu = process.cpuUsage();
    const memBefore = process.memoryUsage().heapUsed;

    res.on('finish', () => {
      const hrDiff = process.hrtime(startHr);
      const durationMs = +(hrDiff[0] * 1000 + hrDiff[1] / 1e6).toFixed(2);
      const cpuDiff = process.cpuUsage(startCpu);
      const cpuMicroseconds = cpuDiff.user;
      const memAfter = process.memoryUsage().heapUsed;
      const memDeltaMb = +((memAfter - memBefore) / 1024 / 1024).toFixed(2);

      const statusCode = res.statusCode;

      // Adaptive Log Sampling: Always record errors; sample health endpoints under load
      const isHealthCheck = req.path.includes('/health');
      if (isHealthCheck && statusCode === 200 && Math.random() > 0.05) {
        return;
      }

      // Security Context Extraction
      const authHeader = req.headers.authorization || '';
      let authType = 'None';
      if (authHeader.startsWith('Bearer ')) authType = 'OAuth2-Bearer';
      else if (authHeader.startsWith('Basic ')) authType = 'Basic';
      else if (req.cookies?.token) authType = 'Cookie-Session';

      const userEmail = (req as any).user?.email || '';
      const isTestAccount =
        req.headers['x-test-execution'] === 'true' ||
        userEmail.includes('perf_test_') ||
        userEmail.includes('tenant_test_') ||
        userEmail.includes('demo') ||
        userEmail.includes('test');

      const tenantId =
        (req.headers['x-test-tenant-id'] as string) ||
        (req.headers['x-org-id'] as string) ||
        (req.query.orgId as string) ||
        (req as any).currentOrgId ||
        'system_tenant';

      const level: 'INFO' | 'WARN' | 'ERROR' =
        statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

      const logRecord: StructuredLogRecord = {
        timestamp: new Date().toISOString(),
        level,
        service: serviceName,
        trace_id: traceId,
        span_id: spanId,
        environment: process.env.NODE_ENV || 'development',
        http: {
          method: req.method,
          route: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
          status_code: statusCode,
          duration_ms: durationMs,
          client_ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        },
        security_context: {
          casa_tier: 'Tier-2',
          auth_type: authType,
          is_test_account: isTestAccount,
          tenant_id: tenantId,
        },
        performance: {
          db_query_count: (req as any).db_query_count || 0,
          db_total_duration_ms: (req as any).db_total_duration_ms || 0,
          memory_delta_mb: memDeltaMb,
          cpu_user_microseconds: cpuMicroseconds,
        },
      };

      logBuffer.push(logRecord);
    });

    next();
  };
}
