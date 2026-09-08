/* oxlint-disable next/no-html-link-for-pages, next/no-img-element */
import { getAdminUser } from '../admin-auth';
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from '../chatgpt-auth';
import { listAdminProducts } from '@/db/products';
import LoginForm from './login-form';
import ImageUploader from './image-uploader';

export const dynamic = 'force-dynamic';

type AdminPageProps = { searchParams?: Promise<{ status?: string }> };
const messages: Record<string, string> = {
  created: '상품을 등록했습니다.', updated: '상품 정보를 저장했습니다.',
  deleted: '상품을 삭제했습니다.', error: '상품 정보를 처리하지 못했습니다. 입력 내용을 확인해 주세요.',
};

export default async function Admin({ searchParams }: AdminPageProps) {
  const signedInUser = await getChatGPTUser();
  const admin = await getAdminUser();
  const status = (await searchParams)?.status;
  if (!admin) return <main className="panel"><a className="logo" href="/">somimall<i /></a><h1>관리자 로그인</h1><p className="note">상품 수정은 관리자 아이디와 비밀번호가 필요합니다.</p><LoginForm/><p><a href="/">← 쇼핑몰로 돌아가기</a></p></main>;

  let products = [] as Awaited<ReturnType<typeof listAdminProducts>>;
  let databaseReady = true;
  try { products = await listAdminProducts(); } catch (error) { databaseReady = false; console.error('Unable to load admin products', error); }

  return <main className="admin-shell">
    <header className="admin-header"><div><a className="logo" href="/">somimall<i /></a><p>운영자 전용 상품 관리</p></div><span>{admin.email}</span></header>
    {status && messages[status] ? <p className={status === 'error' ? 'error' : 'success'}>{messages[status]}</p> : null}
    {!databaseReady ? <p className="error">데이터베이스 배포 후 상품 관리가 활성화됩니다.</p> : null}
    <section className="admin-card"><h1>새 상품 등록</h1><form className="admin-form" action="/api/admin/products" method="post"><ProductFields /><button className="solid" type="submit" disabled={!databaseReady}>상품 등록</button></form></section>
    <section className="admin-products"><div className="section-head"><div><span className="eyebrow">PRODUCTS</span><h2>등록 상품</h2></div><span>{products.length}개</span></div>
      {!products.length ? <p className="note">아직 데이터베이스에 등록된 상품이 없습니다.</p> : null}
      {products.map((product) => <details className="admin-card" key={product.id}><summary><img src={product.image} alt="" /><span><b>{product.name}</b><small>{product.brand} · {product.price.toLocaleString('ko-KR')}원</small></span><em>{product.active ? '판매중' : '숨김'}</em></summary><form className="admin-form" action={`/api/admin/products/${encodeURIComponent(product.id)}`} method="post"><ProductFields product={product} /><div className="admin-actions"><button className="solid" type="submit">변경 저장</button><button className="danger" type="submit" name="_action" value="delete">상품 삭제</button></div></form></details>)}
    </section><p><a href="/">← 공개 쇼핑몰 보기</a></p>
  </main>;
}

function ProductFields({ product }: { product?: Awaited<ReturnType<typeof listAdminProducts>>[number] }) {
  return <div className="admin-grid">
    <label className="field">상품명<input name="name" required maxLength={100} defaultValue={product?.name} /></label>
    <label className="field">브랜드<input name="brand" required maxLength={80} defaultValue={product?.brand ?? 'SOMI SELECT'} /></label>
    <label className="field">카테고리<select name="category" defaultValue={product?.category ?? '상의'}>{['상의','하의','아우터','가방','신발','액세서리'].map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="field">판매가<input name="price" type="number" min="0" required defaultValue={product?.price ?? 0} /></label>
    <label className="field">정가<input name="originalPrice" type="number" min="0" required defaultValue={product?.original ?? 0} /></label>
    <label className="field">진열 순서<input name="sortOrder" type="number" required defaultValue={product?.sortOrder ?? 0} /></label>
    <label className="field">판매 상태<select name="saleStatus" defaultValue={product?.saleStatus ?? '판매중'}><option>판매중</option><option>품절</option><option>판매 준비</option></select></label>
    <ImageUploader value={product?.image} />
    <label className="field">색상(쉼표로 구분)<input name="colors" defaultValue={product?.colors.join(', ')} /></label>
    <label className="field">상품 배지<input name="badge" maxLength={30} defaultValue={product?.badge ?? '소미 셀렉트'} /></label>
    <label className="check"><input name="todayDispatch" type="checkbox" defaultChecked={product?.todayDispatch} /> 오늘출발</label>
    <label className="check"><input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> 쇼핑몰에 공개</label>
  </div>;
}
