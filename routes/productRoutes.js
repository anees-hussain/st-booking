const express = require("express");

const router = express.Router();

const Product = require("../models/Product");
const protect = require("../middleware/authMiddleware");

// CREATE PRODUCT
router.post("/", protect, async (req, res) => {
  try {
    const product = new Product(req.body);

    const savedProduct = await product.save();

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET ALL PRODUCTS
router.get("/", protect, async (req, res) => {
  try {
    const products = await Product.find().sort({
      createdAt: -1,
    });

    console.log("Products retrieved:");

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET Active PRODUCTS for public use
router.get("/active", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({
      createdAt: -1,
    });

    console.log("Products retrieved:");

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET SINGLE PRODUCT
router.get("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE PRODUCT
router.put("/:id", protect, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );

    if (!updatedProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// DELETE PRODUCT
router.delete("/:id", protect, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE PRODUCT RATE
router.put("/update-rate/:id", protect, async (req, res) => {
  try {
    const { rate } = req.body;

    // VALIDATION
    if (rate === undefined) {
      return res.status(400).json({
        message: "Rate is required",
      });
    }

    // FIND PRODUCT
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // UPDATE RATE
    product.rate = rate;

    await product.save();

    res.json({
      message: "Product rate updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
