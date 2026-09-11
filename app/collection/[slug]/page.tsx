import { notFound } from 'next/navigation';
import { products as samples, PRODUCT_COLLECTIONS } from '@/app/catalog';
import StoreView from '@/app/components/store-view';
import { listStoreProducts } from '@/db/products';

export const dynamic = 'force-dynamic';

export default async function CollectionPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const collection=decodeURIComponent(slug);
  if (!(PRODUCT_COLLECTIONS as readonly string[]).includes(collection)) notFound();
  let products=samples;
  try { const saved=await listStoreProducts(); if(saved.length) products=saved; } catch {}
  return <StoreView mode="category" products={products} initialCollection={collection}/>;
}
