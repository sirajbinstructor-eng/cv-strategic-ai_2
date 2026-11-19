import { calculateDiscount, type ApplyDiscountInput, type ReviewDiscountInput } from "./model";
import { DiscountRepository } from "./repository";
import { areDiscountDocumentsVerifiable } from "@/lib/verification/document-upload-gate";

const repository = new DiscountRepository();

export class DiscountService {
  async current(userId: string) { return repository.getCurrent(userId); }

  async apply(userId: string, input: ApplyDiscountInput) {
    const eligibility = calculateDiscount(input);
    return repository.submit(userId, input, eligibility.percent);
  }

  async list(status?: string, limit?: number, offset?: number) {
    return repository.list(status, limit, offset);
  }

  async review(id: string, reviewerId: string, input: ReviewDiscountInput) {
    if(input.decision==="approved") {
      const application=await repository.getById(id);
      if(application&&application.category!=="early_career"&&!areDiscountDocumentsVerifiable()) throw Object.assign(new Error("Student and recent-graduate discount approval is blocked until secure document uploads and manual evidence review are enabled."),{status:409});
    }
    return repository.review(id, reviewerId, input);
  }
}
