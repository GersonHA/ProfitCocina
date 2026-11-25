/**
 * Motor de análisis de justicia (Fase 2). Puro: sin DOM ni DB.
 *
 * Sobre los datos reales de un período, calcula para cada miembro su ganancia
 * con el acuerdo contra lo que ganaría vendiendo solo, el margen cedido/recibido,
 * el saldo de favores y el ROI; y compara los 5 modelos de precio (§6 del
 * documento). Probado con los Tests A, B y C (§7), que traen los números exactos.
 *
 * Idea de los modelos basados en intercambio (costo, costo+%, precio amigo,
 * compensación): cada miembro produce su recurso para todo el grupo, vende el
 * sobrante a los demás y cocina su propia comida. El precio al que se compran/
 * venden entre sí es lo que cambia de un modelo a otro.
 */

export interface Member {
  id: string;
  resource: string; // recurso que produce
}

export interface ResourceInfo {
  key: string;
  producerId: string;
  unitCost: number; // costo real por unidad (del Kardex)
  marketPrice: number; // precio de mercado neto por unidad
  buyOrder?: number; // orden de compra (para 'precio amigo')
  sellOrder?: number; // orden de venta (para 'precio amigo')
}

export interface MealInfo {
  memberId: string;
  revenue: number; // ventas netas de la comida cocinada
  otherCost: number; // estación y otros
  ingredients: { resource: string; qty: number }[];
}

export interface PeriodData {
  members: Member[];
  resources: ResourceInfo[];
  meals: MealInfo[];
}

export type ModelId = 'costo' | 'costo_pct' | 'precio_amigo' | 'compensacion' | 'pozo_comun';

export const MODEL_LABELS: Record<ModelId, string> = {
  costo: 'Precio de costo',
  costo_pct: 'Costo + %',
  precio_amigo: 'Precio amigo',
  compensacion: 'Costo + compensación',
  pozo_comun: 'Pozo común',
};

export interface MemberResult {
  memberId: string;
  dealProfit: number; // ganancia con el acuerdo
  soloProfit: number; // ganancia vendiendo solo en el mercado
  fair: boolean; // dealProfit >= soloProfit
  diff: number; // dealProfit - soloProfit
  marginCeded: number; // margen cedido al vender a otros
  marginReceived: number; // margen recibido al comprar a otros
  favorBalance: number; // recibido - cedido
  capital: number; // capital invertido
  roi: number; // dealProfit / capital
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface ModelResult {
  model: ModelId;
  label: string;
  pct?: number; // solo costo_pct
  members: MemberResult[];
  settlements?: Settlement[]; // solo compensacion
  alert?: string; // solo pozo_comun
  allFair: boolean;
}

const EPS = 1e-6;

function indexResources(data: PeriodData): Map<string, ResourceInfo> {
  const map = new Map<string, ResourceInfo>();
  for (const r of data.resources) map.set(r.key, r);
  return map;
}

/** Cantidad usada de cada recurso, total y por miembro (sumando todas las comidas). */
function computeUsage(data: PeriodData) {
  const total = new Map<string, number>();
  const byMember = new Map<string, Map<string, number>>();
  for (const meal of data.meals) {
    let m = byMember.get(meal.memberId);
    if (!m) {
      m = new Map();
      byMember.set(meal.memberId, m);
    }
    for (const ing of meal.ingredients) {
      total.set(ing.resource, (total.get(ing.resource) ?? 0) + ing.qty);
      m.set(ing.resource, (m.get(ing.resource) ?? 0) + ing.qty);
    }
  }
  return { total, byMember };
}

function unitPrice(r: ResourceInfo, model: ModelId, pct: number): number {
  switch (model) {
    case 'costo':
    case 'compensacion':
      return r.unitCost;
    case 'costo_pct':
      return r.unitCost * (1 + pct);
    case 'precio_amigo':
      return r.buyOrder != null && r.sellOrder != null ? (r.buyOrder + r.sellOrder) / 2 : r.marketPrice;
    default:
      return r.unitCost;
  }
}

/** Modelos basados en intercambio (todos menos pozo común). */
function computeTradeModel(data: PeriodData, model: ModelId, pct: number): MemberResult[] {
  const res = indexResources(data);
  const { total: production, byMember: usageBy } = computeUsage(data);
  const mealByMember = new Map(data.meals.map((m) => [m.memberId, m]));

  return data.members.map((member) => {
    const own = member.resource;
    const ownRes = res.get(own)!;
    const producedQty = production.get(own) ?? 0;
    const price = (key: string) => unitPrice(res.get(key)!, model, pct);

    const meal = mealByMember.get(member.id);
    const mealRevenue = meal?.revenue ?? 0;
    const otherCost = meal?.otherCost ?? 0;

    // Venta del sobrante de mi recurso a los demás.
    let salesQty = 0;
    for (const [mid, usage] of usageBy) {
      if (mid === member.id) continue;
      salesQty += usage.get(own) ?? 0;
    }
    const salesRevenue = salesQty * price(own);

    // Compras de ingredientes a otros miembros.
    let purchaseCost = 0;
    let marginReceived = 0;
    for (const ing of meal?.ingredients ?? []) {
      const r = res.get(ing.resource)!;
      if (r.producerId === member.id) continue; // mi propio recurso: no lo compro
      purchaseCost += ing.qty * price(ing.resource);
      marginReceived += ing.qty * (r.marketPrice - price(ing.resource));
    }

    const productionCost = producedQty * ownRes.unitCost;
    const dealProfit = mealRevenue + salesRevenue - productionCost - purchaseCost - otherCost;
    const soloProfit = producedQty * (ownRes.marketPrice - ownRes.unitCost);
    const marginCeded = salesQty * (ownRes.marketPrice - price(own));
    const favorBalance = marginReceived - marginCeded;
    const capital = productionCost;

    return {
      memberId: member.id,
      dealProfit,
      soloProfit,
      fair: dealProfit >= soloProfit - EPS,
      diff: dealProfit - soloProfit,
      marginCeded,
      marginReceived,
      favorBalance,
      capital,
      roi: capital > 0 ? dealProfit / capital : 0,
    };
  });
}

/** Pozo común (§6.2 #5): cada uno recupera su costo y su ganancia de granja; la
 *  ganancia de cocinar se reparte por el % del valor de mercado aportado. */
function computePozoComun(data: PeriodData): ModelResult {
  const res = indexResources(data);
  const { total: production } = computeUsage(data);

  const contrib = new Map<string, { cost: number; market: number }>();
  let totalMarket = 0;
  for (const member of data.members) {
    const r = res.get(member.resource)!;
    const qty = production.get(member.resource) ?? 0;
    const cost = qty * r.unitCost;
    const market = qty * r.marketPrice;
    contrib.set(member.id, { cost, market });
    totalMarket += market;
  }

  let totalRevenue = 0;
  let totalOther = 0;
  for (const meal of data.meals) {
    totalRevenue += meal.revenue;
    totalOther += meal.otherCost;
  }
  const cookingProfit = totalRevenue - totalMarket - totalOther;

  const members: MemberResult[] = data.members.map((member) => {
    const c = contrib.get(member.id)!;
    const farmProfit = c.market - c.cost;
    const share = totalMarket > 0 ? c.market / totalMarket : 0;
    const gain = farmProfit + share * cookingProfit;
    return {
      memberId: member.id,
      dealProfit: gain,
      soloProfit: farmProfit, // vender los ingredientes sueltos
      fair: gain >= farmProfit - EPS,
      diff: gain - farmProfit,
      marginCeded: 0,
      marginReceived: 0,
      favorBalance: 0,
      capital: c.cost,
      roi: c.cost > 0 ? gain / c.cost : 0,
    };
  });

  return {
    model: 'pozo_comun',
    label: MODEL_LABELS.pozo_comun,
    members,
    alert: totalRevenue < totalMarket - EPS ? 'Convenía vender los ingredientes sueltos.' : undefined,
    allFair: members.every((m) => m.fair),
  };
}

/** Liquidación del saldo de favores: quien se benefició (saldo +) paga a quien cedió (saldo −). */
export function settle(results: MemberResult[]): Settlement[] {
  const debtors = results
    .filter((r) => r.favorBalance > EPS)
    .map((r) => ({ id: r.memberId, amt: r.favorBalance }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = results
    .filter((r) => r.favorBalance < -EPS)
    .map((r) => ({ id: r.memberId, amt: -r.favorBalance }))
    .sort((a, b) => b.amt - a.amt);

  const settlements: Settlement[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di]!;
    const c = creditors[ci]!;
    const pay = Math.min(d.amt, c.amt);
    settlements.push({ from: d.id, to: c.id, amount: pay });
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt < EPS) di++;
    if (c.amt < EPS) ci++;
  }
  return settlements;
}

/** % de "costo + %" que deja el saldo de favores más cerca de cero. */
export function bestPct(data: PeriodData): number {
  let best = 0;
  let bestScore = Infinity;
  for (let pct = 0; pct <= 3.0001; pct += 0.01) {
    const results = computeTradeModel(data, 'costo_pct', pct);
    const score = results.reduce((s, r) => s + Math.abs(r.favorBalance), 0);
    if (score < bestScore - EPS) {
      bestScore = score;
      best = pct;
    }
  }
  return Math.round(best * 100) / 100;
}

export function computeModel(data: PeriodData, model: ModelId, opts: { pct?: number } = {}): ModelResult {
  if (model === 'pozo_comun') return computePozoComun(data);

  const pct = model === 'costo_pct' ? (opts.pct ?? bestPct(data)) : (opts.pct ?? 0);
  const members = computeTradeModel(data, model, pct);
  const result: ModelResult = {
    model,
    label: MODEL_LABELS[model],
    members,
    allFair: members.every((m) => m.fair),
  };
  if (model === 'costo_pct') result.pct = pct;
  if (model === 'compensacion') result.settlements = settle(members);
  return result;
}

/** Corre los 5 modelos y recomienda el más simple que deja a todos con ✅. */
export function compareModels(data: PeriodData): { models: ModelResult[]; recommended: ModelId | null } {
  const order: ModelId[] = ['costo', 'costo_pct', 'precio_amigo', 'compensacion', 'pozo_comun'];
  const models = order.map((m) => computeModel(data, m));
  const recommended = models.find((m) => m.allFair)?.model ?? null;
  return { models, recommended };
}
