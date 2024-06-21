import { Collection, Filter, MongoClient, ObjectId } from "mongodb";
import { Review } from "../types/reviews";
import { UsernameDTO } from "../types/users";
import { Logger } from "../util/logger";

interface MongoReview extends Omit<Review, '_id'> {
    _id?: ObjectId;
}


export class ReviewRepository {

    private client: MongoClient;
    private database_name: string;
    private collection_name: string;
    private collection: Collection<MongoReview>;

    constructor() {
        if (!process.env.MONGO_URI) {
            throw new Error("Missing MONGO_URI environment variable");
        }
        if (!process.env.MONGO_DB_NAME) {
            throw new Error("Missing MONGO_DB_NAME environment variable");
        }
        if (!process.env.MONGO_COLLECTION_NAME) {
            throw new Error("Missing MONGO_COLLECTION_NAME environment variable");
        }
        this.client = new MongoClient(process.env.MONGO_URI);
        this.database_name = process.env.MONGO_DB_NAME;
        this.collection_name = process.env.MONGO_COLLECTION_NAME;
        this.collection = this.client.db(this.database_name).collection(this.collection_name);
    }

    async getReview(id: string) {
        Logger.log(`Getting review with id: ${id}`);
        return this.collection.findOne({ '_id': new ObjectId(id) });
    }

    async createReview(review: Review) {
        Logger.log('Creating new review');
        const {_id, ...reviewData} = review;
        const result = await this.collection.insertOne(reviewData);
        Logger.log(`New review created with id: ${result.insertedId}`);
        return result.insertedId;
    }

    async getReviewsByUser(username: string, entityId: string, hostUsername: string) {
        Logger.log(`Getting all reviews which belongs to user: ${username}`);
        const filter = { reviewerUsername: username };
        if (entityId) {
            filter['entityId'] = entityId;
        }
        if (hostUsername) {
            filter['hostUsername'] = hostUsername;
        }
        Logger.log(`Getting reviews with filter: ${JSON.stringify(filter)}`)
        return this.collection.find(filter).toArray();
    }

    async getReviewsByAccommodation(accommodationId: string) {
        Logger.log(`Getting all reviews which belongs to accommodation with id: ${accommodationId}`);
        return this.collection.find({ entityId: accommodationId }).toArray();
    }

    async getReviewsByHost(hostUsername: string) {
        Logger.log(`Getting all reviews which belongs to host with id: ${hostUsername}`);
        return this.collection.find({ hostUsername: hostUsername }).toArray();
    }

    async updateUsername(usernameDTO: UsernameDTO) {
        Logger.log(`Updating username from ${usernameDTO.oldUsername} to ${usernameDTO.newUsername}`);
        const { oldUsername, newUsername } = usernameDTO;
        const result = await this.collection.updateMany({ reviewerUsername: oldUsername }, { $set: { reviewerUsername: newUsername } });
        const resultHosts = await this.collection.updateMany({ hostUsername: oldUsername }, { $set: { hostUsername: newUsername } });
        Logger.log(`Updated ${result.modifiedCount} reviews and ${resultHosts.modifiedCount} hosts`);
        return result.modifiedCount > 0 || resultHosts.modifiedCount > 0;
    }

    async updateReview(id: string, reviewInput: Review) {
        Logger.log(`Updating review with id: ${id}`);
        const filter = { '_id': new ObjectId(id) };
        let updateQuery: Filter<MongoReview> = { $set: {} };

        if (reviewInput.rating && reviewInput.rating >= 1 && reviewInput.rating <= 5) {
            updateQuery.$set.rating = reviewInput.rating;
        }
        if (reviewInput.comment) {
            updateQuery.$set.comment = reviewInput.comment;
        }

        Logger.log(`Updating review with query: ${JSON.stringify(updateQuery)}`);
        if (Object.keys(updateQuery.$set).length > 0) {
            const result = await this.collection.updateOne(filter, updateQuery);
            return result.modifiedCount > 0;
        }
        return false;
    }

    async deleteReview(id: string) {
        Logger.log(`Deleting review with id: ${id}`);
        const result = await this.collection.deleteOne({ '_id': new ObjectId(id) });
        Logger.log(`Deleted ${result.deletedCount} reviews`);
        return result.deletedCount > 0;
    }
}