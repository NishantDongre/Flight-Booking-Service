const axios = require("axios");
const { StatusCodes } = require("http-status-codes");

const { BookingRepository } = require("../repositories");
const { ServerConfig } = require("../config");
const db = require("../models");
const AppError = require("../utils/errors/app-error");
const { Enums } = require("../utils/common");
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;

const bookingRepository = new BookingRepository();

async function createBooking(data) {
    const transaction = await db.sequelize.transaction();
    try {
        const flight = await axios.get(
            `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`
        );
        const flightData = flight.data.data;
        if (data.noOfSeats > flightData.totalSeatsAvailable) {
            throw new AppError(
                "Not enough seats available",
                StatusCodes.BAD_REQUEST
            );
        }
        const totalBillingAmount = data.noOfSeats * flightData.price;
        const bookingPayload = { ...data, totalCost: totalBillingAmount };
        const booking = await bookingRepository.create(
            bookingPayload,
            transaction
        );

        await axios.patch(
            `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`,
            {
                seats: data.noOfSeats,
            }
        );

        await transaction.commit();
        return booking;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function makePayment(data) {
    const transaction = await db.sequelize.transaction();
    try {
        const bookingDetails = await bookingRepository.get(
            data.bookingId,
            transaction
        );
        if (bookingDetails.status == CANCELLED) {
            throw new AppError(
                "No Payment can be done as the booking has expired/cancelled",
                StatusCodes.BAD_REQUEST
            );
        }
        console.log(bookingDetails);
        const bookingTime = new Date(bookingDetails.createdAt);
        const currentTime = new Date();
        if (currentTime - bookingTime > 300000) {
            // 5 min
            await bookingRepository.update(
                data.bookingId,
                { status: CANCELLED },
                transaction
            );
            throw new AppError(
                "The booking has expired",
                StatusCodes.BAD_REQUEST
            );
        }
        if (bookingDetails.userId != data.userId) {
            throw new AppError(
                "The user corresponding to the booking doesnt match",
                StatusCodes.BAD_REQUEST
            );
        }
        if (bookingDetails.totalCost != data.totalCost) {
            throw new AppError(
                "The amount of the payment doesn't match",
                StatusCodes.BAD_REQUEST
            );
        }
        // we assume here that payment is successful
        await bookingRepository.update(
            data.bookingId,
            { status: BOOKED },
            transaction
        );
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    createBooking,
    makePayment,
};
