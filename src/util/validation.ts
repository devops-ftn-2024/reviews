import { BadRequestError } from "../types/errors";
import { Review, Type } from "../types/reviews";
import { Logger } from "./logger";

export const validateReview = (review: Review) => {
    if (!review) {
        Logger.error("Missing review parameter");
        throw new BadRequestError("Missing review parameter");
    }
    if (!review.type) {
        Logger.error("Missing review type parameter");
        throw new BadRequestError("Missing review type parameter");
    }
    if (review.type === Type.ACCOMMODATION && !review.entityId) {
        Logger.error("Missing review entityId parameter");
        throw new BadRequestError("Missing review entityId parameter");
    }
    if (review.type === Type.HOST && !review.hostUsername) {
        Logger.error("Missing review hostUsername parameter");
        throw new BadRequestError("Missing review hostUsername parameter");
    }
    if (!review.rating) {
        Logger.error("Missing review rating parameter");
        throw new BadRequestError("Missing review rating parameter");
    }
    if (review.rating < 1 || review.rating > 5) {
        Logger.error("Invalid review rating parameter");
        throw new BadRequestError("Invalid review rating parameter");
    }
};
