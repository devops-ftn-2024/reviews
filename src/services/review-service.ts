import { EventQueue } from "../gateway/event-queue";
import { checkAccommodationReview, checkHostReview } from "../gateway/service-actions";
import { ReviewRepository } from "../repository/review-repository";
import { BadRequestError, ForbiddenError, InternalServerError } from "../types/errors";
import { Review, SearchQuery, Type } from "../types/reviews";
import { LoggedUser, Role, UsernameDTO } from "../types/users"
import { parseQuery } from "../util/query";
import { validateReview } from "../util/validation";


export class ReviewService {
    private repository: ReviewRepository;
    private eventQueue: EventQueue;

    constructor() {
        this.repository = new ReviewRepository();
        this.eventQueue = new EventQueue(this);
    }

    async getReview(id: string) {
        if (!id) {
            throw new BadRequestError("Missing id parameter");
        }
        return this.repository.getReview(id);
    }

    async createReview(loggedUser: LoggedUser, reviewInput: Review) {
        if (loggedUser?.role !== Role.GUEST) {
            throw new ForbiddenError("Only guest can leave review");
        }
        if (!loggedUser?.username) {
            throw new BadRequestError("Missing logged user username parameter");
        }
        validateReview(reviewInput);
        const hasPermission = await this.validatePermissionToLeaveReview(loggedUser, reviewInput);
        
        if (!hasPermission) {
            throw new ForbiddenError(`User does not have permission to leave review for this ${reviewInput.type.toLowerCase()}`);
        }

        const review: Review = { 
            ...reviewInput, 
            reviewerUsername: loggedUser.username, 
        };
        let eventDetail;
        const reviewId = await this.repository.createReview(review);
        try {
            const reviewData = {
                rating: review.rating,

            }
            eventDetail = review.type === Type.ACCOMMODATION ? 'accommodation-review-created' : 'host-review-created';
            this.eventQueue.execute(reviewData, eventDetail);
            return {
                _id: reviewId,
                ...review
            };
        } catch (err) {
            console.error(err);
            throw new InternalServerError(`Failed to emit ${eventDetail} event`);
        }
    }

    async getReviewsByUser(user: LoggedUser, query: SearchQuery) {
        const { entityId, hostUsername } = parseQuery(query);
        if (!user?.username) {
            throw new BadRequestError("Missing username parameter");
        }
        if (user.role !== Role.HOST) {
            throw new ForbiddenError("Only hosts can get accommodations by user");
        }
        return this.repository.getReviewsByUser(user.username, entityId, hostUsername);
    }

    async updateUsername(usernameDTO: UsernameDTO) {
        if (!usernameDTO?.oldUsername || !usernameDTO?.newUsername) {
            throw new BadRequestError("Missing username parameter");
        }
        return this.repository.updateUsername(usernameDTO);
    }

    private async validatePermissionToLeaveReview(loggedUser: LoggedUser, review: Review) {
        if (review.type === Type.ACCOMMODATION) {
            const payload = {
                accommodationId: review.entityId,
                reviewerUsername: loggedUser.username
            }
            return await checkAccommodationReview(payload);
        }
        const payload = {
            hostUsername: review.hostUsername,
            reviewerUsername: loggedUser.username
        };
        return await checkHostReview(payload);
    }

    public async updateReview(loggedUser: LoggedUser, id: string, reviewInput: Review) {
        if (!loggedUser?.role || loggedUser.role !== Role.GUEST) {
            throw new ForbiddenError("Only guest can update review");
        }
        if (!loggedUser?.username) {
            throw new BadRequestError("Missing logged user username parameter");
        }
        const review = await this.repository.getReview(id);
        if (!review) {
            throw new BadRequestError("Review not found");
        }
        if (review.reviewerUsername !== loggedUser.username) {
            throw new ForbiddenError("User does not have permission to update review");
        }
        return this.repository.updateReview(id, reviewInput);
    }

    public async deleteReview(loggedUser: LoggedUser, id: string) {
        if (!loggedUser?.role || loggedUser.role !== Role.GUEST) {
            throw new ForbiddenError("Only guest can delete review");
        }
        if (!loggedUser?.username) {
            throw new BadRequestError("Missing logged user username parameter");
        }
        const review = await this.repository.getReview(id);
        if (!review) {
            throw new BadRequestError("Review not found");
        }
        if (review.reviewerUsername !== loggedUser.username) {
            throw new ForbiddenError("User does not have permission to delete review");
        }
        return this.repository.deleteReview(id);
    }
}