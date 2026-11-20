import test from "node:test";
import assert from "node:assert/strict";
import { encryptCvText, decryptCvText, encryptSensitiveText, decryptSensitiveText, encryptRecruiterPayload, decryptRecruiterPayload } from "../src/lib/recruiter/cv-vault";

process.env.RECRUITER_CV_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("hex");

test("recruiter CV text is encrypted and round-trips with AES-256-GCM",()=>{
 const plain="Candidate CV with private employment history and contact details.";
 const encrypted=encryptCvText(plain);
 assert.notEqual(encrypted.ciphertext,Buffer.from(plain).toString("base64"));
 assert.equal(decryptCvText(encrypted),plain);
});

test("encrypted candidate filename is not stored as readable text",()=>{
 const filename="Siraj Bouasker - CV.pdf";
 const encrypted=encryptSensitiveText(filename);
 assert.equal(encrypted.includes(filename),false);
 assert.equal(decryptSensitiveText(encrypted),filename);
});

test("recruiter evaluation result payload round-trips without plaintext persistence",()=>{
 const result={candidateName:"Candidate Example",match:{score:87},evidence:["TypeScript","React"]};
 const encrypted=encryptRecruiterPayload(result);
 assert.equal(encrypted.encrypted,true);
 assert.equal(encrypted.ciphertext.includes("Candidate Example"),false);
 assert.deepEqual(decryptRecruiterPayload(encrypted),result);
});

test("tampered recruiter ciphertext is rejected",()=>{
 const encrypted=encryptCvText("confidential");
 const tampered={...encrypted,ciphertext:Buffer.from("tampered").toString("base64")};
 assert.throws(()=>decryptCvText(tampered));
});
