import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SubscriptionPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plans = [
    {
      id: 'free',
      name: t('subscriptions.free'),
      price: '$0',
      period: t('subscriptions.periodMonthly'),
      features: [
        t('subscriptions.features.free.worlds'),
        t('subscriptions.features.free.profiles'),
        t('subscriptions.features.free.quality'),
      ],
      color: 'from-gray-600 to-gray-800',
    },
    {
      id: 'plus',
      name: t('subscriptions.plus'),
      price: '$4.99',
      period: t('subscriptions.periodMonthly'),
      features: [
        t('subscriptions.features.plus.worlds'),
        t('subscriptions.features.plus.profiles'),
        t('subscriptions.features.plus.quality'),
        t('subscriptions.features.plus.ads'),
      ],
      color: 'from-blue-500 to-purple-500',
      popular: true,
    },
    {
      id: 'premium',
      name: t('subscriptions.premium'),
      price: '$9.99',
      period: t('subscriptions.periodMonthly'),
      features: [
        t('subscriptions.features.premium.worlds'),
        t('subscriptions.features.premium.profiles'),
        t('subscriptions.features.premium.quality'),
        t('subscriptions.features.premium.ads'),
        t('subscriptions.features.premium.downloads'),
      ],
      color: 'from-yellow-500 to-orange-500',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] pt-24 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-12">{t('subscriptions.title')}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white/5 border ${plan.popular ? 'border-blue-500' : 'border-white/10'} rounded-2xl p-6 backdrop-blur-md flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  {t('subscriptions.popular')}
                </div>
              )}
              
              <h2 className="text-xl font-bold text-white mb-3">{plan.name}</h2>
              <div className="flex justify-center items-baseline mb-8">
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r hover:bg-gradient-to-l transition-all duration-500 ease-in-out bg-white">
                  {plan.price}
                </span>
                <span className="text-gray-400 text-sm ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-6 flex-1 text-left">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/parent')}
                className={`w-full py-2.5 rounded-lg font-bold text-sm text-white shadow-lg transition-transform hover:scale-105 bg-gradient-to-r ${plan.color}`}
              >
                {t('subscriptions.select')}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
