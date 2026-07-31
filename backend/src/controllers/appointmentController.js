import db from '../database/db.js';
import { processBookingRequest } from '../services/bookingHandler.js';

export const getAppointments = async (req, res) => {
    try {
        const appointments = await db('appointments').select('*');
        res.status(200).json({ success: true, count: appointments.length, data: appointments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
    }
};

export const checkAvailability = async (req, res) => {
    try {
        const { date, time } = req.query;
        const existing = await db('appointments')
            .where('appointment_date', date)
            .where('appointment_time', time)
            .first();

        res.status(200).json({
            success: true,
            available: !existing,
            requestedSlot: { date, time }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check availability', error: error.message });
    }
};

export const createAppointment = async (req, res) => {
    try {
        const { name, phoneNumber, email, date, time } = req.body;

        if (!date || !time || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Date, time, and phone number are required.' });
        }

        const newAppointment = {
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

        const [inserted] = await db('appointments').insert(newAppointment).returning('*');

        res.status(201).json({
            success: true,
            message: 'Temporary reservation created successfully',
            data: inserted || newAppointment
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create appointment', error: error.message });
    }
};

export const processBooking = async (req, res) => {
    try {
        const result = processBookingRequest(req.body);

        if (result.service_requested && result.appointment_date && result.appointment_time) {
            const newRecord = {
                customer_name: result.customer_name,
                contact_info: result.contact_info,
                department: result.department,
                specialist_id: result.specialist_id || null,
                service_id: result.service_id || 1,
                appointment_date: result.appointment_date,
                appointment_time: result.appointment_time,
                status: 'pending',
                review_prompt_sent: false,
                created_at: new Date().toISOString()
            };

            const [inserted] = await db('appointments').insert(newRecord).returning('*');
            result.db_record_id = inserted ? inserted.id : null;
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