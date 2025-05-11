const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");
const { ensureTempSession } = require("../middlewares/authMiddleware");

router.post("/api/auth/login", AuthController.login);
router.post("/api/auth/2fa/verify", ensureTempSession, AuthController.verify2FA);

module.exports = router;
