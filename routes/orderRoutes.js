const express = require("express");

const router = express.Router();

const { orderLimiter } = require("../middleware/rateLimiter");

const validator = require("validator");

const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

// CREATE ORDER
router.post("/", orderLimiter, async (req, res) => {
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

// GET ALL ORDERS WITH PAGINATION

router.get("/", protect, async (req, res) => {
  try {
    // QUERY PARAMS

    const page = Number(req.query.page) || 1;

    const limit = Number(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    // TOTAL COUNT

    const totalOrders = await Order.countDocuments();

    // FETCH ORDERS

    const orders = await Order.find()
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit);

    res.json({
      orders,

      pagination: {
        currentPage: page,

        totalPages: Math.ceil(totalOrders / limit),

        totalOrders,

        hasMore: page * limit < totalOrders,
      },
    });
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

// ORDER SUMMARY

// ORDER SUMMARY

router.get(
  "/summary",
  protect,
  async (req, res) => {
    try {
      const {
        type,
        startDate,
        endDate,
      } = req.query;

      console.log(
        "Summary request:",
        {
          type,
          startDate,
          endDate,
        },
      );

      //
      // VALID TYPES
      //

      const allowedTypes = [
        "product",
        "seller",
        "status",
      ];

      if (
        !type ||
        !allowedTypes.includes(type)
      ) {
        return res.status(400).json({
          message:
            "Invalid summary type",
        });
      }

      //
      // SAFE DATE CREATOR
      //

      const createDate = (
        dateString,
        endOfDay = false,
      ) => {
        const [year, month, day] =
          dateString.split("-");

        const date = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
        );

        if (endOfDay) {
          date.setHours(
            23,
            59,
            59,
            999,
          );
        } else {
          date.setHours(
            0,
            0,
            0,
            0,
          );
        }

        return date;
      };

      //
      // DATE FILTER
      //

      let matchStage = {};

      if (startDate || endDate) {
        matchStage.createdAt = {};

        //
        // ONLY START DATE
        //

        if (
          startDate &&
          !endDate
        ) {
          const start =
            createDate(startDate);

          const end = createDate(
            startDate,
            true,
          );

          matchStage.createdAt = {
            $gte: start,
            $lte: end,
          };
        }

        //
        // ONLY END DATE
        //

        if (
          !startDate &&
          endDate
        ) {
          const end = createDate(
            endDate,
            true,
          );

          matchStage.createdAt = {
            $lte: end,
          };
        }

        //
        // DATE RANGE
        //

        if (
          startDate &&
          endDate
        ) {
          const start =
            createDate(startDate);

          const end = createDate(
            endDate,
            true,
          );

          matchStage.createdAt = {
            $gte: start,
            $lte: end,
          };
        }
      }

      console.log(
        "Match stage:",
        matchStage,
      );

      //
      // SUMMARY BY PRODUCT
      //

      if (type === "product") {
        const summary =
          await Order.aggregate([
            {
              $match: {
                ...matchStage,

                detail: {
                  $exists: true,
                  $ne: [],
                },
              },
            },

            {
              $unwind: {
                path: "$detail",

                preserveNullAndEmptyArrays: false,
              },
            },

            {
              $group: {
                _id: {
                  productName:
                    "$detail.productName",

                  uom: "$detail.uom",
                },

                totalQuantity: {
                  $sum:
                    "$detail.quantity",
                },

                totalAmount: {
                  $sum: {
                    $multiply: [
                      "$detail.quantity",
                      "$detail.rate",
                    ],
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

                productName:
                  "$_id.productName",

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

        return res.json(summary);
      }

      //
      // SUMMARY BY SELLER
      //

      if (type === "seller") {
        const summary =
          await Order.aggregate([
            {
              $match: matchStage,
            },

            {
              $group: {
                _id: "$seller",

                totalOrders: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum:
                    "$totalAmount",
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

        return res.json(summary);
      }

      //
      // SUMMARY BY STATUS
      //

      if (type === "status") {
        const summary =
          await Order.aggregate([
            {
              $match: matchStage,
            },

            {
              $group: {
                _id: "$status",

                totalOrders: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum:
                    "$totalAmount",
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

        return res.json(summary);
      }

      //
      // FALLBACK
      //

      return res.status(400).json({
        message:
          "Invalid summary request",
      });
    } catch (error) {
      console.error(
        "Summary error:",
        error,
      );

      res.status(500).json({
        message: error.message,
      });
    }
  },
);

module.exports = router;
