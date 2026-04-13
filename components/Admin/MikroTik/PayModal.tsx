import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: any;
  billingPlans: any[];
  profiles: any[];
  routerId: string;
  onSuccess: () => void;
}

const PayModal: React.FC<PayModalProps> = ({ isOpen, onClose, secret, billingPlans, profiles, routerId, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [expiredProfile, setExpiredProfile] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (secret && billingPlans.length > 0) {
      // Auto-find billing plan based on secret's profile
      const plan = billingPlans.find(p => p.pppoe_profile === secret.profile);
      if (plan) {
        setSelectedPlan(plan);
      }
    }
    
    // Set payment date to now
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setPaymentDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  }, [secret, billingPlans]);

  const calculateNextDueDate = (currentDueDate: string) => {
    // Add exactly 1 month while preserving time
    const date = new Date(currentDueDate);
    date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  };

  const handleProcessPayment = async () => {
    if (!selectedPlan) {
      setError('Please select a billing plan');
      return;
    }

    if (!expiredProfile) {
      setError('Please select an expired profile');
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const paymentDateObj = new Date(paymentDate);
      const nextDueDate = calculateNextDueDate(secret.duedate || paymentDate);

      await apiClient.processMikrotikPayment(routerId, {
        secret_id: secret['.id'],
        username: secret.name,
        billing_plan_id: selectedPlan.id,
        plan_name: selectedPlan.plan_name,
        pppoe_profile: selectedPlan.pppoe_profile,
        amount: selectedPlan.price,
        currency: selectedPlan.currency || 'PHP',
        payment_date: paymentDateObj.toISOString(),
        next_duedate: nextDueDate,
        expired_profile: expiredProfile,
        payment_method: 'cash',
        notes: notes
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Process Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* User Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">User Information</h3>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Username:</span> {secret.name}</p>
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Current Profile:</span> {secret.profile}</p>
              {secret.duedate && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Current Due Date:</span>{' '}
                  {new Date(secret.duedate).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Billing Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Billing Plan
            </label>
            <select
              value={selectedPlan?.id || ''}
              onChange={(e) => {
                const plan = billingPlans.find(p => p.id === e.target.value);
                setSelectedPlan(plan || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Billing Plan</option>
              {billingPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.plan_name} - {plan.currency || 'PHP'} {plan.price.toFixed(2)}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-semibold">Price:</span> {selectedPlan.currency || 'PHP'} {selectedPlan.price.toFixed(2)}
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-semibold">Profile:</span> {selectedPlan.pppoe_profile}
                </p>
              </div>
            )}
          </div>

          {/* Expired Profile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expired / Non-Payment Profile
            </label>
            <select
              value={expiredProfile}
              onChange={(e) => setExpiredProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Expired Profile</option>
              {profiles.map(profile => (
                <option key={profile.name} value={profile.name}>
                  {profile.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              User will be moved to this profile when they expire
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Date
            </label>
            <input
              type="datetime-local"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessPayment}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Process Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayModal;
