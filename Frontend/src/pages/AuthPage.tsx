import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion } from 'framer-motion';

const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    pin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const { data } = await api.post('/api/auth/login', {
          email: formData.email,
          password: formData.password
        });
        login(data.data.token, data.data.user);
        if (data.data.user.role === 'admin') navigate('/admin');
        else navigate('/profiles');
      } else {
        // Register the user
        await api.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
        
        // Log in to get the token
        const loginRes = await api.post('/api/auth/login', {
          email: formData.email,
          password: formData.password
        });
        
        const token = loginRes.data.data.token;
        const user = loginRes.data.data.user;
        
        // Set the parent pin using the token
        try {
          await api.put('/api/auth/parent-pin', {
            new_pin: formData.pin,
            confirm_pin: formData.pin,
            current_password: formData.password
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (pinErr) {
          console.error('Failed to set PIN, but account created.', pinErr);
          alert(t('auth.pinSetupFailed'));
        }

        login(token, user);
        navigate('/profiles');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || t('auth.failed'));
    }
  };

  return (
    <div className="stream-page min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-700/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/25 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-6 rounded-2xl stream-surface stream-card relative z-10"
      >
        {/* Animated Centered Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo-pg.png" 
            alt="PG Kids Logo" 
            className="h-20 w-auto animate-float object-contain hover:scale-110 transition-transform duration-300"
          />
        </div>

        <div className="stream-pill w-max px-3 py-0.5 mb-4 text-xs font-bold mx-auto">
          {isLogin ? t('auth.login') : t('auth.register')}
        </div>

        <div className="flex bg-slate-800/80 p-1 rounded-lg mb-6 border border-slate-700">
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${isLogin ? 'bg-gradient-to-r from-orange-500 to-sky-500 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
            onClick={() => setIsLogin(true)}
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!isLogin ? 'bg-gradient-to-r from-orange-500 to-sky-500 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
            onClick={() => setIsLogin(false)}
          >
            {t('auth.register')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder={t('auth.name')}
              required
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          )}
          
          <input
            type="email"
            placeholder={t('auth.email')}
            required
            className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          
          <input
            type="password"
            placeholder={t('auth.password')}
            required
            className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />

          {!isLogin && (
            <input
              type="password"
              placeholder={t('auth.pin')}
              required
              maxLength={4}
              pattern="\d{4}"
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-center tracking-widest text-lg"
              value={formData.pin}
              onChange={e => setFormData({...formData, pin: e.target.value})}
            />
          )}

          <button
            type="submit"
            className="stream-button w-full bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold py-2 px-4 text-sm shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('auth.submit')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AuthPage;
