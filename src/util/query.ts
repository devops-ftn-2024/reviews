import { SearchQuery } from "../types/reviews";


export const parseQuery = (query): SearchQuery => {
    let validQuery: SearchQuery = {};
    if (query.entityId) {
        if (Array.isArray(query.entityId)) {
            validQuery.entityId = query.entityId[0].split('/')[0];
        } else {
            validQuery.entityId = query.entityId.split('/')[0];
        }
    }
    if (query.hostUsername) {
        if (Array.isArray(query.endDate)) {
            validQuery.hostUsername = query.hostUsername[0].split('/')[0];
        } else {
            validQuery.hostUsername = query.hostUsername.split('/')[0];
        }
    }
    return validQuery;
};