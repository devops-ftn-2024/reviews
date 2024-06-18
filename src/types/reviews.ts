import { ObjectId } from "mongodb";

export interface Review {
    _id?: string | ObjectId;
    type: Type;
    entityId?: string;
    hostUsername?: string;
    comment?: string;
    rating: number;
    reviewerUsername: string;
}

export enum Type {
    HOST = 'Host',
    ACCOMMODATION = 'Accommodation',
}

export interface SearchQuery {
    entityId?: string,
    hostUsername?: string,
}