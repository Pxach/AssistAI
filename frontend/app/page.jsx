'use client';

import { useState } from 'react';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

    // Payload formatted for backend controller
    const payload = isSignUp
      ? { companyName: formData.name, email: formData.email, password: formData.password }
      : { email: formData.email, password: formData.password };

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Authentication failed');

      if (isSignUp) {
        // --- SIGN UP SUCCESS ---
        setIsSignUp(false); // Switch to Log In view
        setSuccessMessage('Account created successfully! Please log in below.');
        setFormData((prev) => ({ ...prev, password: '' })); // Clear password
      } else {
        // --- LOG IN SUCCESS ---
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('email', formData.email);
        }
        console.log('Logged in successfully:', data);
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f4f7] flex flex-col justify-between p-8 relative font-sans">
      {/* Centered Auth Card */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[420px] bg-[#7c51f7] text-white rounded-[36px] p-8 md:p-10 shadow-lg flex flex-col items-center">
          
          {/* Card Title */}
          <h1 className="text-2xl font-bold mb-8 text-center tracking-tight">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </h1>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4 flex flex-col items-center">
            {isSignUp && (
              <input
                type="text"
                name="name"
                placeholder="Company Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-[#cfc2fc]/40 placeholder-white/80 text-white px-5 py-3.5 rounded-2xl outline-none border border-transparent focus:border-white/60 transition-all text-sm"
                required
              />
            )}

            <input
              type="email"
              name="email"
              placeholder="Company Email (e.g., admin@techcorp.com)"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-[#cfc2fc]/40 placeholder-white/80 text-white px-5 py-3.5 rounded-2xl outline-none border border-transparent focus:border-white/60 transition-all text-sm"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-[#cfc2fc]/40 placeholder-white/80 text-white px-5 py-3.5 rounded-2xl outline-none border border-transparent focus:border-white/60 transition-all text-sm"
              required
            />

            {/* Success Message Banner */}
            {successMessage && (
              <p className="text-emerald-200 text-xs text-center font-medium pt-1">
                {successMessage}
              </p>
            )}

            {/* Error Message Banner */}
            {error && (
              <p className="text-red-200 text-xs text-center pt-1">{error}</p>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-32 bg-black hover:bg-zinc-900 text-white font-medium py-2.5 px-6 rounded-xl transition-all text-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? '...' : isSignUp ? 'Sign Up' : 'Login'}
            </button>
          </form>

          {/* Toggle Link */}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccessMessage('');
            }}
            className="mt-6 text-xs text-white/90 hover:underline font-normal cursor-pointer"
          >
            {isSignUp ? (
              <>Already have an account? <span className="font-semibold">Log in</span></>
            ) : (
              <>No account? <span className="font-semibold">Sign up</span></>
            )}
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-black font-extrabold text-base tracking-tight select-none">
        AssistAI
      </div>
    </div>
  );
}