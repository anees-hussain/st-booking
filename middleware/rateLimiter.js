const rateLimit = require("express-rate-limit");

// PUBLIC ORDER LIMITER
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 20, // max 20 requests per IP

  message: {
    message: "Too many orders submitted. Please try again later.",
  },

  standardHeaders: true,

  legacyHeaders: false,
});

module.exports = {
  orderLimiter,
};
