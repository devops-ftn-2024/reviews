import express from 'express';
import bodyParser from 'body-parser';
import { CustomError, NotFoundError } from './types/errors';
import cors from 'cors';
import { ReviewService } from './services/review-service';
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

const corsOptions = {
    origin: process.env.ALLOWED_ORIGIN,
    optionsSuccessStatus: 200,
  };

const reviewService = new ReviewService();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cors(corsOptions));


app.get('/reviews/health', (req, res) => {
  return res.status(200).json({message: "Hello, World!"});
})

app.get('/reviews/:id', async (req, res) => {
    console.log(`Getting review with id: ${req.params.id}`);
    try {
        const accommodation = await reviewService.getReview(req.params.id);
        return res.json(accommodation);
    } catch (err) {
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.post('/reviews', async (req, res) => {
    console.log('Creating new review');
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
          throw new NotFoundError('User data not provided');
        }
        const userData = JSON.parse(userDataStr as string);
        console.log(`Logged user: ${JSON.stringify(userData)}`);
        const newReviewId = await reviewService.createReview(userData, req.body);
        return res.status(201).json({ id: newReviewId });
    } catch (err) {
        const code = err instanceof CustomError ? err.code : 500;
        return res.status(code).json({ message: (err as Error).message });
    }
});

app.get('/reviews/', async (req, res) => {
    console.log(`Getting all reviews which belongs to user: ${JSON.stringify(req.headers.user)}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        const reviews = await reviewService.getReviewsByUser(userData, req.query);
        return res.json(reviews);
    } catch (err) {
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.put('/reviews/:id', async (req, res) => {
    console.log(`Updating review with id: ${req.params.id}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        const accommodation = await reviewService.updateReview(userData, req.params.id, req.body);
        return res.json(accommodation);
    } catch (err) {
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.delete('/reviews/:id', async (req, res) => {
    console.log(`Deleting review with id: ${req.params.id}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        await reviewService.deleteReview(userData, req.params.id);
        return res.status(204).send();
    } catch (err) {
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});


//preko rabbit mq: promeni username

// preko rabbit mq: obrisi sve reviews koji pripadaju korisniku ili accommodationu


app.listen(PORT, () => {
  console.log(`Backend service running on http://localhost:${PORT}`);
});
