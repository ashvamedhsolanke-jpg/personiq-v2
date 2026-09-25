import {NextRequest,NextResponse} from 'next/server';
import {researchPerson} from '@/lib/research';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{const body=await req.json();const name=String(body?.name||'').trim();if(name.length<2||name.length>120)return NextResponse.json({error:'Enter a valid person name.'},{status:400});const data=await researchPerson(name);return NextResponse.json(data,{headers:{'Cache-Control':'s-maxage=900, stale-while-revalidate=3600'}})}catch(e:any){return NextResponse.json({error:e?.message||'Research failed. Please try again.'},{status:500})}}
