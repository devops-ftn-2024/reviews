import axios from 'axios';

export const checkAccommodationReview = async(payload: any) => {
    console.log(`Checking if user can leave accommodation review with payload: ${JSON.stringify(payload)}`)
    const response = await axios.post(`${process.env.RESERVATIONS_URL}/review/accommodation`, payload);
    console.log(`Response from checkAccommodationReview: ${JSON.stringify(response.data)}`)
    return !!response.data;
}

export const checkHostReview = async(payload: any) => {
    console.log(`Checking  if user can leave host review with payload: ${JSON.stringify(payload)}`)
    const response = await axios.post(`${process.env.RESERVATIONS_URL}/review/host`, payload);
    console.log(`Response from checkHostReview: ${JSON.stringify(response.data)}`);
    return !!response.data;
}