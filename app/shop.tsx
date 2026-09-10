'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  UserRound,
  House,
  Grid2X2,
  ArrowUpRight,
  ArrowRight,
} from 'lucide-react';
import { money, type Product } from './catalog';

export default function Shop({
  initialProducts,
  isAdmin = false,
}: {
  initialProducts: Product[];
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('전체'),
    [wish, setWish] = useState<string[]>([]),
    [viewed, setViewed] = useState<string[]>([]),
    [cartIds,setCartIds]=useState<string[]>([]),
    [page, setPage] = useState(1),
    [sort, setSort] = useState('추천순');
  useEffect(() => {
    try {
      setWish(JSON.parse(localStorage.getItem('somi_wish') || '[]'));
      setViewed(JSON.parse(localStorage.getItem('somi_viewed') || '[]'));
      setCartIds(JSON.parse(localStorage.getItem('somi_cart')||'[]').map((x:{product:Product})=>x.product.id));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem('somi_wish', JSON.stringify(wish));
  }, [wish]);
  const filtered = useMemo(
    () =>
      initialProducts.filter(
        (p) =>
          (category === '전체' || p.category === category) &&
          `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [initialProducts, category, query],
  );
  const status = (p: Product) =>
    (p.stock??1)<=0?'품절':p.saleStatus ?? (p.sample ? '판매 준비' : '판매중');
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const sortedProducts = [...filtered].sort((a, b) => {
    if (sort === '리뷰많은순') return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    if(sort==='판매랭킹순')return (b.salesCount??0)-(a.salesCount??0);
    if (sort === '낮은가격순') return a.price - b.price;
    if (sort === '할인율순') return (1 - b.price / b.original) - (1 - a.price / a.original);
    return 0;
  });
  const visibleProducts = sortedProducts.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );
  const viewedProducts = viewed
    .map((id) => initialProducts.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 4);
  const interestProducts=[...new Set([...viewed,...wish,...cartIds])].map(id=>initialProducts.find(p=>p.id===id)).filter((p):p is Product=>Boolean(p));
  const personalized=initialProducts.filter(p=>!interestProducts.some(x=>x.id===p.id)).map(p=>({p,score:interestProducts.reduce((n,x)=>n+(x.category===p.category?3:0)+(x.styleTag&&x.styleTag===p.styleTag?2:0),0)})).sort((a,b)=>b.score-a.score||(b.p.salesCount??0)-(a.p.salesCount??0)).slice(0,4).map(x=>x.p);
  return (
    <>
      <div className="topline">
        나의 취향이 모이는 곳, 소미몰 <ArrowUpRight size={14} />
      </div>
      <header className="header">
        <a className="logo" href="/">
          somi<span>mall</span>
          <i />
        </a>
        <div className="search">
          <Search size={20} />
          <input
            aria-label="상품 검색"
            placeholder="지금 찾고 있는 스타일은?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="header-actions">
          {isAdmin ? (
            <a className="admin-shortcut" href="/admin">
              관리자
            </a>
          ) : null}
          <a href="/account" aria-label="로그인">
            <UserRound />
          </a>
          <a href="/wishlist" aria-label="찜">
            <Heart />
          </a>
          <a href="/cart" aria-label="장바구니">
            <ShoppingBag />
          </a>
        </div>
      </header>
      <main className="shell">
        <nav className="mainnav">
          <b>추천</b>
          <a href="/category">카테고리</a>
          <a href="/category?style=에겐녀">에겐녀</a>
          <a href="/category?style=테토녀">테토녀</a>
          <span>FIND YOUR EVERYDAY</span>
        </nav>
        <section className="intro">
          <div>
            <span className="eyebrow">SOMI EDIT / 01</span>
            <h1>
              매일의 나를,
              <br />
              조금 더 좋아하게.
            </h1>
            <p>홍대 옷가게 직원이 답답해서 직접 차린 쇼핑몰.</p>
            <p className="intro-description">
              실제 직원의 모든 경험을 토대로 핏, 가성비 ITEM, 핫 ITEM을
              대방출합니다.
            </p>
            <button
              onClick={() =>
                document
                  .getElementById('catalog')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              셀렉션 만나기 <ArrowRight size={17} />
            </button>
          </div>
          <div className="intro-type">
            hello,
            <br />
            <em>new mood.</em>
            <span>2026 COLLECTION</span>
          </div>
        </section>
        <div className="categories">
          {['전체', '상의', '하의', '아우터', '가방', '신발'].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? 'selected' : ''}
            >
              {c}
            </button>
          ))}
        </div>
        <section id="catalog">
          <div className="section-head">
            <div>
              <span className="eyebrow">JUST FOR YOU</span>
              <h2>오늘, 눈여겨볼 스타일</h2>
            </div>
            <label className="catalog-sort">
              <span>{filtered.length}개의 상품</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="상품 정렬">
                <option>추천순</option><option>판매랭킹순</option><option>리뷰많은순</option><option>낮은가격순</option><option>할인율순</option>
              </select>
            </label>
          </div>
          <div className="product-grid">
            {visibleProducts.map((p) => (
              <article key={p.id}>
                <a className="product-image" href={`/product/${p.id}`}>
                  <img src={p.image} alt={p.name} />
                  <span>{status(p)}</span>
                </a>
                <button
                  className={`heart ${wish.includes(p.id) ? 'active' : ''}`}
                  onClick={() =>
                    setWish((v) =>
                      v.includes(p.id)
                        ? v.filter((id) => id !== p.id)
                        : [...v, p.id],
                    )
                  }
                  aria-label={`${p.name} 찜`}
                >
                  <Heart
                    size={21}
                    fill={wish.includes(p.id) ? 'currentColor' : 'none'}
                  />
                </button>
                <a className="product-info" href={`/product/${p.id}`}>
                  <b>{p.brand}</b>
                  <h3>{p.name}</h3>
                  <div className="price">
                    <strong>
                      {Math.max(
                        0,
                        Math.round((1 - p.price / p.original) * 100),
                      )}
                      %
                    </strong>
                    <b>{money(p.price)}</b>
                    <del>{money(p.original)}</del>
                  </div>
                  <small>
                    {p.reviewCount
                      ? '★ ' +
                        (p.averageRating ?? 0).toFixed(1) +
                        ' · 리뷰 ' +
                        p.reviewCount
                      : '리뷰 0'}{' '}
                    · {status(p)}
                  </small>
                  {(p.salesCount??0)>0?<small>누적 판매 {p.salesCount}개</small>:null}
                  <span className="benefit-tags">{p.todayDispatch && <i>오늘출발</i>}<i>쿠폰</i></span>
                </a>
              </article>
            ))}
          </div>
          {!filtered.length && <p className="empty">검색한 상품이 없어요.</p>}
          {filtered.length > 0 && (
            <nav className="pagination" aria-label="상품 페이지">
              <button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전</button>
              <b>({currentPage}/{totalPages})</b>
              <button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>다음</button>
            </nav>
          )}
        </section>
        {interestProducts.length>0&&personalized.length>0?<section className="personalized"><div className="section-head"><div><span className="eyebrow">FOR YOUR MOOD</span><h2>최근 취향과 어울리는 상품</h2></div></div><div className="recommend-grid">{personalized.map(p=><a href={`/product/${p.id}`} key={p.id}><img src={p.image} alt=""/><b>{p.name}</b><span>{money(p.price)}원</span></a>)}</div></section>:null}
        <footer>
          <a className="logo" href="/">
            somimall
            <i />
          </a>
          <p>취향을 발견하는 작은 즐거움.</p>
          <a href="/admin">운영자 관리</a>
          <small>© 2026 SOMIMALL</small>
        </footer>
      </main>
      <nav className="bottomnav">
        <a href="/">
          <House />홈
        </a>
        <a href="/category">
          <Grid2X2 />
          카테고리
        </a>
        <a href="/wishlist">
          <Heart />찜
        </a>
        <a href="/cart">
          <ShoppingBag />
          장바구니
        </a>
        <a href="/account">
          <UserRound />
          마이
        </a>
      </nav>
    </>
  );
}
