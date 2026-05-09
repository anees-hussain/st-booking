const express = require("express");

const router = express.Router();

const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

//
// SUMMARY BY PRODUCT
//
router.get("/by-product", protect, async (req, res) => {
  try {
    const summary = await Order.aggregate([
      {
        $unwind: "$detail",
      },

      {
        $group: {
          _id: {
            productName: "$detail.productName",
            uom: "$detail.uom",
          },

          totalQuantity: {
            $sum: "$detail.quantity",
          },

          totalAmount: {
            $sum: {
              $multiply: ["$detail.quantity", "$detail.rate"],
            },
          },

          totalOrders: {
            $sum: 1,
          },
        },
      },

      {
        $project: {
          _id: 0,
          productName: "$_id.productName",
          uom: "$_id.uom",
          totalQuantity: 1,
          totalAmount: 1,
          totalOrders: 1,
        },
      },

      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

//
// SUMMARY BY CUSTOMER
//
router.get("/by-customer", protect, async (req, res) => {
  try {
    const summary = await Order.aggregate([
      {
        $group: {
          _id: "$customerName",

          totalOrders: {
            $sum: 1,
          },

          totalAmount: {
            $sum: "$totalAmount",
          },
        },
      },

      {
        $project: {
          _id: 0,
          customerName: "$_id",
          totalOrders: 1,
          totalAmount: 1,
        },
      },

      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

//
// SUMMARY BY SELLER
//
router.get("/by-seller", protect, async (req, res) => {
  try {
    const summary = await Order.aggregate([
      {
        $group: {
          _id: "$seller",

          totalOrders: {
            $sum: 1,
          },

          totalAmount: {
            $sum: "$totalAmount",
          },
        },
      },

      {
        $project: {
          _id: 0,
          seller: "$_id",
          totalOrders: 1,
          totalAmount: 1,
        },
      },

      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

//
// SUMMARY BY STATUS
//
router.get("/by-status", protect, async (req, res) => {
  try {
    const summary = await Order.aggregate([
      {
        $group: {
          _id: "$status",

          totalOrders: {
            $sum: 1,
          },

          totalAmount: {
            $sum: "$totalAmount",
          },
        },
      },

      {
        $project: {
          _id: 0,
          status: "$_id",
          totalOrders: 1,
          totalAmount: 1,
        },
      },

      {
        $sort: {
          totalOrders: -1,
        },
      },
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
