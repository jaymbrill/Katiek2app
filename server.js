const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const apiRouter = require('./routes/api');
const stravaRouter = require('./routes/strava');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(compression());
app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);
app.use('/api/strava', stravaRouter);

const clientDist = path.join(__dirname, 'client', 'dist');
const fs = require('fs');

if (!fs.existsSync(clientDist)) {
  console.error(`ERROR: client/dist not found at ${clientDist}`);
  console.error('Run: cd client && npm install && npm run build');
}

app.use(express.static(clientDist));
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(503).send('App not built. Run: cd client && npm install && npm run build');
  }
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Big Ten Sports server running on port ${PORT}`);
  scheduler.start();
});
