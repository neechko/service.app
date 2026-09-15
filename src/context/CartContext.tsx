import { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  serviceId: string;
  serviceName: string;
  tierIds: string[];
  tierNames: string[];
  price: number; // Total harga (sudah dijumlahkan dari semua package)
  estimatedHours: number; // Total estimasi jam
  gameUid?: string;
  gameServer?: string;
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  updateItemDetails: (index: number, details: Partial<CartItem>) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setItems((prev) => [...prev, item]);
  };

  const removeFromCart = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemDetails = (index: number, details: Partial<CartItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...details } : item)));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.length;
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateItemDetails, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}