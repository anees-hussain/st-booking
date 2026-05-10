const express = require("express");

const router = express.Router();

const { orderLimiter } = require("../middleware/rateLimiter");

const validator = require("validator");

const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

// CREATE ORDER
router.post("/", orderLimiter, async (req, res) => {
  console.log("Received order:", req.body);
  try {
    const { customerName, address, phone, seller, detail, totalAmount } =
      req.body;


    //
    // BASIC VALIDATION
    //

    if (!customerName || !address || !seller) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // DETAIL VALIDATION
    if (!Array.isArray(detail) || detail.length === 0) {
      return res.status(400).json({
        message: "Order detail is required",
      });
    }

    // LIMIT ITEMS
    if (detail.length > 50) {
      return res.status(400).json({
        message: "Too many items in order",
      });
    }

    // LIMIT TOTAL AMOUNT
    if (totalAmount > 1000000) {
      return res.status(400).json({
        message: "Invalid total amount",
      });
    }

    //
    // CLEAN ORDER ITEMS
    //

    const cleanedDetail = detail.map((item) => ({
      productName: String(item.productName || "").trim(),

      uom: String(item.uom || "").trim(),

      quantity: Number(item.quantity || 0),

      rate: Number(item.rate || 0),
    }));

    //
    // CREATE ORDER
    //

    const existingOrder = await Order.findOne({
      customerName: customerName.trim(),
      createdAt: {
        $gte: new Date(Date.now() - 30000),
      },
    });

    if (existingOrder) {
      return res.status(429).json({
        message: "Please wait before submitting another order",
      });
    }

    const order = new Order({
      customerName: customerName.trim(),

      address: address.trim(),

      phone: phone.trim(),

      seller: seller.trim(),

      detail: cleanedDetail,

      totalAmount,

      status: "submitted",
    });

    const savedOrder = await order.save();

    res.status(201).json({
      message: "Order submitted successfully",
      orderId: savedOrder._id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

// GET ALL ORDERS
router.get("/", protect, async (req, res) => {
  try {
    const orders = await Order.find().sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET SINGLE ORDER
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE ORDER
router.put("/:id", protect, async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );

    if (!updatedOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// DELETE ORDER
router.delete("/:id", protect, async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);

    if (!deletedOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
