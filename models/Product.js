const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    uom: {
      type: String,
      required: true,
      trim: true,
    },

    rate: {
      type: Number,
      required: true,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Product", productSchema);
