const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;

export const heroImage = photo('photo-1534438327276-14e5300c3a48');
export const money = (amount) => `₱${amount.toLocaleString('en-PH')}`;
