import { BadRequestError } from "../types/errors";
import { Review, Type } from "../types/reviews";

export const validateReview = (review: Review) => {
    if (!review) {
        throw new BadRequestError("Missing review parameter");
    }
    if (!review.type) {
        throw new BadRequestError("Missing review type parameter");
    }
    if (review.type === Type.ACCOMMODATION && !review.entityId) {
        throw new BadRequestError("Missing review entityId parameter");
    }
    if (review.type === Type.HOST && !review.hostUsername) {
        throw new BadRequestError("Missing review hostUsername parameter");
    }
    if (!review.rating) {
        throw new BadRequestError("Missing review rating parameter");
    }
    if (review.rating < 1 || review.rating > 5) {
        throw new BadRequestError("Invalid review rating parameter");
    }
};
