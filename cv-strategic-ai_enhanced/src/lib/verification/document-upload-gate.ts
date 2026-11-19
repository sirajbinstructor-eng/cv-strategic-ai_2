const STORAGE_ADAPTER_READY=false;
export function areDiscountDocumentsVerifiable(){
 const explicitlyEnabled=process.env.DISCOUNT_DOCUMENT_UPLOADS_ENABLED==="true";
 const storageConfigured=Boolean(process.env.PRIVATE_DOCUMENT_STORAGE_BUCKET&&process.env.PRIVATE_DOCUMENT_STORAGE_REGION&&process.env.PRIVATE_DOCUMENT_STORAGE_ACCESS_KEY_ID&&process.env.PRIVATE_DOCUMENT_STORAGE_SECRET_ACCESS_KEY);
 return explicitlyEnabled&&storageConfigured&&STORAGE_ADAPTER_READY;
}
