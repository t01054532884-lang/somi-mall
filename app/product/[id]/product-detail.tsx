'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { money, type Product } from '@/app/catalog';
import type { ProductInquiry, ProductReview } from '@/db/products';

type Tab = '상품정보' | '리뷰' | '사이즈' | '문의';
export default function ProductDetail({
  product,
  recommendations,
  reviews,
  inquiries,
  member,
}: {
  product: Product;
  recommendations: Product[];
  reviews: ProductReview[];
  inquiries: ProductInquiry[];
  member: { name: string } | null;
}) {
  const [color, setColor] = useState(product.colors[0] || '기본'),
    [tab, setTab] = useState<Tab>('상품정보'),
    [saved, setSaved] = useState(false),
    [coupon, setCoupon] = useState(false);
  const status =
      (product.stock??1)<=0?'품절':product.saleStatus ?? (product.sample ? '판매 준비' : '판매중'),
    discount = Math.max(
      0,
      Math.round((1 - product.price / product.original) * 100),
    );
  const average = useMemo(
    () =>
      reviews.length
        ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
        : 0,
    [reviews],
  );
  useEffect(() => {
    try {
      const ids = JSON.parse(
        localStorage.getItem('somi_viewed') || '[]',
      ).filter((id: string) => id !== product.id);
      localStorage.setItem(
        'somi_viewed',
        JSON.stringify([product.id, ...ids].slice(0, 12)),
      );
    } catch {}
    const timer = window.setTimeout(() => {
      const hash = location.hash.slice(1);
      if (hash === 'reviews') setTab('리뷰');
      if (hash === 'sizes') setTab('사이즈');
      if (hash === 'inquiries') setTab('문의');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product.id]);
  function add(destination = '/cart') {
    if (status !== '판매중') return;
    const old = JSON.parse(localStorage.getItem('somi_cart') || '[]');
    localStorage.setItem(
      'somi_cart',
      JSON.stringify([...old, { product, color, qty: 1 }]),
    );
    location.href = destination;
  }
  function choose(next: Tab) {
    setTab(next);
    history.replaceState(
      null,
      '',
      `#${next === '상품정보' ? 'information' : next === '리뷰' ? 'reviews' : next === '사이즈' ? 'sizes' : 'inquiries'}`,
    );
  }
  return (
    <main className="detail-page">
      <header className="detail-top">
        <a href="/">
          <ArrowLeft />
        </a>
        <b>상품정보</b>
        <span>
          <a href="/wishlist">
            <Heart />
          </a>
          <a href="/cart">
            <ShoppingBag />
          </a>
        </span>
      </header>
      <img className="detail-hero" src={product.image} alt={product.name} />
      <section className="detail-summary">
        <small>
          {product.brand} · {status}
        </small>
        <h1>{product.name}</h1>
        <div className="rating-line">
          <Star fill="currentColor" />
          <b>{average ? average.toFixed(1) : '새 상품'}</b>
          <button onClick={() => choose('리뷰')}>리뷰 {reviews.length}</button>
        </div>
        <div className="detail-price">
          <strong>{discount}%</strong>
          <b>{money(product.price)}원</b>
          <del>{money(product.original)}원</del>
        </div>
        <button
          className="coupon-card"
          onClick={async () => {if(!member){location.href=`/api/auth/google/start?returnTo=${encodeURIComponent(`/product/${product.id}`)}`;return;}const response=await fetch('/api/coupons/claim',{method:'POST'});if(response.ok)setCoupon(true);}}
        >
          <span><b>첫 구매 10% 할인 쿠폰</b><small>최대 10,000원 할인</small></span>
          <strong>{coupon ? '받음' : '쿠폰 받기'}</strong>
        </button>
        <p>
          {product.description ||
            '매일 입기 좋은 소미몰 셀렉트 아이템이에요. 편안한 핏과 활용도 높은 디자인으로 준비했습니다.'}
        </p>
        <div className="delivery">
          <Truck size={19} />
          <span>
            <b>{product.todayDispatch ? '오늘출발 · 무료배송' : '무료배송'}</b>
            <br />
            주문 후 2~3일 내 출고 예정
          </span>
        </div>
        <b>색상 선택</b>
        <div className="options">
          {product.colors.map((c) => (
            <button
              key={c}
              className={c === color ? 'selected' : ''}
              onClick={() => setColor(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>
      <nav className="detail-tabs">
        {(['상품정보', '리뷰', '사이즈', '문의'] as Tab[]).map((x) => (
          <button
            className={tab === x ? 'selected' : ''}
            onClick={() => choose(x)}
            key={x}
          >
            {x}
            {x === '리뷰'
              ? ` ${reviews.length}`
              : x === '문의'
                ? ` ${inquiries.length}`
                : ''}
          </button>
        ))}
      </nav>
      <section className="detail-body">
        {tab === '상품정보' && (
          <ProductInformation
            product={product}
            recommendations={recommendations}
          />
        )}{' '}
        {tab === '리뷰' && (
          <Reviews
            product={product}
            reviews={reviews}
            average={average}
            member={member}
          />
        )}{' '}
        {tab === '사이즈' && <SizeGuide product={product} />}{' '}
        {tab === '문의' && (
          <Inquiries product={product} inquiries={inquiries} member={member} />
        )}
      </section>
      <footer className="purchase-bar">
        <button
          onClick={() => setSaved(!saved)}
          className={saved ? 'liked' : ''}
        >
          <Heart fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button disabled={status !== '판매중'} onClick={() => add('/cart')}>
          {status === '판매중' ? '장바구니' : status}
        </button>
        <button className="buy-now" disabled={status !== '판매중'} onClick={() => add('/checkout')}>
          바로구매
        </button>
      </footer>
    </main>
  );
}

function ProductInformation({
  product,
  recommendations,
}: {
  product: Product;
  recommendations: Product[];
}) {
  const info = [
    ['제조국', product.origin],
    ['소재 또는 재질', product.material],
    ['색상', product.colors.join(', ')],
    [
      '치수',
      (product.sizeChart ?? []).length
        ? '사이즈 탭 실측표 참고'
        : '상품 상세 참고',
    ],
    ['제조자', product.manufacturer],
    ['품질 보증 기준', '소비자분쟁해결기준을 준수합니다.'],
  ].filter((row) => row[1]) as string[][];
  const s = product.seller,
    seller = s
      ? ([
          ['상호', s.name],
          ['대표자', s.representative],
          ['주소', s.address],
          ['사업자등록번호', s.businessNumber],
          ['통신판매업신고번호', s.mailOrderNumber],
          ['이메일', s.email],
          ['전화번호', s.phone],
        ].filter((row) => row[1]) as string[][])
      : [];
  return (
    <>
      <h2>상세정보</h2>
      {(product.detailImages ?? []).length ? (
        <div className="detail-image-list">
          {product.detailImages?.map((image, index) => (
            <img
              src={image}
              alt={`${product.name} 상세 ${index + 1}`}
              key={image}
            />
          ))}
        </div>
      ) : (
        <div className="notice">
          <p>상세 이미지는 관리자가 등록한 뒤 표시됩니다.</p>
        </div>
      )}
      <InfoRows title="상품정보제공고시" rows={info} />
      {seller.length ? <InfoRows title="판매자 정보" rows={seller} /> : null}
      <h2 className="recommend-title">함께 코디하면 좋은 상품</h2>
      <div className="recommend-grid">
        {recommendations.map((p) => (
          <a href={`/product/${p.id}`} key={p.id}>
            <img src={p.image} alt="" />
            <b>{p.name}</b>
            <span>{money(p.price)}원</span>
          </a>
        ))}
      </div>
    </>
  );
}
function InfoRows({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="info-rows">
      <h2>{title}</h2>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function Reviews({
  product,
  reviews,
  average,
  member,
}: {
  product: Product;
  reviews: ProductReview[];
  average: number;
  member: { name: string } | null;
}) {
  const [sizeFilter,setSizeFilter]=useState('전체');
  const filteredReviews=reviews.filter(review=>sizeFilter==='전체'||review.usualSize===sizeFilter);
  return (
    <>
      <div className="review-score">
        <strong>{average ? average.toFixed(1) : '–'}</strong>
        <div>
          <span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                fill={i < Math.round(average) ? 'currentColor' : 'none'}
              />
            ))}
          </span>
          <p>
            {reviews.length
              ? `${reviews.length}명의 솔직한 리뷰`
              : '첫 리뷰를 기다리고 있어요.'}
          </p>
        </div>
      </div>
      {member ? (
        <form
          className="review-form"
          action={`/api/product/${product.id}/reviews`}
          method="post"
        >
          <label>
            별점
            <select name="rating" defaultValue="5">
              <option value="5">★★★★★ 아주 좋아요</option>
              <option value="4">★★★★☆ 좋아요</option>
              <option value="3">★★★☆☆ 보통이에요</option>
              <option value="2">★★☆☆☆ 아쉬워요</option>
              <option value="1">★☆☆☆☆ 별로예요</option>
            </select>
          </label>
          <label>
            리뷰 내용
            <textarea
              name="content"
              required
              minLength={10}
              maxLength={1000}
              placeholder="핏, 색상, 착용감 등 도움이 될 내용을 10자 이상 적어 주세요."
            />
          </label>
          <div className="review-profile"><label>키(cm)<input name="heightCm" type="number" min="120" max="230" placeholder="예: 163"/></label><label>몸무게(kg)<input name="weightKg" type="number" min="25" max="250" placeholder="예: 52"/></label><label>평소 사이즈<select name="usualSize" defaultValue=""><option value="">선택 안 함</option>{['XS','S','M','L','XL','FREE'].map(x=><option key={x}>{x}</option>)}</select></label></div>
          <ReviewImageUploader />
          <button className="solid" type="submit">
            리뷰 등록
          </button>
        </form>
      ) : (
        <div className="login-callout">
          <MessageCircle />
          <div>
            <b>로그인하고 리뷰를 남겨보세요.</b>
            <p>Google 회원만 리뷰를 작성할 수 있습니다.</p>
          </div>
          <a
            className="solid"
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(`/product/${product.id}#reviews`)}`}
          >
            로그인
          </a>
        </div>
      )}
      <div className="review-filter"><b>체형 리뷰 찾기</b><select value={sizeFilter} onChange={e=>setSizeFilter(e.target.value)}><option>전체</option>{['XS','S','M','L','XL','FREE'].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="review-list">
        {filteredReviews.map((r) => (
          <article key={r.id}>
            <header>
              <b>{mask(r.memberName)}</b>
              <span>
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </span>
              <time>{date(r.createdAt)}</time>
            </header>
            <p>{r.content}</p>
            {(r.heightCm||r.weightKg||r.usualSize)?<small className="review-body-info">{[r.heightCm?`${r.heightCm}cm`:'',r.weightKg?`${r.weightKg}kg`:'',r.usualSize?`평소 ${r.usualSize}`:''].filter(Boolean).join(' · ')}</small>:null}
            {r.imageUrl?<img className="review-photo" src={r.imageUrl} alt="구매자 착용 리뷰"/>:null}
            {r.adminReply ? (
              <div className="admin-public-reply">
                <b>소미몰 답변</b>
                <p>{r.adminReply}</p>
              </div>
            ) : null}
          </article>
        ))}
        {!reviews.length ? (
          <p className="empty">아직 작성된 리뷰가 없어요.</p>
        ) : null}
      </div>
    </>
  );
}
function ReviewImageUploader(){const [url,setUrl]=useState(''),[message,setMessage]=useState('');return <label>리뷰 사진<input type="hidden" name="imageUrl" value={url}/><input className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setMessage('업로드 중…');const data=new FormData();data.set('file',file);const response=await fetch('/api/review-upload',{method:'POST',body:data}),result=await response.json() as {url?:string;error?:string};if(result.url){setUrl(result.url);setMessage('사진이 첨부됐어요.')}else setMessage(result.error||'업로드 실패');}}/><small>{message||'8MB 이하 사진 1장'}</small>{url?<img className="review-upload-preview" src={url} alt="리뷰 사진 미리보기"/>:null}</label>}
function SizeGuide({ product }: { product: Product }) {
  return (
    <>
      <h2>실측 사이즈</h2>
      <p className="size-note">
        단위 cm · 측정 방법에 따라 1–3cm 오차가 있을 수 있습니다.
      </p>
      {(product.sizeChart ?? []).length ? (
        <div className="size-scroll">
          <table className="size-table">
            <thead>
              <tr>
                <th>사이즈</th>
                <th>총장</th>
                <th>어깨</th>
                <th>가슴단면</th>
                <th>소매길이</th>
                <th>소매단면</th>
                <th>암홀단면</th>
                <th>밑단단면</th>
              </tr>
            </thead>
            <tbody>
              {product.sizeChart?.map((row) => (
                <tr key={row.size}>
                  <th>{row.size}</th>
                  <td>{row.totalLength || '–'}</td>
                  <td>{row.shoulder || '–'}</td>
                  <td>{row.chest || '–'}</td>
                  <td>{row.sleeve || '–'}</td>
                  <td>{row.sleeveOpening || '–'}</td>
                  <td>{row.armhole || '–'}</td>
                  <td>{row.hem || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="notice">
          <p>실측 사이즈가 아직 등록되지 않았습니다.</p>
        </div>
      )}
    </>
  );
}
function Inquiries({
  product,
  inquiries,
  member,
}: {
  product: Product;
  inquiries: ProductInquiry[];
  member: { name: string } | null;
}) {
  return (
    <>
      <h2>상품 문의</h2>
      {member ? (
        <form
          className="review-form"
          action={`/api/product/${product.id}/inquiries`}
          method="post"
        >
          <label>
            문의 내용
            <textarea
              name="content"
              required
              minLength={5}
              maxLength={1000}
              placeholder="상품, 배송, 사이즈에 대해 궁금한 점을 남겨 주세요."
            />
          </label>
          <button className="solid" type="submit">
            문의 등록
          </button>
        </form>
      ) : (
        <p className="login-line">
          문의 작성은 로그인이 필요합니다.{' '}
          <a
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(`/product/${product.id}#inquiries`)}`}
          >
            로그인하기
          </a>
        </p>
      )}
      <div className="inquiry-list">
        {inquiries.map((item) => (
          <article key={item.id}>
            <header>
              <b>Q. {item.content}</b>
              <span>
                {mask(item.memberName)} · {date(item.createdAt)}
              </span>
            </header>
            {item.answer ? (
              <p>
                <strong>A.</strong> {item.answer}
              </p>
            ) : (
              <em>답변 대기</em>
            )}
          </article>
        ))}
        {!inquiries.length ? (
          <p className="empty">아직 등록된 문의가 없어요.</p>
        ) : null}
      </div>
    </>
  );
}
function mask(name: string) {
  return name.length < 2
    ? name
    : `${name[0]}${'*'.repeat(Math.min(2, name.length - 1))}`;
}
function date(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
