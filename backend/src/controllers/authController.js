import db from '../database/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('[Auth] JWT_SECRET is not set. Add it to your .env file.');
}

export const register = async (req, res) => {
    const { email, password, companyName } = req.body;

    if (!email || !password || !companyName) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email, password, and company name are required.' 
        });
    }

    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const emailDomain = email.split('@')[1];

    if (!emailDomain || publicDomains.includes(emailDomain.toLowerCase())) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please register with a valid company email address.' 
        });
    }

    try {
        const existingAdmin = await db('AdminUser').where({ Email: email }).first();
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert into 'Company' table (Name, Email)
        const [newCompany] = await db('Company')
            .insert({
                Name: companyName,
                Email: email
            })
            .returning('*');

        const companyId = newCompany.CompanyID || newCompany.companyid || newCompany.id;

        // Insert into 'AdminUser' table (CompanyID, Email, Password, Role)
        const [newAdmin] = await db('AdminUser')
            .insert({
                CompanyID: companyId,
                Email: email,
                Password: hashedPassword,
                Role: 'admin'
            })
            .returning('*');

        const adminId = newAdmin.AdminUserID || newAdmin.id;
        const token = jwt.sign(
            { id: adminId, role: newAdmin.Role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.status(201).json({
            success: true,
            message: 'Company admin account created successfully',
            token,
            user: {
                AdminUserID: adminId,
                CompanyID: companyId,
                Email: newAdmin.Email,
                Role: newAdmin.Role
            }
        });
    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during account creation.',
            error: error.message
        });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required.' 
        });
    }

    try {
        const user = await db('AdminUser').where({ Email: email }).first();

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        // Compare password against DB column 'Password'
        const passwordMatch = await bcrypt.compare(password, user.Password);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        const adminId = user.AdminUserID || user.id;
        const token = jwt.sign(
            { id: adminId, role: user.Role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                AdminUserID: user.AdminUserID,
                CompanyID: user.CompanyID,
                Email: user.Email,
                Role: user.Role
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login.',
            error: error.message
        });
    }
};

export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must match whatever you used when the cookie was set at login
  });
  res.json({ message: 'Logged out' });
};