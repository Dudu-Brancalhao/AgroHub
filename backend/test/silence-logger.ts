import { Logger } from '@nestjs/common';

// Keeps suite output readable. Log CONTENT is asserted separately by test/security/log-leak.spec.ts,
// which runs the suites with logging on and scans the output.
Logger.overrideLogger(false);
