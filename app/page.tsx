import Shop from './shop';
import { products as sampleProducts } from './catalog';
import { listStoreProducts } from '@/db/products';
import { getAdminUser } from './admin-auth';

export const dynamic = 'force-dynamic';

export default async function Home(){
  let products = sampleProducts;
  const isAdmin = Boolean(await getAdminUser());
  try {
    const savedProducts = await listStoreProducts();
    if (savedProducts.length) products = savedProducts;
  } catch (error) {
    console.error('Unable to load store products', error);
  }
  return <Shop initialProducts={products} isAdmin={isAdmin}/>;
}
