const db = require('../database/db');
const { processBookingRequest } = require('../services/bookingHandler');

// Mock Data Store
let mockAppointments = [
    {
        AppointmentID: '123e4567-e89b-12d3-a456-426614174000',
        CustomerID: '987f6543-e21b-12d3-a456-426614174000',
        Name: 'John Doe',
        PhoneNumber: '+212600000000',
        Email: 'john@example.com',
        Date: '2026-07-25',
        Time: '10:00:00',
        Confirmed: true,
        ToDelete: false
    }
];

// Get all appointments
const getAppointments = async (req, res) => {
    try {
        res.status(200).json({ success: true, count: mockAppointments.length, data: mockAppointments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
    }
};

// Check slot availability
const checkAvailability = async (req, res) => {
    const { date, time } = req.query;
    const isTaken = mockAppointments.some(app => app.Date === date && app.Time === time);
    
    res.status(200).json({
        success: true,
        available: !isTaken,
        requestedSlot: { date, time }
    });
};

// Create new appointment
const createAppointment = async (req, res) => {
    const { name, phoneNumber, email, date, time } = req.body;

    if (!date || !time || !phoneNumber) {
        return res.status(400).json({ success: false, message: 'Date, time, and phone number are required.' });
    }

    const newAppointment = {
        AppointmentID: `mock-${Date.now()}`,
        CustomerID: `cust-${Date.now()}`,
        Name: name || 'Anonymous',
        PhoneNumber: phoneNumber,
        Email: email || null,
        Date: date,
        Time: time,
        Confirmed: false,
        ToDelete: true
    };

    mockAppointments.push(newAppointment);

    res.status(201).json({
        success: true,
        message: 'Temporary reservation created successfully',
        data: newAppointment
    });
};

// Process AI Booking Decision Matrix (New)
const processBooking = async (req, res) => {
    try {
        const result = processBookingRequest(req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to process booking request',
            error: error.message
        });
    }
};

module.exports = {
    getAppointments,
    checkAvailability,
    createAppointment,
    processBooking
};