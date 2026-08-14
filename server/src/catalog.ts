import {query,queryOne} from "./db";

export interface CatalogProduct{productKey:string;category:string;fulfilmentType:string;name:string;description:string;creditCost:number|null;price:null|{amountMinor:number;currency:string;taxBehavior:string}}

export async function activeProduct(productKey:string,marketKey="NG"){
  return queryOne<{product_key:string;credit_cost:number|null}>(`SELECT p.product_key,p.credit_cost FROM commerce.products p JOIN commerce.market_products mp ON mp.product_key=p.product_key WHERE p.product_key=$1 AND mp.market_key=$2 AND p.status='active' AND mp.status='active'`,[productKey,marketKey]);
}

export async function publicCatalog(marketKey="NG",locale?:string):Promise<{market:{marketKey:string;countryCode:string;locale:string;currency:string};products:CatalogProduct[]} | null>{
  const market=await queryOne<{market_key:string;country_code:string;default_locale:string;supported_locales:string[];default_currency:string}>(`SELECT market_key,country_code,default_locale,supported_locales,default_currency FROM commerce.markets WHERE market_key=$1 AND status='active'`,[marketKey]);
  if(!market)return null;const selected=locale&&market.supported_locales.includes(locale)?locale:market.default_locale;
  const rows=await query<any>(`SELECT p.product_key,p.category,p.fulfilment_type,p.credit_cost,
    COALESCE(n.message,p.name_key) name,COALESCE(d.message,p.description_key) description,
    pr.amount_minor,pr.currency,pr.tax_behavior FROM commerce.products p
    JOIN commerce.market_products mp ON mp.product_key=p.product_key AND mp.market_key=$1 AND mp.status='active'
    LEFT JOIN commerce.translation_messages n ON n.message_key=p.name_key AND n.locale=$2 AND n.status='active'
    LEFT JOIN commerce.translation_messages d ON d.message_key=p.description_key AND d.locale=$2 AND d.status='active'
    LEFT JOIN LATERAL(SELECT amount_minor,currency,tax_behavior FROM commerce.prices WHERE product_key=p.product_key AND market_key=$1 AND status='active' AND valid_from<=now() AND(valid_to IS NULL OR valid_to>now()) ORDER BY valid_from DESC LIMIT 1)pr ON true
    WHERE p.status='active' ORDER BY p.category,p.product_key`,[marketKey,selected]);
  return{market:{marketKey:market.market_key,countryCode:market.country_code,locale:selected,currency:market.default_currency},products:rows.map((r:any)=>({productKey:r.product_key,category:r.category,fulfilmentType:r.fulfilment_type,name:r.name,description:r.description,creditCost:r.credit_cost,price:r.amount_minor===null?null:{amountMinor:Number(r.amount_minor),currency:r.currency,taxBehavior:r.tax_behavior}}))};
}
