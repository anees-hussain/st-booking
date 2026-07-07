const express = require("express");

const router = express.Router();

const { orderLimiter } = require("../middleware/rateLimiter");

const validator = require("validator");

const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

// GET ORDER SHEET
router.get("/ordersheet", protect, async (req, res) => {

  try {
    //
    // FILTER OBJECT
    //

    const filter = {
      status: "submitted",
    };

    //
    // SELLER FILTER
    //

    if (req.query.seller) {
      filter.seller = req.query.seller;
    }

    //
    // DATE FILTER
    //

    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);

      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(req.query.endDate);

      endDate.setHours(23, 59, 59, 999);

      filter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    //
    // FETCH ORDERS
    //

    const orders = await Order.find(filter).sort({
      createdAt: -1,
    });

    //
    // RESPONSE
    //

    res.json({
      orders,
      totalOrders: orders.length,
    });
  } catch (error) {
    console.error("Order Sheet Error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET ORDER FILTER OPTIONS
router.get("/summary", protect, async (req, res) => {
  try {
    const { startDate, endDate, status, seller, deliveryBy } = req.query;

    //
    // VALIDATE FILTERS
    //

    if (seller && deliveryBy) {
      return res.status(400).json({
        message: "Please use either seller or deliveryBy filter, not both.",
      });
    }

    //
    // SAFE DATE CREATOR
    //

    const createDate = (dateString, endOfDay = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }

      const [year, month, day] = dateString.split("-");

      const date = new Date(Number(year), Number(month) - 1, Number(day));

      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }

      if (endOfDay) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }

      return date;
    };

    //
    // MATCH FILTER
    //

    const matchStage = {};

    //
    // STATUS FILTER
    //

    if (status) {
      matchStage.status = status;
    }

    //
    // DATE FILTER
    // Paid orders are filtered using acknowledgeAt.
    // All other statuses are filtered using createdAt.
    //

    const dateField = status === "paid" ? "acknowledgeAt" : "createdAt";

    if (startDate || endDate) {
      matchStage[dateField] = {};

      if (startDate) {
        matchStage[dateField].$gte = createDate(startDate);
      }

      if (endDate) {
        matchStage[dateField].$lte = createDate(endDate, true);
      }
    }

    //
    // SELLER / DELIVERY FILTER
    //

    if (seller) {
      matchStage.seller = seller;
    } else if (deliveryBy) {
      matchStage.deliveryBy = deliveryBy;
    }

    //
    // PRODUCT SUMMARY
    //

    const summary = await Order.aggregate([
      {
        $match: {
          ...matchStage,

          detail: {
            $exists: true,
            $ne: [],
          },
        },
      },

      //
      // BREAK PRODUCTS
      //

      {
        $unwind: {
          path: "$detail",
          preserveNullAndEmptyArrays: false,
        },
      },

      //
      // GROUP PRODUCTS
      //

      {
        $group: {
          _id: {
            productId: "$detail.productId",
            productName: "$detail.productName",
            uom: "$detail.uom",
          },

          //
          // TOTAL PRODUCT QTY
          //

          totalQuantity: {
            $sum: "$detail.quantity",
          },

          //
          // TOTAL PRODUCT AMOUNT
          //

          totalAmount: {
            $sum: {
              $multiply: ["$detail.quantity", "$detail.rate"],
            },
          },

          //
          // UNIQUE ORDERS
          //

          orders: {
            $addToSet: "$_id",
          },
        },
      },

      //
      // CLEAN RESPONSE
      //

      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          productName: "$_id.productName",
          uom: "$_id.uom",
          totalQuantity: 1,
          totalAmount: 1,
          totalOrders: {
            $size: "$orders",
          },
        },
      },

      //
      // SORT
      //

      {
        $sort: {
          totalQuantity: -1,
        },
      },
    ]);

    return res.json(summary);
  } catch (error) {
    console.error("Summary Error:", error);

    return res.status(500).json({
      message: error.message || "Server Error",
    });
  }
});

router.get("/filters/options", protect, async (req, res) => {
  try {
    //
    // GET DISTINCT VALUES
    //

    const [statuses, sellers, deliveryBy] = await Promise.all([
      Order.distinct("status"),

      Order.distinct("seller"),

      Order.distinct("deliveryBy"),
    ]);

    //
    // CLEAN ARRAY
    //

    const cleanArray = (array) => {
      return array
        .filter((item) => item && item !== "N/A" && item.trim() !== "")
        .sort((a, b) => a.localeCompare(b));
    };

    res.json({
      statuses: cleanArray(statuses),

      sellers: cleanArray(sellers),

      deliveryBy: cleanArray(deliveryBy),
    });
  } catch (error) {
    console.error("Filter Options Error:", error);

    res.status(500).json({
      message: error.message || "Server Error",
    });
  }
});

//
// GET PAID ORDERS REPORT
//

router.get("/reports/paid", protect, async (req, res) => {
  try {
    const { startDate, endDate, byProduct } = req.query;

    //
    // VALIDATION
    //

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Start date and end date are required",
      });
    }

    //
    // DATE FILTER
    //

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    //
    // BASE FILTER
    //

    const filter = {
      acknowledgeAt: {
        $ne: null,
        $gte: start,
        $lte: end,
      },
    };

    //
    // GROUP BY PRODUCT
    //

    if (byProduct === "true") {
      const groupedProducts = await Order.aggregate([
        {
          $match: filter,
        },

        //
        // UNWIND PRODUCTS ARRAY
        //

        {
          $unwind: "$detail",
        },

        //
        // GROUP DATA
        //

        {
          $group: {
            _id: "$detail.productName",

            totalQuantity: {
              $sum: "$detail.quantity",
            },

            totalAmountPaid: {
              $sum: {
                $multiply: ["$detail.quantity", "$detail.rate"],
              },
            },
          },
        },

        //
        // FORMAT RESPONSE
        //

        {
          $project: {
            _id: 0,
            productName: "$_id",
            totalQuantity: 1,
            totalAmountPaid: 1,
          },
        },

        //
        // SORT
        //

        {
          $sort: {
            productName: 1,
          },
        },
      ]);

      return res.json(groupedProducts);
    }

    //
    // INDIVIDUAL ORDERS
    //

    const orders = await Order.find(filter).sort({
      acknowledgeAt: -1,
    });

    res.json(orders);
  } catch (error) {
    console.error("Paid Report Error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// CREATE ORDER
router.post("/", orderLimiter, async (req, res) => {
  try {
    const {
      customerName,
      address,
      phone,
      seller,
      detail,
      totalAmount,
      postedBy,
    } = req.body;

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
      productId: item.productId,
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

      postedBy: postedBy.trim(),

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
    console.error("Create Order Error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
});

// GET ORDERS WITH PAGINATION + FILTERS

router.get("/", protect, async (req, res) => {
  try {
    //
    // QUERY PARAMS
    //

    const page = Number(req.query.page) || 1;

    const limit = Number(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    //
    // FILTER OBJECT
    //

    const filter = {};

    //
    // SELLER FILTER
    //

    if (req.query.seller) {
      filter.seller = req.query.seller;
    }

    //
    // STATUS FILTER
    //

    if (req.query.status) {
      filter.status = req.query.status;
    }

    //
    // DELIVERY BY FILTER
    //

    if (req.query.deliveryBy) {
      filter.deliveryBy = req.query.deliveryBy;
    }

    //
    // SEARCH
    //

    if (req.query.search) {
      filter.$or = [
        {
          customerName: {
            $regex: req.query.search,
            $options: "i",
          },
        },

        {
          phone: {
            $regex: req.query.search,
            $options: "i",
          },
        },
      ];
    }

    //
    // DATE FILTER
    //

    if (req.query.date) {
      const startDate = new Date(req.query.date);

      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(req.query.date);

      endDate.setHours(23, 59, 59, 999);

      filter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    //
    // TOTAL COUNT
    //

    const totalOrders = await Order.countDocuments(filter);

    //
    // FETCH ORDERS
    //

    const orders = await Order.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit);

    //
    // RESPONSE
    //

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
    console.error("Get Orders Error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE ORDER STATUS
router.put("/:id/status", protect, async (req, res) => {
  try {
    const { status, deliveryBy, acknowledgeBy } = req.body;

    //
    // VALIDATION
    //

    if (!status) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    //
    // UPDATE DATA
    //

    let updateData = {
      status,
    };

    //
    // DELIVERED
    //

    if (status === "delivered") {
      if (!deliveryBy) {
        return res.status(400).json({
          message: "Delivery person is required",
        });
      }

      updateData.deliveryBy = deliveryBy;
    }

    //
    // PAID
    //

    if (status === "paid") {
      if (!acknowledgeBy) {
        return res.status(400).json({
          message: "Acknowledge by is required",
        });
      }

      updateData.acknowledgeBy = acknowledgeBy;
      updateData.acknowledgeAt = new Date();
    }

    //
    // CANCELLED
    //

    if (status === "cancelled") {
      updateData.deliveryBy = "";
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
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
    console.error("Update Order Status Error:", error);

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
    console.error("Get Single Order Error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE ORDER

router.put("/:id", protect, async (req, res) => {
  try {
    //
    // FIND ORDER
    //

    const existingOrder = await Order.findById(req.params.id);

    if (!existingOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    //
    // CHECK STATUS
    //

    if (
      existingOrder.status === "delivered" ||
      existingOrder.status === "cancelled"
    ) {
      return res.status(400).json({
        message: "Delivered or cancelled orders cannot be updated",
      });
    }

    //
    // UPDATE ORDER
    //

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    res.json(updatedOrder);
  } catch (error) {
    console.error("Update Order Error:", error);
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
    console.error("Delete Order Error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
