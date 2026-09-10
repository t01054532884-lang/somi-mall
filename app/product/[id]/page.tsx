import { notFound } from 'next/navigation';
import { products as samples } from '@/app/catalog';
import {
  getStoreProduct,
  listStoreProducts,
  listProductReviews,
  listProductInquiries,
} from '@/db/products';
import { getMemberSession } from '@/app/google-auth';
import ProductDetail from './product-detail';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let list = samples;
  let product = samples.find((p) => p.id === id);
  try {
    const [saved, fullProduct] = await Promise.all([
      listStoreProducts(),
      getStoreProduct(id),
    ]);
    if (saved.length) {
      list = saved;
      product = fullProduct ?? undefined;
    } else if (fullProduct) product = fullProduct;
  } catch {}
  if (!product) notFound();
  const member = await getMemberSession();
  let reviews = [] as Awaited<ReturnType<typeof listProductReviews>>,
    inquiries = [] as Awaited<ReturnType<typeof listProductInquiries>>;
  try {
    [reviews, inquiries] = await Promise.all([
      listProductReviews(id),
      listProductInquiries(id),
    ]);
  } catch {}
  return (
    <ProductDetail
      product={product}
      recommendations={list.filter((p) => p.id !== id).slice(0, 4)}
      reviews={reviews}
      inquiries={inquiries}
      member={member ? { name: member.displayName } : null}
    />
  );
}
