/**
 * Secure document verification is intentionally fail-closed.
 * Do not change STORAGE_ADAPTER_READY until a private object-storage adapter,
 * signed upload flow, access policy, audit trail and deletion job are implemented and tested.
 */
const STORAGE_ADAPTER_READY = false;
export function getDocumentUploadGate(){
 const explicitlyEnabled=process.env.DISCOUNT_DOCUMENT_UPLOADS_ENABLED==="true";
 const storageConfigured=Boolean(process.env.PRIVATE_DOCUMENT_STORAGE_BUCKET&&process.env.PRIVATE_DOCUMENT_STORAGE_REGION&&process.env.PRIVATE_DOCUMENT_STORAGE_ACCESS_KEY_ID&&process.env.PRIVATE_DOCUMENT_STORAGE_SECRET_ACCESS_KEY);
 const enabled=explicitlyEnabled&&storageConfigured&&STORAGE_ADAPTER_READY;
 return {enabled,reason:enabled?null:!explicitlyEnabled?"Document uploads are disabled by default.":!storageConfigured?"Private document storage is not fully configured.":"The secure storage adapter and review controls have not been approved for activation."};
}
export const ACCEPTED_VERIFICATION_DOCUMENTS={
 nationality:["tunisian_cin","tunisian_passport","tunisian_driving_licence"],
 student:["current_student_card"],
 recent_graduate:["latest_diploma","graduation_certificate"]
} as const;
export const DOCUMENT_UPLOAD_LIMITS={maxBytes:10*1024*1024,allowedMimeTypes:["application/pdf","image/jpeg","image/png"] as const};
