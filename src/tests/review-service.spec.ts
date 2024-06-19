
import { BadRequestError, ForbiddenError } from '../types/errors';
import { Role } from '../types/users';
import { Type } from '../types/reviews';
import { ReviewRepository } from '../repository/review-repository';
import { ReviewService } from '../services/review-service';
import { EventQueue } from '../gateway/event-queue';
import { ObjectId } from 'mongodb';

jest.mock('../repository/review-repository');
jest.mock('../gateway/event-queue');

describe('ReviewService', () => {
    let reviewService: ReviewService;
    let reviewRepositoryMock: jest.Mocked<ReviewRepository>;
    let eventQueueMock: jest.Mocked<EventQueue>;

    beforeEach(() => {
        reviewRepositoryMock = new ReviewRepository() as jest.Mocked<ReviewRepository>;
        reviewService = new ReviewService();
        eventQueueMock = new EventQueue(reviewService) as jest.Mocked<EventQueue>;
        reviewService['repository'] = reviewRepositoryMock
        reviewService['eventQueue'] = eventQueueMock;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getReview', () => {
        it('should fetch a review successfully', async () => {
            const mockReviewId = '1';
            const mockReview = { _id:  new ObjectId(1), type: Type.ACCOMMODATION, entityId: '123', rating: 4, reviewerUsername: 'guestuser' };
            reviewRepositoryMock.getReview.mockResolvedValue(mockReview);

            const result = await reviewService.getReview(mockReviewId);

            expect(result).toEqual(mockReview);
            expect(reviewRepositoryMock.getReview).toHaveBeenCalledWith(mockReviewId);
        });

        it('should throw BadRequestError for missing id parameter', async () => {
            await expect(reviewService.getReview('')).rejects.toThrow(BadRequestError);
        });
    });

    describe('createReview', () => {
        it('should throw ForbiddenError for non-guest users', async () => {
            const loggedUser = { username: 'hostuser', role: Role.HOST };
            const reviewInput = { type: Type.ACCOMMODATION, entityId: '123', rating: 5, reviewerUsername: 'hostuser' };

            await expect(reviewService.createReview(loggedUser, reviewInput)).rejects.toThrow(ForbiddenError);
        });
    });

    describe('getReviewsByUser', () => {
        it('should fetch reviews by user successfully', async () => {
            const loggedUser = { username: 'hostuser', role: Role.HOST };
            const query = { entityId: '123', hostUsername: 'hostuser' };
            const mockReviews = [
                { _id: new ObjectId(1), type: Type.ACCOMMODATION, entityId: '123', rating: 4, reviewerUsername: 'guestuser' },
                { _id: new ObjectId(2), type: Type.HOST, hostUsername: 'hostuser', rating: 5, reviewerUsername: 'guestuser' }
            ];

            reviewRepositoryMock.getReviewsByUser.mockResolvedValue(mockReviews);

            const result = await reviewService.getReviewsByUser(loggedUser, query);

            expect(result).toEqual(mockReviews);
            expect(reviewRepositoryMock.getReviewsByUser).toHaveBeenCalledWith(loggedUser.username, query.entityId, query.hostUsername);
        });

        it('should throw BadRequestError for missing username parameter', async () => {
            const loggedUser = { username: '', role: Role.HOST };
            const query = { entityId: '123', hostUsername: 'hostuser' };

            await expect(reviewService.getReviewsByUser(loggedUser, query)).rejects.toThrow(BadRequestError);
        });

        it('should throw ForbiddenError for non-host users', async () => {
            const loggedUser = { username: 'guestuser', role: Role.GUEST };
            const query = { entityId: '123', hostUsername: 'hostuser' };

            await expect(reviewService.getReviewsByUser(loggedUser, query)).rejects.toThrow(ForbiddenError);
        });
    });

    describe('updateUsername', () => {
        it('should update usernames successfully', async () => {
            const usernameDTO = { oldUsername: 'olduser', newUsername: 'newuser' };
            const mockModifiedCount = 1;

            reviewRepositoryMock.updateUsername.mockResolvedValue(mockModifiedCount);

            const result = await reviewService.updateUsername(usernameDTO);

            expect(result).toBe(mockModifiedCount);
            expect(reviewRepositoryMock.updateUsername).toHaveBeenCalledWith(usernameDTO);
        });

        it('should throw BadRequestError for missing username parameters', async () => {
            const usernameDTO = { oldUsername: '', newUsername: 'newuser' };

            await expect(reviewService.updateUsername(usernameDTO)).rejects.toThrow(BadRequestError);
        });
    });

    describe('updateReview', () => {
        it('should update a review successfully', async () => {
            const loggedUser = { username: 'guestuser', role: Role.GUEST };
            const mockReviewId = '1';
            const reviewInput = { type: Type.ACCOMMODATION, entityId: '123', rating: 5, reviewerUsername: 'guestuser' };
            const updatedReview = { ...reviewInput, _id: new ObjectId(1) };

            reviewRepositoryMock.getReview.mockResolvedValue(updatedReview);
            reviewRepositoryMock.updateReview.mockResolvedValue(true);

            const result = await reviewService.updateReview(loggedUser, mockReviewId, reviewInput);

            expect(result).toBe(true);
            expect(reviewRepositoryMock.updateReview).toHaveBeenCalledWith(mockReviewId, reviewInput);
        });

        it('should throw BadRequestError when review is not found', async () => {
            const loggedUser = { username: 'guestuser', role: Role.GUEST };
            const mockReviewId = 'review123';
            const reviewInput = { type: Type.ACCOMMODATION, entityId: '123', rating: 5, reviewerUsername: 'guestuser' };

            reviewRepositoryMock.getReview.mockResolvedValue(null);

            await expect(reviewService.updateReview(loggedUser, mockReviewId, reviewInput)).rejects.toThrow(BadRequestError);
        });

        it('should throw ForbiddenError when user does not have permission to update review', async () => {
            const loggedUser = { username: 'anotheruser', role: Role.GUEST };
            const mockReviewId = '1';
            const reviewInput = { type: Type.ACCOMMODATION, entityId: '123', rating: 5, reviewerUsername: 'guestuser' };
            const existingReview = { _id:  new ObjectId(1), type: Type.ACCOMMODATION, entityId: '123', rating: 4, reviewerUsername: 'guestuser' };

            reviewRepositoryMock.getReview.mockResolvedValue(existingReview);

            await expect(reviewService.updateReview(loggedUser, mockReviewId, reviewInput)).rejects.toThrow(ForbiddenError);
        });
    });

    describe('deleteReview', () => {
        it('should delete a review successfully', async () => {
            const loggedUser = { username: 'guestuser', role: Role.GUEST };
            const mockReviewId = '1';
            const existingReview = { _id:  new ObjectId(1), type: Type.ACCOMMODATION, entityId: '123', rating: 4, reviewerUsername: 'guestuser' };

            reviewRepositoryMock.getReview.mockResolvedValue(existingReview);
            reviewRepositoryMock.deleteReview.mockResolvedValue(true);

            const result = await reviewService.deleteReview(loggedUser, mockReviewId);

            expect(result).toBe(true);
            expect(reviewRepositoryMock.deleteReview).toHaveBeenCalledWith(mockReviewId);
        });

        it('should throw BadRequestError when review is not found', async () => {
            const loggedUser = { username: 'guestuser', role: Role.GUEST };
            const mockReviewId = 'review123';

            reviewRepositoryMock.getReview.mockResolvedValue(null);

            await expect(reviewService.deleteReview(loggedUser, mockReviewId)).rejects.toThrow(BadRequestError);
        });

        it('should throw ForbiddenError when user does not have permission to delete review', async () => {
            const loggedUser = { username: 'anotheruser', role: Role.GUEST };
            const mockReviewId = '1';
            const existingReview = { _id:  new ObjectId(1), type: Type.ACCOMMODATION, entityId: '123', rating: 4, reviewerUsername: 'guestuser' };

            reviewRepositoryMock.getReview.mockResolvedValue(existingReview);

            await expect(reviewService.deleteReview(loggedUser, mockReviewId)).rejects.toThrow(ForbiddenError);
        });
    });
});
