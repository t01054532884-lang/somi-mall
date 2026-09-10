/* oxlint-disable next/no-html-link-for-pages, next/no-img-element */
import { getAdminUser } from '../admin-auth';
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from '../chatgpt-auth';
import {
  listAdminInquiries,
  listAdminProducts,
  listAdminReviews,
} from '@/db/products';
import { listAdminOrders } from '@/db/orders';
import LoginForm from './login-form';
import ImageUploader, { DetailImageUploader } from './image-uploader';
import { PRODUCT_COLLECTIONS } from '@/app/catalog';

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams?: Promise<{ status?: string; orderTab?: string }>;
};
const messages: Record<string, string> = {
  created: '상품을 등록했습니다.',
  updated: '상품 정보를 저장했습니다.',
  deleted: '상품을 삭제했습니다.',
  error: '상품 정보를 처리하지 못했습니다. 입력 내용을 확인해 주세요.',
  review_replied: '리뷰 답글을 저장했습니다.',
  review_deleted: '리뷰를 삭제했습니다.',
  inquiry_answered: '문의 답변을 저장했습니다.',
  inquiry_deleted: '문의를 삭제했습니다.',
  order_updated: '주문 상태와 배송 정보를 저장했습니다.',
  order_error: '주문 정보를 처리하지 못했습니다.',
  order_stock_error: '재고가 부족해 주문 상태를 되돌리지 못했습니다.',
};

export default async function Admin({ searchParams }: AdminPageProps) {
  const signedInUser = await getChatGPTUser();
  const admin = await getAdminUser();
  const query = await searchParams,
    status = query?.status,
    orderTab = query?.orderTab ?? '진행 주문';
  if (!admin)
    return (
      <main className="panel">
        <a className="logo" href="/">
          somimall
          <i />
        </a>
        <h1>관리자 로그인</h1>
        <p className="note">
          상품 수정은 관리자 아이디와 비밀번호가 필요합니다.
        </p>
        <LoginForm />
        <p>
          <a href="/">← 쇼핑몰로 돌아가기</a>
        </p>
      </main>
    );

  let products = [] as Awaited<ReturnType<typeof listAdminProducts>>;
  let reviews = [] as Awaited<ReturnType<typeof listAdminReviews>>;
  let inquiries = [] as Awaited<ReturnType<typeof listAdminInquiries>>;
  let orders = [] as Awaited<ReturnType<typeof listAdminOrders>>;
  let databaseReady = true;
  try {
    [products, reviews, inquiries, orders] = await Promise.all([
      listAdminProducts(),
      listAdminReviews(),
      listAdminInquiries(),
      listAdminOrders(),
    ]);
  } catch (error) {
    databaseReady = false;
    console.error('Unable to load admin data', error);
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <a className="logo" href="/">
            somimall
            <i />
          </a>
          <p>운영자 전용 상품 관리</p>
        </div>
        <span>{admin.email}</span>
      </header>
      {status && messages[status] ? (
        <p className={status === 'error' ? 'error' : 'success'}>
          {messages[status]}
        </p>
      ) : null}
      {!databaseReady ? (
        <p className="error">데이터베이스 배포 후 상품 관리가 활성화됩니다.</p>
      ) : null}
      <section className="admin-orders" id="orders">
        <div className="section-head">
          <div>
            <span className="eyebrow">ORDERS</span>
            <h1>주문·배송 관리</h1>
          </div>
          <a className="solid" href="/api/admin/orders/export">
            전체 주문 CSV 다운로드
          </a>
        </div>
        <p className="note">
          결제 API 연결 전 주문 접수 상태로 저장됩니다. 기본 택배사는
          로젠택배이며 운송장 번호를 직접 입력할 수 있습니다.
        </p>
        <nav className="admin-tabs">
          {['진행 주문', '취소', '반품'].map((tab) => (
            <a
              key={tab}
              className={orderTab === tab ? 'selected' : ''}
              href={`/admin?orderTab=${encodeURIComponent(tab)}#orders`}
            >
              {tab}{' '}
              <b>
                {
                  orders.filter((order) =>
                    tab === '진행 주문'
                      ? !['취소', '반품'].includes(order.status)
                      : order.status === tab,
                  ).length
                }
              </b>
            </a>
          ))}
        </nav>
        {orders
          .filter((order) =>
            orderTab === '진행 주문'
              ? !['취소', '반품'].includes(order.status)
              : order.status === orderTab,
          )
          .map((order) => (
            <article className="admin-card order-card" key={order.id}>
              <header>
                <div>
                  <b>{order.orderNumber}</b>
                  <small>
                    {adminDate(order.createdAt)} · {order.memberName} ·{' '}
                    {order.phone}
                  </small>
                </div>
                <em>{order.status}</em>
              </header>
              <p>
                {order.items
                  .map(
                    (item) =>
                      `${item.productName} (${item.optionName}) × ${item.quantity}`,
                  )
                  .join(', ')}
              </p>
              <p>
                <b>{order.total.toLocaleString('ko-KR')}원</b> ·{' '}
                {order.recipient} · {order.address}
              </p>
              {order.memo ? <small>배송메모: {order.memo}</small> : null}
              <form
                action={`/api/admin/orders/${order.id}`}
                method="post"
                className="order-form"
              >
                <label className="field">
                  주문 상태
                  <select name="status" defaultValue={order.status}>
                    {[
                      '신규 주문',
                      '배송 준비',
                      '배송중',
                      '배송완료',
                      '취소',
                      '반품',
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  로젠택배 운송장
                  <input
                    name="trackingNumber"
                    defaultValue={order.trackingNumber}
                    placeholder="운송장 번호"
                  />
                </label>
                <button className="solid" type="submit">
                  주문 저장
                </button>
              </form>
            </article>
          ))}
        {!orders.length ? (
          <p className="note">접수된 주문이 없습니다.</p>
        ) : null}
      </section>
      <section className="admin-card">
        <h1>새 상품 등록</h1>
        <p className="note">
          대표 이미지뿐 아니라 상세 이미지, 설명, 실측 사이즈와 판매자 정보까지
          입력할 수 있습니다.
        </p>
        <form className="admin-form" action="/api/admin/products" method="post">
          <ProductFields />
          <button className="solid" type="submit" disabled={!databaseReady}>
            상품 등록
          </button>
        </form>
      </section>
      <section className="admin-products">
        <div className="section-head">
          <div>
            <span className="eyebrow">PRODUCTS</span>
            <h2>등록 상품</h2>
          </div>
          <span>{products.length}개</span>
        </div>
        {!products.length ? (
          <p className="note">아직 데이터베이스에 등록된 상품이 없습니다.</p>
        ) : null}
        {products.map((product) => (
          <details className="admin-card" key={product.id}>
            <summary>
              <img src={product.image} alt="" />
              <span>
                <b>{product.name}</b>
                <small>
                  {product.brand} · {product.price.toLocaleString('ko-KR')}원
                </small>
              </span>
              <em>{product.active ? '판매중' : '숨김'}</em>
            </summary>
            <form
              className="admin-form"
              action={`/api/admin/products/${encodeURIComponent(product.id)}`}
              method="post"
            >
              <ProductFields product={product} />
              <div className="admin-actions">
                <button className="solid" type="submit">
                  변경 저장
                </button>
                <button
                  className="danger"
                  type="submit"
                  name="_action"
                  value="delete"
                >
                  상품 삭제
                </button>
              </div>
            </form>
          </details>
        ))}
      </section>
      <section className="admin-feedback" id="reviews">
        <div className="section-head">
          <div>
            <span className="eyebrow">REVIEWS</span>
            <h2>리뷰 관리</h2>
          </div>
          <span>{reviews.length}개</span>
        </div>
        {!reviews.length ? (
          <p className="note">등록된 리뷰가 없습니다.</p>
        ) : null}
        {reviews.map((review) => (
          <article className="admin-card feedback-card" key={review.id}>
            <header>
              <div>
                <b>{review.productName}</b>
                <small>
                  {review.memberName} · {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)} ·{' '}
                  {adminDate(review.createdAt)}
                </small>
              </div>
              <a href={`/product/${review.productId}#reviews`}>상품에서 보기</a>
            </header>
            <p>{review.content}</p>
            <form action={`/api/admin/reviews/${review.id}`} method="post">
              <label className="field">
                관리자 답글
                <textarea
                  name="reply"
                  rows={3}
                  maxLength={1000}
                  defaultValue={review.adminReply}
                  placeholder="고객에게 보여줄 답글을 작성하세요."
                />
              </label>
              <div className="admin-actions">
                <button className="solid" type="submit">
                  답글 저장
                </button>
                <button
                  className="danger"
                  type="submit"
                  name="_action"
                  value="delete"
                >
                  리뷰 삭제
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
      <section className="admin-feedback" id="inquiries">
        <div className="section-head">
          <div>
            <span className="eyebrow">INQUIRIES</span>
            <h2>문의 답변</h2>
          </div>
          <span>{inquiries.length}개</span>
        </div>
        {!inquiries.length ? (
          <p className="note">등록된 문의가 없습니다.</p>
        ) : null}
        {inquiries.map((inquiry) => (
          <article className="admin-card feedback-card" key={inquiry.id}>
            <header>
              <div>
                <b>{inquiry.productName}</b>
                <small>
                  {inquiry.memberName} · {adminDate(inquiry.createdAt)}
                </small>
              </div>
              <a href={`/product/${inquiry.productId}#inquiries`}>
                상품에서 보기
              </a>
            </header>
            <p>
              <b>Q.</b> {inquiry.content}
            </p>
            <form action={`/api/admin/inquiries/${inquiry.id}`} method="post">
              <label className="field">
                답변
                <textarea
                  name="answer"
                  rows={4}
                  required
                  minLength={2}
                  maxLength={1000}
                  defaultValue={inquiry.answer}
                  placeholder="문의에 대한 답변을 작성하세요."
                />
              </label>
              <div className="admin-actions">
                <button className="solid" type="submit">
                  답변 저장
                </button>
                <button
                  className="danger"
                  type="submit"
                  name="_action"
                  value="delete"
                >
                  문의 삭제
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
      <p>
        <a href="/">← 공개 쇼핑몰 보기</a>
      </p>
    </main>
  );
}

function ProductFields({
  product,
}: {
  product?: Awaited<ReturnType<typeof listAdminProducts>>[number];
}) {
  return (
    <div className="admin-grid">
      <label className="field">
        상품명
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={product?.name}
        />
      </label>
      <label className="field">
        브랜드
        <input
          name="brand"
          required
          maxLength={80}
          defaultValue={product?.brand ?? 'SOMI SELECT'}
        />
      </label>
      <fieldset className="collection-field admin-wide">
        <legend>
          노출 목록 <small>두 개 이상 선택할 수 있습니다.</small>
        </legend>
        <div className="collection-options">
          {PRODUCT_COLLECTIONS.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                name="collections"
                value={item}
                defaultChecked={(product?.collections?.length
                  ? product.collections
                  : product
                    ? [product.category]
                    : ['NEW']
                ).includes(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        판매가
        <input
          name="price"
          type="number"
          min="0"
          required
          defaultValue={product?.price ?? 0}
        />
      </label>
      <label className="field">
        정가
        <input
          name="originalPrice"
          type="number"
          min="0"
          required
          defaultValue={product?.original ?? 0}
        />
      </label>
      <label className="field">
        진열 순서
        <input
          name="sortOrder"
          type="number"
          required
          defaultValue={product?.sortOrder ?? 0}
        />
      </label>
      <label className="field">
        재고 수량
        <input
          name="stock"
          type="number"
          min="0"
          required
          defaultValue={product?.stock ?? 10}
        />
      </label>
      <label className="field">
        판매 상태
        <select
          name="saleStatus"
          defaultValue={product?.saleStatus ?? '판매중'}
        >
          <option>판매중</option>
          <option>품절</option>
          <option>판매 준비</option>
        </select>
      </label>
      <label className="field">
        스타일 분류
        <select name="styleTag" defaultValue={product?.styleTag ?? '미분류'}>
          <option>미분류</option>
          <option>에겐녀</option>
          <option>테토녀</option>
        </select>
      </label>
      <ImageUploader value={product?.image} />
      <DetailImageUploader value={product?.detailImages} />
      <label className="field admin-wide">
        상품 상세 설명
        <textarea
          name="description"
          rows={7}
          maxLength={10000}
          placeholder="핏, 촉감, 코디 팁, 세탁 방법 등 상품을 자세히 설명해 주세요."
          defaultValue={product?.description}
        />
      </label>
      <label className="field">
        색상(쉼표로 구분)
        <input name="colors" defaultValue={product?.colors.join(', ')} />
      </label>
      <label className="field">
        상품 배지
        <input
          name="badge"
          maxLength={30}
          defaultValue={product?.badge ?? '소미 셀렉트'}
        />
      </label>
      <label className="field">
        소재 또는 재질
        <input name="material" defaultValue={product?.material} />
      </label>
      <label className="field">
        제조국
        <input name="origin" defaultValue={product?.origin} />
      </label>
      <label className="field">
        제조자
        <input name="manufacturer" defaultValue={product?.manufacturer} />
      </label>
      <label className="field admin-wide">
        실측 사이즈표
        <textarea
          name="sizeChart"
          rows={5}
          placeholder={
            'FREE | 64 | 52 | 56 | 67 | 17 | 23 | 40\nM | 66 | 54 | 58 | 68 | 18 | 24 | 42'
          }
          defaultValue={sizeChartToText(product?.sizeChart)}
        />
        <small>
          사이즈 | 총장 | 어깨 | 가슴단면 | 소매길이 | 소매단면 | 암홀단면 |
          밑단단면 순서로 한 줄씩 입력 (cm)
        </small>
      </label>
      <div className="admin-wide admin-subheading">
        <h2>판매자 정보</h2>
        <p>입력한 항목만 상품 상세에 공개됩니다.</p>
      </div>
      <label className="field">
        상호
        <input name="sellerName" defaultValue={product?.seller?.name} />
      </label>
      <label className="field">
        대표자
        <input
          name="sellerRepresentative"
          defaultValue={product?.seller?.representative}
        />
      </label>
      <label className="field admin-wide">
        주소
        <input name="sellerAddress" defaultValue={product?.seller?.address} />
      </label>
      <label className="field">
        사업자등록번호
        <input
          name="sellerBusinessNumber"
          defaultValue={product?.seller?.businessNumber}
        />
      </label>
      <label className="field">
        통신판매업신고번호
        <input
          name="sellerMailOrderNumber"
          defaultValue={product?.seller?.mailOrderNumber}
        />
      </label>
      <label className="field">
        이메일
        <input
          name="sellerEmail"
          type="email"
          defaultValue={product?.seller?.email}
        />
      </label>
      <label className="field">
        전화번호
        <input
          name="sellerPhone"
          type="tel"
          defaultValue={product?.seller?.phone}
        />
      </label>
      <label className="check">
        <input
          name="todayDispatch"
          type="checkbox"
          defaultChecked={product?.todayDispatch}
        />{' '}
        오늘출발
      </label>
      <label className="check">
        <input
          name="active"
          type="checkbox"
          defaultChecked={product?.active ?? true}
        />{' '}
        쇼핑몰에 공개
      </label>
    </div>
  );
}

function sizeChartToText(
  rows: Awaited<ReturnType<typeof listAdminProducts>>[number]['sizeChart'],
) {
  return (rows ?? [])
    .map((row) =>
      [
        row.size,
        row.totalLength,
        row.shoulder,
        row.chest,
        row.sleeve,
        row.sleeveOpening,
        row.armhole,
        row.hem,
      ].join(' | '),
    )
    .join('\n');
}
function adminDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
