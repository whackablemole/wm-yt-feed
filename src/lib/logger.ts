type LogLevel = 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

function serializeError(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function log(level: LogLevel, message: string, fields?: LogFields): void {
  const entry = { level, message, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry, serializeError);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};
