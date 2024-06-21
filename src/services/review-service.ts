import { EventQueue } from "../gateway/event-queue";
import { checkAccommodationReview, checkHostReview } from "../gateway/service-actions";
import { ReviewRepository } from "../repository/review-repository";
import { BadRequestError, ForbiddenError, InternalServerError } from "../types/errors";
import { Review, SearchQuery, Type } from "../types/reviews";
import { LoggedUser, Role, UsernameDTO } from "../types/users"
import { Logger } from "../util/logger";
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
        Logger.log(`Getting review with id: ${id}`);
        if (!id) {
            Logger.error("Missing id parameter");
            throw new BadRequestError("Missing id parameter");
        }
        return this.repository.getReview(id);
    }

    async createReview(loggedUser: LoggedUser, reviewInput: Review) {
        Logger.log('Creating new review');
        if (loggedUser?.role !== Role.GUEST) {
            Logger.error("Only guest can leave review");
            throw new ForbiddenError("Only guest can leave review");
        }
        if (!loggedUser?.username) {
            Logger.error("Missing logged user username parameter");
            throw new BadRequestError("Missing logged user username parameter");
        }
        validateReview(reviewInput);
        const hasPermission = await this.validatePermissionToLeaveReview(loggedUser, reviewInput);
        
        if (!hasPermission) {
            Logger.error(`User does not have permission to leave review for this ${reviewInput.type.toLowerCase()}`);
            throw new ForbiddenError(`User does not have permission to leave review for this ${reviewInput.type.toLowerCase()}`);
        }

        const review: Review = { 
            ...reviewInput, 
            reviewerUsername: loggedUser.username, 
        };
        let eventDetail;
        Logger.log(`Creating review: ${JSON.stringify(review)}`);
        const reviewId = await this.repository.createReview(review);
        try {
            Logger.log(`Emmiting event for ${review.type === Type.ACCOMMODATION ? 'accommodation' : 'host'} review created`);
            const reviewData = {
                rating: review.rating,

            }
            eventDetail = review.type === Type.ACCOMMODATION ? 'accommodation-review-created' : 'host-review-created';
            this.eventQueue.execute(reviewData, eventDetail);
            Logger.log(`Event ${eventDetail} emitted`);
            return {
                _id: reviewId,
                ...review
            };
        } catch (err) {
            console.error(err);
            Logger.error(`Failed to emit ${eventDetail} event`);
            throw new InternalServerError(`Failed to emit ${eventDetail} event`);
        }
    }

    async getReviewsByUser(user: LoggedUser, query: SearchQuery) {
        Logger.log(`Getting all reviews which belongs to user: ${user.username}`);
        const { entityId, hostUsername } = parseQuery(query);
        if (!user?.username) {
            Logger.error("Missing logged user username parameter");
            throw new BadRequestError("Missing username parameter");
        }
        return this.repository.getReviewsByUser(user.username, entityId, hostUsername);
    }

    async getReviewsByAccommodation(id: string) {
        Logger.log(`Getting all reviews which belongs to accommodation with id: ${id}`);
        if (!id) {
            Logger.error("Missing id parameter");
            throw new BadRequestError("Missing id parameter");
        }
        return this.repository.getReviewsByAccommodation(id);
    }

    async getReviewsByHost(username: string) {
        Logger.log(`Getting all reviews which belongs to host with username: ${username}`);
        if (!username) {
            Logger.error("Missing id parameter");
            throw new BadRequestError("Missing id parameter");
        }
        return this.repository.getReviewsByHost(username);
    }

    async updateUsername(usernameDTO: UsernameDTO) {
        Logger.log(`Updating username from ${usernameDTO.oldUsername} to ${usernameDTO.newUsername}`);
        if (!usernameDTO?.oldUsername || !usernameDTO?.newUsername) {
            Logger.error("Missing username parameter");
            throw new BadRequestError("Missing username parameter");
        }
        return this.repository.updateUsername(usernameDTO);
    }

    private async validatePermissionToLeaveReview(loggedUser: LoggedUser, review: Review) {
        Logger.log(`Checking permission to leave review for ${review.type.toLowerCase()}`);
        if (review.type === Type.ACCOMMODATION) {
            const payload = {
                accommodationId: review.entityId,
                reviewerUsername: loggedUser.username
            }
            Logger.log(`Checking accommodation review permission: ${JSON.stringify(payload)}`);
            return await checkAccommodationReview(payload);
        }
        const payload = {
            hostUsername: review.hostUsername,
            reviewerUsername: loggedUser.username
        };
        Logger.log(`Checking host review permission: ${JSON.stringify(payload)}`);
        return await checkHostReview(payload);
    }

    public async updateReview(loggedUser: LoggedUser, id: string, reviewInput: Review) {
        Logger.log(`Updating review with id: ${id}`);
        if (!loggedUser?.role || loggedUser.role !== Role.GUEST) {
            Logger.error("Only guest can update review");
            throw new ForbiddenError("Only guest can update review");
        }
        if (!loggedUser?.username) {
            Logger.error("Missing logged user username parameter");
            throw new BadRequestError("Missing logged user username parameter");
        }
        const review = await this.repository.getReview(id);
        if (!review) {
            Logger.error("Review not found");
            throw new BadRequestError("Review not found");
        }
        if (review.reviewerUsername !== loggedUser.username) {
            Logger.error("User does not have permission to update review");
            throw new ForbiddenError("User does not have permission to update review");
        }
        return this.repository.updateReview(id, reviewInput);
    }

    public async deleteReview(loggedUser: LoggedUser, id: string) {
        Logger.log(`Deleting review with id: ${id}`);
        if (!loggedUser?.role || loggedUser.role !== Role.GUEST) {
            Logger.error("Only guest can delete review");
            throw new ForbiddenError("Only guest can delete review");
        }
        if (!loggedUser?.username) {
            Logger.error("Missing logged user username parameter");
            throw new BadRequestError("Missing logged user username parameter");
        }
        const review = await this.repository.getReview(id);
        if (!review) {
            Logger.error("Review not found");
            throw new BadRequestError("Review not found");
        }
        if (review.reviewerUsername !== loggedUser.username) {
            Logger.error("User does not have permission to delete review");
            throw new ForbiddenError("User does not have permission to delete review");
        }
        return this.repository.deleteReview(id);
    }

    public async deleteUser(username: string) {
        Logger.log(`Deleting reviews with username: ${username}`);
        if (!username) {
            Logger.error("Missing username parameter");
            throw new BadRequestError("Missing username parameter");
        }
        return this.repository.deleteUser(username);
    }
}