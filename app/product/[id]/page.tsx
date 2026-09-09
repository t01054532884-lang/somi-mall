import {notFound} from 'next/navigation';
import {products as samples} from '@/app/catalog';
import {listStoreProducts,listProductReviews,listProductInquiries} from '@/db/products';
import {getMemberSession} from '@/app/google-auth';
import ProductDetail from './product-detail';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params; let list=samples; try{const saved=await listStoreProducts();if(saved.length)list=saved}catch{}
 const product=list.find(p=>p.id===id);if(!product)notFound();const member=await getMemberSession();let reviews=[] as Awaited<ReturnType<typeof listProductReviews>>,inquiries=[] as Awaited<ReturnType<typeof listProductInquiries>>;try{[reviews,inquiries]=await Promise.all([listProductReviews(id),listProductInquiries(id)])}catch{}
 return <ProductDetail product={product} recommendations={list.filter(p=>p.id!==id).slice(0,4)} reviews={reviews} inquiries={inquiries} member={member?{name:member.displayName}:null}/>;
}
