import {notFound} from 'next/navigation';
import {products as samples} from '@/app/catalog';
import {listStoreProducts} from '@/db/products';
import ProductDetail from './product-detail';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params; let list=samples; try{const saved=await listStoreProducts();if(saved.length)list=saved}catch{}
 const product=list.find(p=>p.id===id);if(!product)notFound();return <ProductDetail product={product} recommendations={list.filter(p=>p.id!==id).slice(0,4)}/>;
}
