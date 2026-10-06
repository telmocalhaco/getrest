const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,99}$/;
const RESERVED_VARIABLE_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function variableNameError(name: string): "invalid" | "reserved" | null {
  if (name !== name.trim() || !VARIABLE_NAME.test(name)) return "invalid";
  if (RESERVED_VARIABLE_NAMES.has(name.toLowerCase())) return "reserved";
  return null;
}
