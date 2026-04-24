import React, { useState } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/shared/components/ui/button';
import { Loader2 } from 'lucide-react';
import { stripePromise } from './StripeProvider';

// ---------------------------------------------------------------------------
// Inner form (must be inside <Elements>)
// ---------------------------------------------------------------------------

interface InnerFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const InnerForm: React.FC<InnerFormProps> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setErrorMessage(result.error.message ?? 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    if (result.paymentIntent?.status !== 'succeeded') {
      setErrorMessage('Payment did not complete. The invoice will update when payment is confirmed.');
      setLoading(false);
      return;
    }

    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && (
        <p className="text-sm text-gardens-red-dk">{errorMessage}</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!stripe || loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing…
            </>
          ) : (
            'Pay now'
          )}
        </Button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  clientSecret,
  onSuccess,
  onCancel,
}) => {
  if (!stripePromise) {
    return (
      <p className="text-sm text-gardens-red-dk">
        Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in .env and restart Vite.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <InnerForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
};
