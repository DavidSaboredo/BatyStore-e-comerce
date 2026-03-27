export const CONFIG = {
  storeName: "BatyGeekStore",
  currency: "ARS",
  locale: "es-AR",
  whatsappNumber: "3442409755",
  bank: {
    alias: "BATYSTORE.ALIAS",
    cvuCbu: "0000000000000000000000",
    holder: "BatyGeekStore",
    cuit: "00-00000000-0",
  },
  shipping: {
    pickupLabel: "Retiro por el local",
    deliveryLabel: "Envío a domicilio",
    deliveryFlatRate: 6000,
  },
  cloudinary: {
    cloudName: "dwael1b2u",
    uploadPreset: "batystore",
    folder: "batystore",
  },
};

export const PRODUCTS = [
  {
    id: "remera-basica",
    name: "Remera personalizada",
    type: "Remera",
    basePrice: 18990,
    description: "Algodón, ideal para estampa en frente o espalda.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Negro", "Blanco", "Gris", "Azul", "Rojo"],
    placements: ["Frente chico", "Frente grande", "Espalda grande"],
    media: { kind: "video", src: "./remera.mp4" },
  },
  {
    id: "buzo-canguro",
    name: "Buzo canguro personalizado",
    type: "Buzo",
    basePrice: 34990,
    description: "Abrigo y estilo. Estampa al frente o espalda.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Negro", "Gris", "Azul"],
    placements: ["Frente chico", "Frente grande", "Espalda grande"],
    media: { kind: "video", src: "./buzo.mp4" },
  },
  {
    id: "gorra-clasica",
    name: "Gorra personalizada",
    type: "Gorra",
    basePrice: 16990,
    description: "Frente personalizable con texto o diseño.",
    sizes: ["Único"],
    colors: ["Negro", "Blanco", "Beige"],
    placements: ["Frente"],
    media: { kind: "video", src: "./gorra.mp4" },
  },
];

export const PERSONALIZATION_PRICING = [
  { placement: "Frente chico", price: 4500 },
  { placement: "Frente grande", price: 6900 },
  { placement: "Espalda grande", price: 7900 },
  { placement: "Frente", price: 4900 },
];

export const DEFAULT_DESIGNS = [
  {
    id: "baty-classic",
    name: "Baty Classic",
    price: 2500,
    productId: "remera-basica",
    allowedSizes: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "baty-street",
    name: "Baty Street",
    price: 3200,
    productId: "remera-basica",
    allowedSizes: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "baty-minimal",
    name: "Baty Minimal",
    price: 2000,
    productId: "remera-basica",
    allowedSizes: [1, 2, 3, 4, 5, 6],
  },
];

export const MATERIALS = [
  { id: "peinado", label: "Algodón Peinado", maxSize: 6 },
  { id: "algodon100", label: "Algodón 100%", maxSize: 10 },
];

export const STAMP_SIZES = [
  { id: "chico", label: "Chico" },
  { id: "mediano", label: "Mediano" },
  { id: "grande", label: "Grande" },
];

export const STAMP_LOCATIONS = [
  { id: "delantera", label: "Adelante" },
  { id: "trasera", label: "Atrás" },
  { id: "nuca", label: "Superior trasera (nuca)" },
  { id: "pecho-izq", label: "Pecho (izq)" },
  { id: "pecho-der", label: "Pecho (der)" },
];

export const STORAGE_KEYS = {
  cart: "batystore.cart.v1",
  orders: "batystore.orders.v1",
  settings: "batystore.settings.v1",
};

export const ADMIN_SESSION_KEY = "batystore.admin.session.v1";
