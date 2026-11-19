import { calculateDiscount, type ApplyDiscountInput, type ReviewDiscountInput } from "./model";
import { DiscountRepository } from "./repository";

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
    return repository.review(id, reviewerId, input);
  }
}
