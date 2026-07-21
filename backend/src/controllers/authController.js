// Mock Store for Admin Users
let mockAdmins = [];

// Admin Sign Up (Requires company email)
const register = async (req, res) => {
    const { email, password, companyName } = req.body;

    if (!email || !password || !companyName) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email, password, and company name are required.' 
        });
    }

    // Validate company email domain (Reject public free providers)
    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const emailDomain = email.split('@')[1];

    if (!emailDomain || publicDomains.includes(emailDomain.toLowerCase())) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please register with a valid company email address.' 
        });
    }

    const newAdmin = {
        AdminUserID: `admin-${Date.now()}`,
        CompanyID: `comp-${Date.now()}`,
        Email: email,
        CompanyName: companyName,
        Role: 'admin'
    };

    mockAdmins.push({ ...newAdmin, password });

    res.status(201).json({
        success: true,
        message: 'Company admin account created successfully',
        token: 'mock-jwt-token-xyz123',
        user: newAdmin
    });
};

// Admin Log In
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required.' 
        });
    }

    const user = mockAdmins.find(a => a.Email === email && a.password === password);

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials.' 
        });
    }

    res.status(200).json({
        success: true,
        message: 'Login successful',
        token: 'mock-jwt-token-xyz123',
        user: {
            AdminUserID: user.AdminUserID,
            CompanyID: user.CompanyID,
            Email: user.Email,
            Role: user.Role
        }
    });
};

module.exports = {
    register,
    login
};