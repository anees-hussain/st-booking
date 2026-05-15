const mongoose = require("mongoose");

const orderDetailSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      trim: true,
    },
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

    quantity: {
      type: Number,
      required: true,
      default: 0,
    },

    rate: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: false,
      trim: true,
    },

    seller: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryBy: {
      type: String,
      required: true,
      trim: true,
      default: "N/A",
    },

    acknowledgeBy: {
      type: String,
      required: true,
      trim: true,
      default: "N/A",
    },

    acknowledgeAt: {
      type: Date,
      required: false,
      default: null,
    },

    postedBy: {
      type: String,
      required: true,
      trim: true,
    },

    detail: [orderDetailSchema],

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["submitted", "delivered", "cancelled", "paid"],
      default: "submitted",
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ seller: 1 });

orderSchema.index({ status: 1 });

orderSchema.index({ deliveryBy: 1 });

orderSchema.index({ createdAt: -1 });

orderSchema.index({ customerName: "text" });

module.exports = mongoose.model("Order", orderSchema);
