const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Middleware to parse incoming JSON data
app.use(express.json());
// Enable CORS for all routes (cross-origin requests diff ports)
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.log(err));

// Import routes
const speechRoutes = require('./routes/speech');
const s3Routes = require('./routes/s3');

// Use routes
app.use('/api/speech', speechRoutes);
app.use('/api/s3', s3Routes);

// Define a simple route for testing
app.get('/', (req, res) => {
    res.send('API is running');
});

// Start the server
const PORT = process.env.PORT || 5001;  // Default port set to 5001
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
