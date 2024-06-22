import axios from 'axios';
import { Logger } from '../util/logger';

export const checkAccommodationReview = async(payload: any) => {
    Logger.log(`Checking if user can leave accommodation review with payload: ${JSON.stringify(payload)}`)
    const response = await axios.post(`${process.env.RESERVATIONS_URL}/review/accommodation`, payload);
    Logger.log(`Response from checkAccommodationReview: ${JSON.stringify(response.data)}`)
    return !!response.data;
}

export const checkHostReview = async(payload: any) => {
    Logger.log(`Checking  if user can leave host review with payload: ${JSON.stringify(payload)}`)
    const response = await axios.post(`${process.env.RESERVATIONS_URL}/review/host`, payload);
    Logger.log(`Response from checkHostReview: ${JSON.stringify(response.data)}`);
    return !!response.data;
}