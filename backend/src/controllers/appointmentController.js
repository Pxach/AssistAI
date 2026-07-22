const { mockAppointments } = require('../data/mockBookingData');
const { processBookingRequest } = require('../services/bookingHandler');

// Fetch mock appointments
const getAppointments = async (req, res) => {
    try {
        res.status(200).json({ success: true, count: mockAppointments.length, data: mockAppointments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
    }
};

// Check slot availability in mock array
const checkAvailability = async (req, res) => {
    const { date, time } = req.query;
    const existing = mockAppointments.find(
        app => app.appointment_date === date && app.appointment_time === time
    );

    res.status(200).json({
        success: true,
        available: !existing,
        requestedSlot: { date, time }
    });
};

// Direct manual appointment creation
const createAppointment = async (req, res) => {
    const { name, phoneNumber, email, date, time } = req.body;

    if (!date || !time || !phoneNumber) {
        return res.status(400).json({ success: false, message: 'Date, time, and phone number are required.' });
    }

    const newAppointment = {
        id: mockAppointments.length + 1,
        customer_name: name || 'Anonymous',
        contact_info: phoneNumber || email || 'Pending',
        department: 'general',
        specialist_id: null,
        service_id: 1,
        appointment_date: date,
        appointment_time: time,
        status: 'pending',
        review_prompt_sent: false,
        created_at: new Date().toISOString()
    };

    mockAppointments.push(newAppointment);

    res.status(201).json({
        success: true,
        message: 'Temporary reservation created successfully',
        data: newAppointment
    });
};

// Process AI Booking Decision Matrix & simulate saving to memory
const processBooking = async (req, res) => {
    try {
        const result = processBookingRequest(req.body);

        // If appointment details are complete, simulate saving to mock DB
        if (result.service_requested && result.appointment_date && result.appointment_time) {
            const newRecord = {
                id: mockAppointments.length + 1,
                customer_name: result.customer_name,
                contact_info: result.contact_info,
                department: result.department,
                specialist_id: result.specialist_id,
                service_id: result.service_id,
                appointment_date: result.appointment_date,
                appointment_time: result.appointment_time,
                status: 'pending',
                review_prompt_sent: false,
                created_at: new Date().toISOString()
            };

            mockAppointments.push(newRecord);
            result.db_record_id = newRecord.id;
        }

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