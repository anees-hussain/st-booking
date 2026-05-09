const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

// GENERATE TOKEN
const generateToken = (id, username) => {
  return jwt.sign(
    {
      id,
      username,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    },
  );
};

// REGISTER USER
router.post("/register", async (req, res) => {
  try {
    const { fullName, designation, username, password } = req.body;

    // CHECK EXISTING USER
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    // HASH PASSWORD
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(password, salt);

    // CREATE USER
    const user = await User.create({
      fullName,
      designation,
      username,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      designation: user.designation,
      username: user.username,
      token: generateToken(user._id, user.username),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// LOGIN USER
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // FIND USER
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({
        message: "Invalid username or password",
      });
    }

    // MATCH PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid username or password",
      });
    }

    res.json({
      _id: user._id,
      fullName: user.fullName,
      designation: user.designation,
      username: user.username,
      token: generateToken(user._id, user.username),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// CHANGE PASSWORD
router.patch("/change-password/:id", protect, async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;

    await user.save();

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET ALL USERS (PROTECTED)
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET SINGLE USER
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// UPDATE USER
router.put("/:id", protect, async (req, res) => {
  try {
    const updatedData = { ...req.body };

    // HASH PASSWORD IF UPDATED
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);

      updatedData.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updatedData,
      {
        new: true,
      },
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// DELETE USER
router.delete("/:id", protect, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
