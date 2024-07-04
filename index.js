import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import routes from './routes.js'; 
dotenv.config();

const app = express();
const port = 8000;


app.use(express.json());


const mongoString = process.env.DATABASE_URL;


if (!mongoString) {
  console.error("MongoDB URI is not defined in the environment variables.");
  process.exit(1); 
}


mongoose.connect(mongoString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const database = mongoose.connection;

database.on('error', (error) => {
  console.log(error);
});

database.once('connected', () => {
  console.log('Database Connected');
});

// Use CORS middleware
app.use(cors());

// Use routes
app.use('/', routes);

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
