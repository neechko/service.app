import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/dialog';

export default function Cart() {
  const navigate = useNavigate();
  const { items, removeFromCart, updateItemDetails, clearCart, totalPrice } = useCart();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await showAlert({ title: 'Login Required', message: 'Please login to checkout.', type: 'warning' });
      navigate('/login');
      return;
    }

    // Validasi UID & Server
    const incompleteItems = items.filter(item => !item.gameUid || !item.gameServer);
    if (incompleteItems.length > 0) {
      await showAlert({ title: 'Incomplete Details', message: 'Please fill in Game UID and Server for all items.', type: 'warning' });
      return;
    }

    setCheckoutLoading(true);
    try {
      const ordersToInsert = items.map(item => ({
        consumer_id: user.id,
        service_id: item.serviceId,
        total_price: item.price,
        game_uid: item.gameUid,
        game_server: item.gameServer,
        notes: `${item.tierName} Package. Notes: ${item.notes || ''}`,
        status: 'pending',
        current_percentage: 0
      }));

      const { error } = await supabase.from('orders').insert(ordersToInsert);
      if (error) throw error;

      await showAlert({ title: 'Order Placed!', message: 'Your orders have been created successfully.', type: 'success' });
      clearCart();
      navigate('/orders');
    } catch (err) {
      await showAlert({ title: 'Checkout Failed', message: (err as Error).message, type: 'danger' });
    }
    setCheckoutLoading(false);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-8 rounded-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">Your Cart is Empty</h2>
          <p className="text-zinc-400 mb-6">Browse our services and add packages to your cart.</p>
          <Link to="/" className="bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-6 rounded-lg transition-all">Browse Services</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Shopping Cart</h1>
        
        <div className="space-y-4 mb-8">
          {items.map((item, index) => (
            <div key={index} className="glass-card rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{item.serviceName}</h3>
                  <p className="text-primary font-medium">{item.tierName} Package</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price)}</p>
                  <button onClick={() => removeFromCart(index)} className="text-xs text-red-400 hover:text-red-300 mt-1">Remove</button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Game UID *</label>
                  <input type="text" value={item.gameUid || ''} onChange={(e) => updateItemDetails(index, { gameUid: e.target.value })} placeholder="Enter UID" className="input-modern w-full" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Server *</label>
                  <input type="text" value={item.gameServer || ''} onChange={(e) => updateItemDetails(index, { gameServer: e.target.value })} placeholder="Enter Server" className="input-modern w-full" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Notes (Optional)</label>
                  <input type="text" value={item.notes || ''} onChange={(e) => updateItemDetails(index, { notes: e.target.value })} placeholder="Any specific requests?" className="input-modern w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-6 sticky bottom-4 border border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg text-zinc-300">Total Amount:</span>
            <span className="text-3xl font-bold text-primary">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPrice)}</span>
          </div>
          <button onClick={handleCheckout} disabled={checkoutLoading} className="w-full bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-bold py-3 rounded-xl transition-all">
            {checkoutLoading ? 'Processing...' : 'Checkout Now'}
          </button>
        </div>
      </div>
    </div>
  );
}