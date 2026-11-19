import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import type { ApplyDiscountInput, ReviewDiscountInput } from "./model";

const columns = `id,user_id,category,nationality,nationality_evidence_type,student_evidence_type,graduation_date,no_work_since_graduation,professional_experience_months,discount_percent,status,review_notes,reviewed_by,reviewed_at,created_at,updated_at`;

export class DiscountRepository {
  async getById(id:string) {
    const result=await pool.query(`SELECT ${columns} FROM discount_applications WHERE id=$1 LIMIT 1`,[id]);
    return result.rows[0]||null;
  }

  async getCurrent(userId: string) {
    const result = await pool.query(`SELECT ${columns} FROM discount_applications WHERE user_id=$1 AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1`, [userId]);
    return result.rows[0] || null;
  }

  async submit(userId: string, input: ApplyDiscountInput, percent: number) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId]);
      const current = await client.query("SELECT id FROM discount_applications WHERE user_id=$1 AND status IN ('pending','approved') LIMIT 1", [userId]);
      if (current.rowCount) throw Object.assign(new Error("You already have a pending or approved discount application."), { status: 409 });
      const id = randomUUID();
      const result = await client.query(
        `INSERT INTO discount_applications
        (id,user_id,category,nationality,nationality_evidence_type,student_evidence_type,graduation_date,no_work_since_graduation,professional_experience_months,discount_percent,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING ${columns}`,
        [id,userId,input.category,input.nationality,input.nationalityEvidenceType || null,input.studentEvidenceType || null,input.graduationDate || null,input.noWorkSinceGraduation ?? null,input.professionalExperienceMonths ?? null,percent]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async list(status?: string, limit = 50, offset = 0) {
    const values: unknown[] = [];
    const where = status ? "WHERE d.status=$1" : "";
    if (status) values.push(status);
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM discount_applications d " + where, values);
    const rows = await pool.query(
      `SELECT ${columns.split(",").map(c => c.includes("_") || c === "id" ? "d."+c : "d."+c).join(",")}, u.name AS applicant_name, u.email AS applicant_email
       FROM discount_applications d JOIN "user" u ON u.id=d.user_id ${where}
       ORDER BY d.created_at DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,
      [...values,limit,offset]
    );
    return { applications: rows.rows, total: Number(count.rows[0]?.total || 0) };
  }

  async review(id: string, reviewerId: string, input: ReviewDiscountInput) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT id,status FROM discount_applications WHERE id=$1 FOR UPDATE", [id]);
      if (!current.rowCount) throw Object.assign(new Error("Discount application not found."), { status: 404 });
      if (current.rows[0].status !== "pending" && input.decision !== "revoked") {
        throw Object.assign(new Error("Only pending applications can be approved or rejected."), { status: 409 });
      }
      const result = await client.query(
        `UPDATE discount_applications SET status=$2,review_notes=$3,reviewed_by=$4,reviewed_at=NOW(),updated_at=NOW()
         WHERE id=$1 RETURNING ${columns}`,
        [id,input.decision,input.reviewNotes || null,reviewerId]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}
