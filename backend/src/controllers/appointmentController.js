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

        let actualServiceId = result.service_id;
        if (!actualServiceId && result.service_requested) {
            const svc = await db('services').where('name', 'ilike', result.service_requested).first();
            if (svc) actualServiceId = svc.id;
        }

        if (result.service_requested && result.appointment_date && result.appointment_time) {
            const newRecord = {
                customer_name: result.customer_name,
                contact_info: result.contact_info,
                department: result.department,
                specialist_id: result.specialist_id || null,
                service_id: actualServiceId || 1,
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

export const syncAppointment = async (req, res) => {
    try {
        const {
            customer_name,
            contact_info,
            appointment_date,
            appointment_time,
            service_requested,
            specialist_name
        } = req.body;

        // ✅ FIX: Validate required fields before touching the DB.
        // Previously missing fields produced an ambiguous DB error or a silent partial insert.
        if (!appointment_date || !appointment_time) {
            return res.status(400).json({
                success: false,
                message: 'appointment_date and appointment_time are required to sync an appointment.'
            });
        }
        if (!contact_info) {
            return res.status(400).json({
                success: false,
                message: 'contact_info is required to sync an appointment.'
            });
        }

        let actualServiceId = req.body.service_id;
        if (!actualServiceId && service_requested) {
            const svc = await db('services').where('name', 'ilike', service_requested).first();
            if (svc) actualServiceId = svc.id;
        }

        const newRecord = {
            customer_name: customer_name || 'Unknown',
            contact_info: contact_info,
            department: 'general',
            specialist_id: null,
            service_id: actualServiceId || 1,
            appointment_date,
            appointment_time,
            status: 'confirmed',
            review_prompt_sent: false,
            created_at: new Date().toISOString()
        };

        const [inserted] = await db('appointments').insert(newRecord).returning('*');

        // ✅ FIX: If the DB insert silently produced no record, treat it as a hard failure
        // rather than returning 201 with empty/undefined data.
        if (!inserted) {
            throw new Error('DB insert returned no record. Check DB constraints and connection.');
        }

        res.status(201).json({
            success: true,
            message: 'Appointment synchronized to DB',
            data: inserted
        });
    } catch (error) {
        // Always log the full error on the server so it appears in the Express terminal.
        console.error('[AppointmentController] ❌ Failed to sync appointment:', error);
        // Return 500 so the calling service (sessionSyncService / test spy) can detect the failure.
        res.status(500).json({
            success: false,
            message: 'Failed to sync appointment',
            error: error.message
        });
    }
};


export const getAppointmentsTomorrow = async (req, res) => {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const appointments = await db('appointments').where({
            appointment_date: dateStr,
            status: 'confirmed'
        });

        const formatted = appointments.map(appt => ({
            clientJid: appt.contact_info.includes('@') ? appt.contact_info : `${appt.contact_info.replace('+', '')}@s.whatsapp.net`,
            clientName: appt.customer_name,
            service: 'Service', 
            specialist: 'Specialist',
            appointmentTime: appt.appointment_time,
            language: 'fr'
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error("Error fetching tomorrow's appointments:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getAppointmentsEndedToday = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const appointments = await db('appointments').where({
            appointment_date: today,
            status: 'confirmed',
            review_prompt_sent: false
        });

        const formatted = appointments.map(appt => ({
            clientJid: appt.contact_info.includes('@') ? appt.contact_info : `${appt.contact_info.replace('+', '')}@s.whatsapp.net`,
            clientName: appt.customer_name,
            service: 'Service',
            appointmentTime: appt.appointment_time,
            language: 'fr'
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error("Error fetching today's appointments:", error);
        res.status(500).json({ error: error.message });
    }
};