const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");

dotenv.config();

const connectDB = require("./db");

const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const summaryRoutes = require("./routes/summaryRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(
  express.json({
    limit: "100kb",
  }),
);

// Database Connection
connectDB();

// Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/summary", summaryRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("Server is running...");
});

// Port
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
