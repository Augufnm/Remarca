import { describe, expect, it } from "vitest";
import { parseNum, tidyName } from "@/lib/core/format";
import { DEFAULT_SETTINGS, costFromList, isLoss, marginFor, packOf, priceFrom, roundPrice } from "@/lib/core/pricing";
import { CatalogIndex, candidates, itemKey, matchItems, norm } from "@/lib/core/match";
import { dedupeItems, guessCols, heuristicLines, rowsToItems, cleanAiItems } from "@/lib/core/listread";
import { DEMO_LIST, DEMO_SUPPLIER_ID, seedDemo } from "@/lib/core/demo";
import { applyReview, calcItem, recalcAll, reviewCalc, undoBatch } from "@/lib/core/review";
import type { Data, Review, Settings } from "@/lib/core/types";

const S = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS(), ...o });

describe("parseNum (formato argentino)", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["12.500", 12500],
    ["1,5", 1.5],
    ["$ 10.400,00", 10400],
    ["$ 990,00", 990],
    ["1,234.56", 1234.56],
    ["0,750", 0.75],
    ["3950", 3950],
    [42, 42],
  ])("%s → %s", (input, out) => expect(parseNum(input)).toBe(out));
  it("devuelve NaN si no hay número", () => {
    expect(parseNum("")).toBeNaN();
    expect(parseNum("sin precio")).toBeNaN();
  });
});

describe("unidades por precio (packOf)", () => {
  it("bulto de N → N", () => expect(packOf({ buy: { type: "pack", n: 12 }, sell: "u" })).toBe(12));
  it("kilo vendido por 100 g → 10", () => expect(packOf({ buy: { type: "kg" }, sell: "100g" })).toBe(10));
  it("kilo vendido por kilo → 1", () => expect(packOf({ buy: { type: "kg" }, sell: "kg" })).toBe(1));
  it("unidad → 1", () => expect(packOf({ buy: { type: "u" } })).toBe(1));
  it("sin datos → 1", () => expect(packOf(null)).toBe(1));
});

describe("costo por unidad de venta (costFromList)", () => {
  const st = S({ categories: [{ name: "Libros", margin: null, iva: 10.5 }] });
  it("lista sin IVA suma el IVA general", () => expect(costFromList(st, 1000, { ivaIncluded: false, discount: 0 }, "")).toBe(1210));
  it("lista con IVA no lo suma", () => expect(costFromList(st, 1000, { ivaIncluded: true, discount: 0 }, "")).toBe(1000));
  it("usa el IVA de la categoría", () => expect(costFromList(st, 1000, { ivaIncluded: false, discount: 0 }, "Libros")).toBe(1105));
  it("resta la bonificación", () => expect(costFromList(st, 1000, { ivaIncluded: true, discount: 5 }, "")).toBe(950));
  it("divide por las unidades", () => expect(costFromList(st, 4200, { ivaIncluded: false, discount: 0 }, "", null, 6)).toBe(847));
  it("el IVA de la revisión pisa al del proveedor", () => expect(costFromList(st, 1000, { ivaIncluded: false, discount: 0 }, "", true)).toBe(1000));
});

describe("margen (marginFor)", () => {
  const st = S({ margin: 40, categories: [{ name: "Bebidas", margin: 35, iva: null }] });
  it("del producto", () => expect(marginFor(st, { category: "Bebidas", margin: 20 })).toBe(20));
  it("de la categoría", () => expect(marginFor(st, { category: "Bebidas", margin: null })).toBe(35));
  it("general", () => expect(marginFor(st, { category: "Otra", margin: null })).toBe(40));
});

describe("redondeo (roundPrice)", () => {
  it("terminación 9", () => {
    expect(roundPrice(S({ ending: "9" }), 1234.5)).toBe(1239);
    expect(roundPrice(S({ ending: "9" }), 1300)).toBe(1309);
  });
  it("terminación 90", () => expect(roundPrice(S({ ending: "90" }), 1234.5)).toBe(1290));
  it("terminación 99", () => expect(roundPrice(S({ ending: "99" }), 1234.5)).toBe(1299));
  it("paso $ 10 hacia arriba", () => expect(roundPrice(S({ round: 10 }), 1231)).toBe(1240));
  it("paso $ 10 exacto no sube", () => expect(roundPrice(S({ round: 10 }), 1230)).toBe(1230));
  it("paso $ 50 al más cercano", () => expect(roundPrice(S({ round: 50, roundMode: "near" }), 1224)).toBe(1200));
  it("sin redondeo: centavos", () => expect(roundPrice(S({ round: 0 }), 1234.567)).toBe(1234.57));
  it("precio de venta = costo × (1 + margen)", () => expect(priceFrom(S({ margin: 40, round: 10 }), 1000, { category: "" })).toBe(1400));
});

describe("a pérdida", () => {
  it("precio menor al costo", () => expect(isLoss({ cost: 100, price: 90 })).toBe(true));
  it("precio igual al costo no", () => expect(isLoss({ cost: 100, price: 100 })).toBe(false));
});

describe("normalización y vinculación", () => {
  it("unifica unidades", () => {
    expect(norm("YERBA PLAYADITO 1KG")).toBe(norm("Yerba Playadito 1 kg"));
    expect(norm("Arroz 1000 gr")).toBe("arroz 1kg");
    expect(norm("ACEITE 1.5LT")).toBe(norm("Aceite 1,5 l"));
    expect(norm("Taragüí 500GR")).toBe("taragui 500g");
  });
  it("clave del renglón por código o descripción", () => {
    expect(itemKey("0012", "x")).toBe("c:12");
    expect(itemKey("", "Yerba 1KG")).toBe("d:yerba 1kg");
  });
  it("ordena candidatos y castiga tamaños distintos", () => {
    const data = seedDemo(Date.now(), seq());
    const idx = new CatalogIndex(data.products);
    const c = candidates(idx, "YERBA PLAYADITO 500GR", DEMO_SUPPLIER_ID);
    const byName = (id: string) => data.products.find((p) => p.id === id)!.name;
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].score).toBeLessThan(0.42);
    expect(c.map((x) => byName(x.id))).toContain("Yerba Playadito 1 kg");
  });
});

describe("lectura sin IA", () => {
  it("lee la lista de ejemplo", () => {
    const items = heuristicLines(DEMO_LIST.split("\n"));
    expect(items).toHaveLength(19);
    expect(items[0]).toEqual({ code: "1021", desc: "YERBA PLAYADITO 1KG", cost: 3950, pack: 1 });
    const alf = items.find((i) => i.code === "1210")!;
    expect(alf.pack).toBe(6);
    const aceite = items.find((i) => i.desc.startsWith("ACEITE NATURA"))!;
    expect(aceite.code).toBe("");
    expect(aceite.cost).toBe(2890);
  });
  it("reconoce columnas de una planilla", () => {
    const rows = [
      ["Distribuidora X", "", ""],
      ["Código", "Descripción", "Precio s/IVA"],
      ["A1", "Yerba Playadito 1kg", "3.950,00"],
      ["A2", "Azúcar Ledesma 1kg", 990],
      ["A3", "Arroz Gallo 1kg", "1600"],
    ];
    const cols = guessCols(rows, false);
    expect(cols).toMatchObject({ header: 1, code: 0, desc: 1, cost: 2 });
    expect(rowsToItems(rows, cols)).toEqual([
      { code: "A1", desc: "Yerba Playadito 1kg", cost: 3950 },
      { code: "A2", desc: "Azúcar Ledesma 1kg", cost: 990 },
      { code: "A3", desc: "Arroz Gallo 1kg", cost: 1600 },
    ]);
  });
  it("normaliza la salida de la IA", () => {
    expect(cleanAiItems({ items: [["1", "Yerba 1kg", "3.950,00", 1], ["", "Caja alfajor", 4200, 6], ["", "", 10, 1]] })).toEqual([
      { code: "1", desc: "Yerba 1kg", cost: 3950, pack: 1 },
      { code: "", desc: "Caja alfajor", cost: 4200, pack: 6 },
    ]);
  });
  it("quita duplicados", () => {
    expect(dedupeItems([{ code: "1", desc: "a", cost: 1 }, { code: "1", desc: "b", cost: 2 }])).toEqual([{ code: "1", desc: "b", cost: 2 }]);
  });
  it("ordena nombres en mayúsculas", () => expect(tidyName("YERBA PLAYADITO 500GR")).toBe("Yerba Playadito 500 g"));
});

/* ---------- criterios de aceptación (sección 12) ---------- */

function seq(prefix = "id") {
  let n = 0;
  return () => prefix + ++n;
}

function demoReview(data: Data): Review {
  const sup = data.suppliers.find((s) => s.id === DEMO_SUPPLIER_ID)!;
  const raw = dedupeItems(heuristicLines(DEMO_LIST.split("\n")));
  const idx = new CatalogIndex(data.products);
  const items = matchItems(idx, raw, sup, data.maps);
  for (const it of items) if (!it.productId && !it.doubt && !it.ignored) it.include = data.products.length < 10;
  return { supId: sup.id, items, source: "texto", fileName: "Texto pegado", meta: {}, warn: [], filter: null, newCat: "", ivaOverride: null, open: {}, leave: false };
}

describe("criterios de aceptación con la lista de ejemplo", () => {
  const now = 1_760_000_000_000;

  it("el dulce de leche queda como duda con la sugerencia correcta", () => {
    const data = seedDemo(now, seq());
    const R = demoReview(data);
    const ddl = R.items.find((i) => i.desc === "DDL SERENISIMA CLASICO 400G")!;
    expect(ddl.doubt).toBe(true);
    expect(data.products.find((p) => p.id === ddl.suggest)!.name).toBe("Dulce de leche La Serenísima 400 g");
  });

  it("la yerba Playadito 500 g sale como nueva y no se confunde", () => {
    const data = seedDemo(now, seq());
    const R = demoReview(data);
    const sup = data.suppliers[0];
    const idx = new CatalogIndex(data.products);
    const it = R.items.find((i) => i.desc === "YERBA PLAYADITO 500GR")!;
    expect(it.productId).toBeNull();
    expect(it.doubt).toBe(false);
    expect(calcItem(data.settings!, idx, it, R, sup).st).toBe("new");
  });

  it("el alfajor (caja x 6) da costo $ 847 por unidad", () => {
    const data = seedDemo(now, seq());
    const R = demoReview(data);
    const sup = data.suppliers[0];
    const idx = new CatalogIndex(data.products);
    const alf = R.items.find((i) => i.code === "1210")!;
    expect(alf.match).toBe("codigo");
    expect(calcItem(data.settings!, idx, alf, R, sup).nc).toBe(847);
  });

  it("al confirmar la duda: subieron 14, bajó 1 (aceite) y 1 sin cambio (arroz)", () => {
    const data = seedDemo(now, seq());
    const R = demoReview(data);
    const sup = data.suppliers[0];
    const ddl = R.items.find((i) => i.doubt)!;
    ddl.productId = ddl.suggest!;
    ddl.doubt = false;
    ddl.include = true;
    ddl.match = "manual";
    const idx = new CatalogIndex(data.products);
    const { C, n } = reviewCalc(data.settings!, idx, R, sup);
    expect(n.up).toBe(14);
    expect(n.down).toBe(1);
    expect(n.same).toBe(1);
    expect(n.doubt).toBe(0);
    const name = (st: string) => R.items.filter((_, i) => C[i].st === st).map((_, i) => i);
    expect(name("down")).toHaveLength(1);
    expect(R.items[C.findIndex((c) => c.st === "down")].desc).toMatch(/ACEITE NATURA/);
    expect(R.items[C.findIndex((c) => c.st === "same")].desc).toMatch(/ARROZ GALLO/);
  });

  it("deshacer la última lista deja todo exactamente como estaba", () => {
    const data = seedDemo(now, seq());
    const before = JSON.parse(JSON.stringify({ products: data.products, suppliers: data.suppliers }));
    const R = demoReview(data);
    for (const it of R.items) if (it.doubt) Object.assign(it, { productId: it.suggest, doubt: false, include: true, match: "manual" });
    for (const it of R.items) if (!it.productId && !it.ignored) it.include = true; // agrega los nuevos
    const batch = applyReview(data, R, now + 1000, seq("new"));
    expect(batch.counts.new).toBe(3);
    expect(data.products.length).toBe(30);
    expect(data.suppliers[0].lastListAt).toBe(now + 1000);
    expect(undoBatch(data, batch.id)).toBe(true);
    expect(JSON.parse(JSON.stringify({ products: data.products, suppliers: data.suppliers }))).toEqual(before);
    expect(data.history[0].undone).toBe(true);
  });

  it("la memoria del proveedor vincula en la lista siguiente", () => {
    const data = seedDemo(now, seq());
    const R = demoReview(data);
    for (const it of R.items) if (it.doubt) Object.assign(it, { productId: it.suggest, doubt: false, include: true, match: "manual" });
    applyReview(data, R, now + 1000, seq("new"));
    const R2 = demoReview(data);
    const ddl = R2.items.find((i) => i.desc.startsWith("DDL"))!;
    expect(ddl.match).toBe("memoria");
    // los nuevos que no se agregaron quedan como "no lo vendo"
    expect(R2.items.find((i) => i.desc === "YERBA PLAYADITO 500GR")!.ignored).toBe(true);
  });

  it("recalcular saltea precio fijo y se puede deshacer", () => {
    const data = seedDemo(now, seq());
    data.products[0].lock = true;
    const lockedPrice = data.products[0].price;
    data.settings!.margin = 60;
    const prices = data.products.map((p) => p.price);
    const b = recalcAll(data, now + 1, seq("b"))!;
    expect(b.changes.length).toBeGreaterThan(0);
    expect(data.products[0].price).toBe(lockedPrice);
    undoBatch(data, b.id);
    expect(data.products.map((p) => p.price)).toEqual(prices);
  });
});
