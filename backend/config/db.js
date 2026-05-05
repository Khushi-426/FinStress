const mongoose = require('mongoose');

const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/finstress', {
        // Connection pooling
        maxPoolSize: 10,
        minPoolSize: 2,
        // Timeouts
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // Retry logic
        retryWrites: true,
        retryReads: true,
      });
      
      console.log('✅ MongoDB connected');
      
      // Monitor connection
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
      });
      
      return;
    } catch (err) {
      retries++;
      console.error(`❌ MongoDB connection failed (attempt ${retries}/${maxRetries}):`, err.message);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
      }
    }
  }
  
  throw new Error('Failed to connect to MongoDB after max retries');
};

module.exports = connectDB;
