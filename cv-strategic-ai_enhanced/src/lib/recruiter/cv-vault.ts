import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const configured = process.env.RECRUITER_CV_ENCRYPTION_KEY?.trim();
  if (!configured) {
    const error = new Error("Recruiter CV storage is not configured. Set RECRUITER_CV_ENCRYPTION_KEY in the deployment environment.");
    Object.assign(error, { status: 503, code: "RECRUITER_STORAGE_NOT_CONFIGURED" });
    throw error;
  }
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(configured)) key = Buffer.from(configured, "hex");
  else key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    const error = new Error("RECRUITER_CV_ENCRYPTION_KEY must encode exactly 32 random bytes (64 hex characters or base64).");
    Object.assign(error, { status: 503 });
    throw error;
  }
  return key;
}

export function encryptCvText(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decryptCvText(input: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function encryptSensitiveText(value: string): string {
  return JSON.stringify({ version: 1, ...encryptCvText(value) });
}

export function decryptSensitiveText(value: string): string {
  const envelope = JSON.parse(value) as { version?: number; ciphertext: string; iv: string; tag: string };
  if (envelope.version !== 1) throw new Error("Unsupported encrypted recruiter data format.");
  return decryptCvText(envelope);
}

export function encryptRecruiterPayload(value: unknown) {
  return { encrypted: true, ...encryptCvText(JSON.stringify(value)) };
}

export function decryptRecruiterPayload<T>(value: unknown): T {
  if (!value || typeof value !== "object" || !("encrypted" in value) || (value as {encrypted?:boolean}).encrypted !== true) {
    return value as T;
  }
  const envelope=value as unknown as {ciphertext:string;iv:string;tag:string};
  return JSON.parse(decryptCvText(envelope)) as T;
}
