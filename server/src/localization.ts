import {query,queryOne} from "./db";

export function isBcp47(value:string){try{new Intl.Locale(value);return true;}catch{return false;}}
export function acceptedLocales(header:string|undefined){return(header??"").split(",").map(part=>{const [tag,...params]=part.trim().split(";");const q=Number(params.find(p=>p.trim().startsWith("q="))?.split("=")[1]??1);return{tag:isBcp47(tag)?new Intl.Locale(tag).toString():"",q:Number.isFinite(q)?q:0};}).filter(x=>x.tag&&x.tag!=="*").sort((a,b)=>b.q-a.q).map(x=>x.tag);}

export async function resolveLocale(input:{marketKey?:string;requested?:string[];userId?:string;organizationId?:string}){
  const market=await queryOne<{default_locale:string;supported_locales:string[];default_currency:string}>(`SELECT default_locale,supported_locales,default_currency FROM commerce.markets WHERE market_key=$1 AND status='active'`,[input.marketKey??"NG"]);
  if(!market)throw new Error("Active market not found.");
  let organizationLocale:string|null=null;
  if(input.organizationId&&input.userId)organizationLocale=(await queryOne<{preferred_locale:string|null}>(`SELECT o.preferred_locale FROM accounts.organizations o JOIN accounts.organization_memberships m ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2 AND m.status='active'`,[input.organizationId,input.userId]))?.preferred_locale??null;
  const userLocale=input.userId?(await queryOne<{preferred_locale:string}>(`SELECT preferred_locale FROM accounts.users WHERE id=$1`,[input.userId]))?.preferred_locale:null;
  const candidates=[...(input.requested??[]),organizationLocale,userLocale,market.default_locale,"en-NG"].filter((x):x is string=>!!x);
  const locale=candidates.find(candidate=>market.supported_locales.includes(candidate))??market.default_locale;
  return{locale,currency:market.default_currency,supportedLocales:market.supported_locales};
}

export async function messagesForLocale(locale:string,keys:string[]){if(!keys.length)return{};const rows=await query<{message_key:string;message:string}>(`SELECT message_key,message FROM commerce.translation_messages WHERE locale=$1 AND status='active' AND message_key=ANY($2::text[])`,[locale,keys]);return Object.fromEntries(rows.map(r=>[r.message_key,r.message]));}
export function interpolate(message:string,values:Record<string,string|number>={}){return message.replace(/\{([a-zA-Z0-9_]+)\}/g,(_,key)=>String(values[key]??`{${key}}`));}
export function formatMinorCurrency(amountMinor:number,currency:string,locale:string){const formatter=new Intl.NumberFormat(locale,{style:"currency",currency});const digits=formatter.resolvedOptions().maximumFractionDigits??2;return formatter.format(amountMinor/10**digits);}

export async function updateUserPreferences(userId:string,input:{locale?:string;timezone?:string},marketKey="NG"){
  const context=await resolveLocale({marketKey});
  const locale=input.locale&&isBcp47(input.locale)?new Intl.Locale(input.locale).toString():input.locale;
  if(locale&&!context.supportedLocales.includes(locale))throw new Error("Locale is not supported in this market.");
  if(input.timezone){try{new Intl.DateTimeFormat("en",{timeZone:input.timezone}).format();}catch{throw new Error("Timezone is invalid.");}}
  const row=await queryOne<{preferred_locale:string;timezone:string}>(`UPDATE accounts.users SET preferred_locale=COALESCE($2,preferred_locale),timezone=COALESCE($3,timezone),updated_at=now() WHERE id=$1 RETURNING preferred_locale,timezone`,[userId,locale??null,input.timezone??null]);
  await query(`INSERT INTO accounts.audit_events(actor_user_id,subject_user_id,action,snapshot) VALUES($1,$1,'preferences_updated',$2::jsonb)`,[userId,JSON.stringify(row)]);return row;
}
