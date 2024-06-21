import express from 'express';
import bodyParser from 'body-parser';
import { CustomError, NotFoundError } from './types/errors';
import cors from 'cors';
import { ReviewService } from './services/review-service';
import prometheusMiddleware from 'express-prometheus-middleware';
import promClient from 'prom-client';
import osUtils from 'os-utils';
import si from 'systeminformation';
import { Logger } from './util/logger';
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

app.use(prometheusMiddleware({
  metricsPath: '/metrics',
  collectDefaultMetrics: true,
  requestDurationBuckets: [0.1, 0.5, 1, 1.5]
}));

const cpuUsageGauge = new promClient.Gauge({ name: 'cpu_usage', help: 'CPU Usage' });
const memoryUsageGauge = new promClient.Gauge({ name: 'memory_usage', help: 'Memory Usage' });
const fsUsageGauge = new promClient.Gauge({ name: 'fs_usage', help: 'File System Usage' });
const networkTrafficGauge = new promClient.Gauge({ name: 'network_traffic', help: 'Network Traffic' });

// Collecting OS metrics
function collectOSMetrics() {
  osUtils.cpuUsage(function(v){
    cpuUsageGauge.set(v);
  });
  si.mem().then(data => {
    memoryUsageGauge.set(data.active / data.total);
  });
  si.fsSize().then(data => {
    let used = 0;
    let size = 0;
    data.forEach(disk => {
      used += disk.used;
      size += disk.size;
    });
    fsUsageGauge.set(used / size);
  });
  si.networkStats().then(data => {
    let totalRx = 0;
    let totalTx = 0;
    data.forEach(net => {
      totalRx += net.rx_bytes;
      totalTx += net.tx_bytes;
    });
    networkTrafficGauge.set((totalRx + totalTx) / (1024 * 1024 * 1024)); // in GB
  });
}

// Collect metrics every 10 seconds
setInterval(collectOSMetrics, 10000);

// Additional custom metrics for HTTP traffic
const totalHttpRequests = new promClient.Counter({
  name: 'total_http_requests',
  help: 'Total number of HTTP requests'
});
const successfulHttpRequests = new promClient.Counter({
  name: 'successful_http_requests',
  help: 'Total number of successful HTTP requests'
});
const clientErrorHttpRequests = new promClient.Counter({
  name: 'client_error_http_requests',
  help: 'Total number of client error HTTP requests'
});
const serverErrorHttpRequests = new promClient.Counter({
  name: 'server_error_http_requests',
  help: 'Total number of server error HTTP requests'
});
const uniqueVisitorsGauge = new promClient.Gauge({
  name: 'unique_visitors',
  help: 'Number of unique visitors'
});
const notFoundHttpRequests = new promClient.Counter({
  name: 'not_found_http_requests',
  help: 'Total number of HTTP 404 requests'
});
const trafficInGbGauge = new promClient.Gauge({
  name: 'traffic_in_gb',
  help: 'Total traffic in GB'
});

// Middleware to track HTTP requests
app.use((req, res, next) => {
  totalHttpRequests.inc();

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      successfulHttpRequests.inc();
    } else if (res.statusCode >= 400 && res.statusCode < 500) {
      clientErrorHttpRequests.inc();
      if (res.statusCode === 404) {
        notFoundHttpRequests.inc();
      }
    } else if (res.statusCode >= 500) {
      serverErrorHttpRequests.inc();
    }
  });

  next();
});

const visitorMap = new Map();

// Middleware to track unique visitors and traffic
app.use((req, res, next) => {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];
  const visitorKey = `${ip}-${userAgent}`;

  if (!visitorMap.has(visitorKey)) {
    visitorMap.set(visitorKey, { timestamp: Date.now() });
  } else {
    visitorMap.get(visitorKey).timestamp = Date.now();
  }

  uniqueVisitorsGauge.set(visitorMap.size);

  res.on('finish', () => {
    const responseSize = Number(res.getHeader('content-length')) || 0;
    trafficInGbGauge.inc(responseSize / (1024 * 1024 * 1024)); // in GB
  });

  next();
});


app.get('/reviews/health', (req, res) => {
  return res.status(200).json({message: "Hello, World!"});
})

app.get('/reviews/:id', async (req, res) => {
    Logger.log(`Getting review with id: ${req.params.id}`);
    try {
        const accommodation = await reviewService.getReview(req.params.id);
        Logger.log(`Review with id: ${req.params.id}: ${JSON.stringify(accommodation)}`);
        return res.json(accommodation);
    } catch (err) {
      Logger.error(`Error while getting review with id: ${req.params.id}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.post('/reviews', async (req, res) => {
    Logger.log('Creating new review');
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
          Logger.error('User data not provided');
          throw new NotFoundError('User data not provided');
        }
        const userData = JSON.parse(userDataStr as string);
        Logger.log(`Logged user: ${JSON.stringify(userData)}`);
        const newReviewId = await reviewService.createReview(userData, req.body);
        Logger.log(`New review created: ${JSON.stringify(newReviewId)}`);
        return res.status(201).json({ id: newReviewId });
    } catch (err) {
        const code = err instanceof CustomError ? err.code : 500;
        return res.status(code).json({ message: (err as Error).message });
    }
});

app.get('/reviews/accommodations/:id', async (req, res) => {
    Logger.log(`Getting all reviews which belongs to accommodation with id: ${req.params.id}`);
    try {
        const reviews = await reviewService.getReviewsByAccommodation(req.params.id);
        Logger.log(`Reviews for accommodation with id: ${req.params.id}: ${JSON.stringify(reviews)}`);
        return res.json(reviews);
    } catch (err) {
      Logger.error(`Error while getting reviews for accommodation with id: ${req.params.id}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
})

app.get('/reviews/hosts/:username', async (req, res) => {
    Logger.log(`Getting all reviews which belongs to host with id: ${req.params.username}`);
    try {
        const reviews = await reviewService.getReviewsByHost(req.params.username);
        Logger.log(`Reviews for host with id: ${req.params.username}: ${JSON.stringify(reviews)}`);
        return res.json(reviews);
    } catch (err) {
      Logger.error(`Error while getting reviews for host with id: ${req.params.username}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }

});

app.get('/reviews/', async (req, res) => {
    Logger.log(`Getting all reviews which belong to user: ${JSON.stringify(req.headers.user)}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
          Logger.error('User data not provided');
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        const reviews = await reviewService.getReviewsByUser(userData, req.query);
        Logger.log(`Reviews for user: ${JSON.stringify(userData)}: ${JSON.stringify(reviews)}`);
        return res.json(reviews);
    } catch (err) {
      Logger.error(`Error while getting reviews for user: ${JSON.stringify(req.headers.user)}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.put('/reviews/:id', async (req, res) => {
    Logger.log(`Updating review with id: ${req.params.id}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
          Logger.error('User data not provided');
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        const accommodation = await reviewService.updateReview(userData, req.params.id, req.body);
        Logger.log(`Review with id: ${req.params.id} updated`);
        return res.json(accommodation);
    } catch (err) {
      Logger.error(`Error while updating review with id: ${req.params.id}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

app.delete('/reviews/:id', async (req, res) => {
    Logger.log(`Deleting review with id: ${req.params.id}`);
    const userDataStr = req.headers.user;
    try {
        if (!userDataStr) {
          Logger.error('User data not provided');
            throw new NotFoundError('User data not provided');
          }
        const userData = JSON.parse(userDataStr as string);
        await reviewService.deleteReview(userData, req.params.id);
        Logger.log(`Review with id: ${req.params.id} deleted`);
        return res.status(204).send();
    } catch (err) {
      Logger.error(`Error while deleting review with id: ${req.params.id}`);
      const code = err instanceof CustomError ? err.code : 500;
      return res.status(code).json({ message: (err as Error).message });
    }
});

// preko rabbit mq: obrisi sve reviews koji pripadaju korisniku ili accommodationu


app.listen(PORT, () => {
  console.log(`Backend service running on http://localhost:${PORT}`);
});
