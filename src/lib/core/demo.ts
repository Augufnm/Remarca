/* Datos de ejemplo: un almacén con 27 productos y dos proveedores, y una lista nueva para probar. */
import { newId as defaultNewId, r2 } from "./format";
import { DEFAULT_SETTINGS, costFromList, marginFor, priceFrom, roundPrice } from "./pricing";
import type { Data, Product, Supplier } from "./types";

export const DEMO_LIST = `DISTRIBUIDORA DEL SUR
LISTA DE PRECIOS MAYORISTA - VIGENCIA OCTUBRE
Precios sin IVA. Condición: contado.

COD    DESCRIPCION                              PRECIO
1021   YERBA PLAYADITO 1KG                      $ 3.950,00
1022   YERBA TARAGUI 500GR                      $ 1.890,00
1040   AZUCAR LEDESMA 1KG                       $ 990,00
1055   ARROZ GALLO ORO 1KG                      $ 1.600,00
1060   FIDEOS MATARAZZO SPAGHETTI 500GR         $ 1.310,00
1061   FIDEOS LUCCHETTI TIRABUZON 500GR         $ 1.050,00
       ACEITE NATURA GIRASOL 1.5LT              $ 2.890,00
1090   HARINA PUREZA 0000 1KG                   $ 880,00
1101   CAFE LA VIRGINIA 500GR                   $ 8.100,00
1120   GALLETITAS OREO 118GR                    $ 990,00
       DDL SERENISIMA CLASICO 400G              $ 2.240,00
1150   PURE DE TOMATE ARCOR 520GR               $ 760,00
1160   LECHE EN POLVO NIDO 800GR                $ 10.400,00
1170   TE TARAGUI 25 SAQUITOS                   $ 710,00
1190   GALLETITAS TERRABUSI VARIEDAD 400GR      $ 1.650,00
1195   ACEITE DE OLIVA COCINERO 500ML           $ 5.900,00
1200   YERBA PLAYADITO 500GR                    $ 2.050,00
1210   ALFAJOR JORGITO CHOCOLATE CAJA X 6       $ 4.200,00
1220   QUESO CREMOSO LA PAULINA X KG            $ 6.900,00`;

export const DEMO_SUPPLIER_ID = "sup_sur";

export function seedDemo(now = Date.now(), newId = defaultNewId): Data {
  const day = 86400000;
  const settings = {
    ...DEFAULT_SETTINGS(),
    store: "Almacén Don Tito",
    demo: true,
    categories: [
      { name: "Almacén", margin: null, iva: null },
      { name: "Desayuno", margin: 45, iva: null },
      { name: "Bebidas", margin: 35, iva: null },
      { name: "Limpieza", margin: 38, iva: null },
      { name: "Perfumería", margin: 45, iva: null },
    ],
  };
  const sur: Supplier = { id: DEMO_SUPPLIER_ID, name: "Distribuidora del Sur", ivaIncluded: false, discount: 0, lastListAt: now - 41 * day, lists: 3, aiHint: "" };
  const cen: Supplier = { id: "sup_cen", name: "Mayorista Central", ivaIncluded: true, discount: 5, lastListAt: now - 9 * day, lists: 5, aiHint: "" };
  const P: [Supplier, string, string, string, number][] = [
    [sur, "1021", "Yerba Playadito 1 kg", "Desayuno", 3500],
    [sur, "1022", "Yerba Taragüí 500 g", "Desayuno", 1700],
    [sur, "1040", "Azúcar Ledesma 1 kg", "Almacén", 950],
    [sur, "1055", "Arroz Gallo Oro 1 kg", "Almacén", 1600],
    [sur, "1060", "Fideos Matarazzo Spaghetti 500 g", "Almacén", 1200],
    [sur, "1061", "Fideos Lucchetti Tirabuzón 500 g", "Almacén", 980],
    [sur, "", "Aceite Natura Girasol 1,5 l", "Almacén", 3100],
    [sur, "1090", "Harina Pureza 0000 1 kg", "Almacén", 820],
    [sur, "1101", "Café La Virginia 500 g", "Desayuno", 6200],
    [sur, "1120", "Galletitas Oreo 118 g", "Desayuno", 900],
    [sur, "", "Dulce de leche La Serenísima 400 g", "Desayuno", 2100],
    [sur, "1140", "Mermelada Arcor Durazno 454 g", "Desayuno", 1500],
    [sur, "1150", "Puré de tomate Arcor 520 g", "Almacén", 700],
    [sur, "1160", "Leche en polvo Nido 800 g", "Desayuno", 9800],
    [sur, "1170", "Té Taragüí 25 saquitos", "Desayuno", 650],
    [sur, "1210", "Alfajor Jorgito chocolate", "Desayuno", 3800 / 6],
    [sur, "1220", "Queso cremoso La Paulina", "Almacén", 6200],
    [cen, "MC204", "Coca-Cola 2,25 l", "Bebidas", 3300],
    [cen, "MC210", "Agua Villavicencio 2 l", "Bebidas", 1250],
    [cen, "MC233", "Fernet Branca 750 ml", "Bebidas", 11800],
    [cen, "MC240", "Cerveza Quilmes 1 l", "Bebidas", 2100],
    [cen, "MC310", "Detergente Magistral 500 ml", "Limpieza", 2350],
    [cen, "MC318", "Lavandina Ayudín 1 l", "Limpieza", 1100],
    [cen, "MC402", "Papel higiénico Higienol 4 u", "Limpieza", 2600],
    [cen, "MC415", "Jabón Dove 90 g", "Perfumería", 1450],
    [cen, "MC420", "Shampoo Sedal 340 ml", "Perfumería", 3700],
    [cen, "MC501", "Pilas Duracell AA x 2", "Almacén", 3900],
  ];
  const at = (s: Supplier) => s.lastListAt as number;
  const products: Product[] = P.map(([s, code, name, cat, lp]) => {
    const cost = costFromList(settings, lp, s, cat);
    const p: Product = { id: newId(), code, name, category: cat, supplierId: s.id, cost, price: 0, margin: null, updatedAt: at(s), priceAt: at(s), checkedAt: at(s) };
    p.price = priceFrom(settings, cost, p);
    // historial: dos listas anteriores con costos algo más bajos
    const m = 1 + marginFor(settings, p) / 100;
    p.hist = [
      [at(s) - 70 * day, r2(cost / 1.11), roundPrice(settings, (cost / 1.11) * m)],
      [at(s) - 35 * day, r2(cost / 1.05), roundPrice(settings, (cost / 1.05) * m)],
      [at(s), cost, p.price],
    ];
    p.buy = { type: "u" };
    p.sell = "u";
    return p;
  });
  const alf = products.find((p) => p.code === "1210")!;
  alf.buy = { type: "pack", n: 6 };
  const queso = products.find((p) => p.code === "1220")!;
  queso.buy = { type: "kg" };
  queso.sell = "kg";
  const fernet = products.find((p) => p.code === "MC233")!;
  fernet.cost = r2(fernet.cost * 1.18);
  fernet.price = roundPrice(settings, fernet.cost * 0.97);
  fernet.updatedAt = now - 2 * day;
  return { settings, suppliers: [sur, cen], products, maps: {}, history: [] };
}
