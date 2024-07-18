const express = require("express");

const { BookingMiddlewares } = require("../../middlewares");
const { BookingController } = require("../../controllers");

const router = express.Router();

router.post(
    "/",
    BookingMiddlewares.validateCreateBookingRequest,
    BookingController.createBooking
);
router.post(
    "/payments",
    BookingMiddlewares.validateMakePaymentRequest,
    BookingController.makePayment
);

module.exports = router;
