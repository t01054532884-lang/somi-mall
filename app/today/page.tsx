import { products as samples } from '@/app/catalog';
import StoreView from '@/app/components/store-view';
import { listStoreProducts } from '@/db/products';

export const dynamic = 'force-dynamic';
export default async function TodayPage(){
  let products=samples;
  try { const saved=await listStoreProducts(); if(saved.length) products=saved; } catch {}
  return <StoreView mode="category" products={products} todayOnly/>;
}
