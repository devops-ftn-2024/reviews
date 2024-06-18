import { Collection, Filter, MongoClient, ObjectId } from "mongodb";
import { Review } from "../types/reviews";
import { UsernameDTO } from "../types/users";

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
        return this.collection.findOne({ '_id': new ObjectId(id) });
    }

    async createReview(review: Review) {
        const {_id, ...reviewData} = review;
        const result = await this.collection.insertOne(reviewData);
        console.log(result);
        return result.insertedId;
    }

    async getReviewsByUser(username: string, entityId: string, hostUsername: string) {
        const filter = { reviewerUsername: username };
        if (entityId) {
            filter['entityId'] = entityId;
        }
        if (hostUsername) {
            filter['hostUsername'] = hostUsername;
        }
        console.log(`Getting reviews with filter: ${JSON.stringify(filter)}`)
        return this.collection.find(filter).toArray();
    }

    async updateUsername(usernameDTO: UsernameDTO) {
        const { oldUsername, newUsername } = usernameDTO;
        const result = await this.collection.updateMany({ reviewerUsername: oldUsername }, { $set: { reviewerUsername: newUsername } });
        return result.modifiedCount;
    }

    async updateReview(id: string, reviewInput: Review) {
        const filter = { '_id': new ObjectId(id) };
        let updateQuery: Filter<MongoReview> = { $set: {} };

        if (reviewInput.rating && reviewInput.rating >= 1 && reviewInput.rating <= 5) {
            updateQuery.$set.rating = reviewInput.rating;
        }
        if (reviewInput.comment) {
            updateQuery.$set.comment = reviewInput.comment;
        }

        if (Object.keys(updateQuery.$set).length > 0) {
            const result = await this.collection.updateOne(filter, updateQuery);
            return result.modifiedCount > 0;
        }
        return false;
    }

    async deleteReview(id: string) {
        const result = await this.collection.deleteOne({ '_id': new ObjectId(id) });
        return result.deletedCount > 0;
    }
}