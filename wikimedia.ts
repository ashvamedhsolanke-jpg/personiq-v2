import {ImageItem} from './types';
export async function searchCommons(name:string):Promise<ImageItem[]>{
 const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:name,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',format:'json',origin:'*'});
 const res=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'PersonIQ/2.0 research app'}});
 if(!res.ok) throw new Error('Wikimedia image search failed');
 const data=await res.json(); const pages=Object.values(data?.query?.pages??{}) as any[];
 return pages.map(p=>{const m=p.imageinfo?.[0]||{};const e=m.extmetadata||{};return {url:m.thumburl||m.url,thumb:m.thumburl||m.url,title:(p.title||'').replace(/^File:/,''),sourceUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title||'')}`,license:e.LicenseShortName?.value,artist:e.Artist?.value?.replace(/<[^>]*>/g,''),attribution:e.Credit?.value?.replace(/<[^>]*>/g,'')};}).filter(x=>x.url);
}
